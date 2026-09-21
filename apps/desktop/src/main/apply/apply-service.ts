import type {
  AccountReadResult,
  AccountSource,
  AppSettings,
  ApplyDoneEvent,
  ApplyEquipUnit,
  ApplyEvent,
  ApplyFailed,
  ApplyInjectRequest,
  ApplyPointsUnit,
  ApplyRunResult,
  ApplySkip,
  ApplyStartReason,
  ApplyStartRequest,
  ApplyStartResult,
  ApplyStep,
  ApplyStopReason,
  ApplyUnitEvent,
  ApplyUnitVerdict,
  ConsentRecord,
} from '@bombfarm/contracts';
import { isApplyStartRequest } from '@bombfarm/contracts';
import {
  PacingRefusedError,
  WriteNotEnabledError,
  createRequestIdSource,
  grantSession,
  grantWriteSession,
  isGranted,
  readHeroDetail,
  requestPost,
  type GrantedConsent,
  type HttpTransport,
  type HeroDetailReading,
  type PacingGate,
  type WriteCall,
  type WriteSession,
} from '@bombfarm/game-api';
import { liveGearStateFromRows, preflightEquipUnits, preflightPointsUnitsOffline, type LiveGearState } from '@bombfarm/domain/team-plan';
import type { SessionTokenFileResult } from '../game-api/session-token-file.js';
import type { LogPort } from '../storage/index.js';
import { classifyApplyOutcome, type ApplyCallVerdict } from './apply-outcome.js';
import { runEquipUnit } from './apply-equip-step.js';
import { runPointsUnit } from './apply-points-step.js';
import type { ApplyRunContext, UnitResult } from './apply-run-context.js';
import type { WriterLock } from './writer-lock.js';

/** How often a paused run polls the gate's own backoff window while waiting it out. */
export const APPLY_COOLDOWN_POLL_MS = 1_000;

export interface ApplyServiceDeps {
  consentStore: { read(): ConsentRecord };
  readToken: (consent: GrantedConsent) => SessionTokenFileResult;
  settings: () => Pick<AppSettings, 'forgeWritesEnabled'>;
  transport: HttpTransport;
  gate: PacingGate;
  accountSource: () => AccountSource;
  isGameRunning: () => boolean;
  /** The items section rows of the account the renderer is looking at. */
  currentItems: () => readonly unknown[] | null;
  /** The heroes section rows of the account the renderer is looking at. */
  currentHeroes: () => readonly unknown[] | null;
  /** The wallet the account section last reported. */
  currentGold: () => number | null;
  writerLock: WriterLock;
  requestReadNow: () => AccountReadResult;
  emit: (event: ApplyEvent) => void;
  /** Armed by the test-only inject seam; taken at `start()`, right after the `busy` check. */
  scripted?: { take(): ApplyInjectRequest | null };
  log: LogPort;
  /** Milliseconds. */
  now: () => number;
  sleep: (ms: number) => Promise<void>;
  random?: () => number;
}

export interface ApplyService {
  start(request: unknown): ApplyStartResult;
  stop(runId: string): boolean;
  isRunning(): boolean;
}

type PauseOutcome = 'ready' | 'stopped' | 'unauthorized' | 'consent_revoked' | 'game_not_running';

function heroIdsFromRows(rows: readonly unknown[] | null): ReadonlySet<string> {
  const ids = new Set<string>();
  if (rows === null) return ids;
  for (const row of rows) {
    if (typeof row !== 'object' || row === null) continue;
    const id = (row as Record<string, unknown>).id;
    if (typeof id === 'string') ids.add(id);
  }
  return ids;
}

export function createApplyService(deps: ApplyServiceDeps): ApplyService {
  const random = deps.random ?? Math.random;
  const startedAtMs = deps.now();
  const requestIds = createRequestIdSource({ uptimeMs: () => deps.now() - startedAtMs, random });
  let activeRunId: string | null = null;
  let stopRequested = false;
  let sequence = 0;

  function liveGear(): LiveGearState | null {
    return liveGearStateFromRows(deps.currentItems(), deps.currentHeroes());
  }

  function nothingToApply(request: ApplyStartRequest): boolean {
    if (request.step === 'equip') {
      const live = liveGear();
      if (live === null) return true;
      return !preflightEquipUnits(request.units, live).some(
        (verdict: ApplyUnitVerdict) => verdict.status !== 'done' && verdict.status !== 'conflict',
      );
    }
    const heroes = deps.currentHeroes();
    if (heroes === null) return true;
    return !preflightPointsUnitsOffline(request.units, heroIdsFromRows(heroes)).some(
      (verdict: ApplyUnitVerdict) => verdict.status !== 'done' && verdict.status !== 'conflict',
    );
  }

  async function pauseFor(runId: string, step: 'equip' | 'points', index: number): Promise<PauseOutcome> {
    const initial = deps.gate.state;
    if (initial === 'ready') return 'ready';
    if (initial === 'halted') return 'unauthorized';

    deps.emit({ type: 'cooldown', runId, step, index, resumeAtMs: initial.backoffUntil });
    for (;;) {
      if (stopRequested) return 'stopped';
      const state = deps.gate.state;
      if (state === 'ready') break;
      if (state === 'halted') return 'unauthorized';
      await deps.sleep(Math.min(APPLY_COOLDOWN_POLL_MS, Math.max(0, state.backoffUntil - deps.now())));
    }
    if (!isGranted(deps.consentStore.read())) return 'consent_revoked';
    if (!deps.isGameRunning()) return 'game_not_running';
    deps.emit({ type: 'resumed', runId, step, index });
    return 'ready';
  }

  function contextFor(
    runId: string,
    step: 'equip' | 'points',
    session: WriteSession,
    index: number,
    callsMade: { count: number },
    wallet: { value: number | null },
  ): ApplyRunContext {
    return {
      async call(kind, writeCall: WriteCall) {
        if (callsMade.count > 0) await deps.sleep(deps.gate.nextForgeDelayMs(random));
        const requestId = requestIds.next();
        for (;;) {
          deps.emit({ type: 'unit', runId, step, index, status: 'sent', call: kind });
          let outcome;
          try {
            outcome = await deps.gate.runWrite(`apply:${step}:${String(index)}`, () => requestPost(session, deps.transport, writeCall, requestId));
          } catch (err) {
            if (err instanceof PacingRefusedError) {
              if (err.gateState === 'halted') return { kind: 'stop', stop: 'unauthorized', code: null };
              const paused = await pauseFor(runId, step, index);
              if (paused !== 'ready') return { kind: 'stop', stop: paused, code: null };
              continue;
            }
            throw err;
          }
          callsMade.count += 1;
          deps.gate.observe(outcome);
          const verdict: ApplyCallVerdict = classifyApplyOutcome(outcome, kind);
          if (verdict.kind === 'cooldown') {
            const paused = await pauseFor(runId, step, index);
            if (paused !== 'ready') return { kind: 'stop', stop: paused, code: null };
            continue;
          }
          return verdict;
        }
      },
      async readDetail(heroId: string): Promise<HeroDetailReading | 'paused-out'> {
        for (;;) {
          const reading = await readHeroDetail(session.session, deps.transport, deps.gate, heroId);
          if (reading.kind === 'failed' && reading.reason === 'cooldown') {
            const paused = await pauseFor(runId, step, index);
            if (paused === 'ready') continue;
            return 'paused-out';
          }
          return reading;
        }
      },
      wallet() {
        return wallet.value;
      },
    };
  }

  async function run(runId: string, session: WriteSession, request: ApplyStartRequest): Promise<void> {
    const startedAt = deps.now();
    const wallet = { value: deps.currentGold() };
    const callsMade = { count: 0 };
    let made = 0;
    let goldSpent = 0;
    const skipped: ApplySkip[] = [];
    let failed: ApplyFailed | null = null;
    let stop: ApplyStopReason = 'finished';
    let stopCode: string | null = null;
    const settled = new Map<number, 'ok' | 'skipped'>();
    const step = request.step;
    const units: readonly (ApplyEquipUnit | ApplyPointsUnit)[] = request.units;

    try {
      for (const unit of units) {
        if (stopRequested) {
          stop = 'stopped';
          break;
        }
        if (!isGranted(deps.consentStore.read())) {
          stop = 'consent_revoked';
          break;
        }
        if (!deps.isGameRunning()) {
          stop = 'game_not_running';
          break;
        }

        const verdict =
          step === 'equip'
            ? preflightEquipUnits(request.units, liveGear() ?? { wearerByItemId: new Map(), heroIds: new Set() }, settled)[unit.index]
            : preflightPointsUnitsOffline([unit as ApplyPointsUnit], heroIdsFromRows(deps.currentHeroes()))[0];

        if (verdict?.status === 'done') {
          deps.emit({ type: 'unit', runId, step, index: unit.index, status: 'skipped', reason: 'alreadyDone' });
          skipped.push({ index: unit.index, reason: 'alreadyDone' });
          settled.set(unit.index, 'skipped');
          continue;
        }
        if (verdict?.status === 'conflict') {
          const reason = verdict.reason ?? 'itemMoved';
          deps.emit({ type: 'unit', runId, step, index: unit.index, status: 'skipped', reason });
          skipped.push({ index: unit.index, reason });
          settled.set(unit.index, 'skipped');
          continue;
        }

        const ctx = contextFor(runId, step, session, unit.index, callsMade, wallet);
        const result: UnitResult =
          step === 'equip' ? await runEquipUnit(unit as ApplyEquipUnit, ctx) : await runPointsUnit(unit as ApplyPointsUnit, ctx);

        if (result.kind === 'ok') {
          made += 1;
          goldSpent += result.goldSpent;
          if (wallet.value !== null) wallet.value -= result.goldSpent;
          deps.emit({ type: 'unit', runId, step, index: unit.index, status: 'ok', goldSpent: result.goldSpent, walletAfter: wallet.value });
          settled.set(unit.index, 'ok');
          continue;
        }
        if (result.kind === 'skip') {
          const skip: ApplySkip =
            result.code === undefined
              ? { index: unit.index, reason: result.reason }
              : { index: unit.index, reason: result.reason, code: result.code };
          deps.emit({ type: 'unit', runId, step, index: unit.index, status: 'skipped', reason: skip.reason, ...(skip.code === undefined ? {} : { code: skip.code }) });
          skipped.push(skip);
          settled.set(unit.index, 'skipped');
          continue;
        }

        // A stop that came from a call actually answered (network/refused) always names it as a
        // failed unit; a stop that came from the pause/resend path (Stop pressed, an auth halt, a
        // consent or game-running flip) does too only when a respec already landed and the commit
        // that followed it is what stopped — every other pause-driven stop is an environmental halt,
        // not a failure, and carries no `failed` entry.
        const isFailure = result.stop === 'network' || result.stop === 'refused' || (result.call === 'commit' && result.resetDone);
        if (isFailure && result.call !== null) {
          deps.emit({
            type: 'unit',
            runId,
            step,
            index: unit.index,
            status: 'failed',
            call: result.call,
            ...(result.code === null ? {} : { code: result.code }),
            ...(result.resetDone ? { reason: 'resetNotPlaced' as const } : {}),
          });
          failed = { index: unit.index, call: result.call, code: result.code, resetDone: result.resetDone };
        }
        stop = result.stop;
        stopCode = result.code;
        break;
      }
    } catch (err) {
      stop = 'error';
      stopCode = err instanceof Error ? err.message : String(err);
      deps.log.error({ scope: 'apply', event: 'run.failed', runId, error: String(err) });
    }

    deps.writerLock.release('apply');
    activeRunId = null;
    stopRequested = false;

    const durationMs = Math.max(0, deps.now() - startedAt);
    const result: ApplyRunResult = {
      step,
      total: units.length,
      made,
      skipped,
      failed,
      stop,
      stopCode,
      goldSpent,
      durationMs,
    };

    deps.log.info({ scope: 'apply', event: 'run.finished', runId, step, planRunId: request.planRunId, made, skipped: skipped.length, stop, gold: goldSpent });
    const read = deps.requestReadNow();
    if (!read.ok) {
      deps.log.warn({ scope: 'apply', event: 'run.read_now_refused', runId, reason: read.reason });
    }
    deps.emit({ type: 'done', runId, step, result });
  }

  function refuse(reason: ApplyStartReason): ApplyStartResult {
    deps.log.info({ scope: 'apply', event: 'run.refused', reason });
    return { ok: false, reason };
  }

  function synthesisedDone(
    script: ApplyInjectRequest,
    step: ApplyStep,
    replayed: readonly ApplyUnitEvent[],
    stop: 'finished' | 'stopped' | 'error',
    durationMs: number,
    stopCode: string | null = null,
  ): ApplyDoneEvent {
    const made = replayed.filter((event) => event.status === 'ok').length;
    const skipped: ApplySkip[] = replayed
      .filter((event) => event.status === 'skipped')
      .map((event) =>
        event.code === undefined
          ? { index: event.index, reason: event.reason as ApplySkip['reason'] }
          : { index: event.index, reason: event.reason as ApplySkip['reason'], code: event.code },
      );
    const total = new Set(script.events.filter((event) => event.type === 'unit').map((event) => event.index)).size;
    const goldSpent = replayed.reduce((sum, event) => sum + (event.goldSpent ?? 0), 0);
    const result: ApplyRunResult = { step, total, made, skipped, failed: null, stop, stopCode, goldSpent, durationMs };
    return { runId: script.runId, step, result };
  }

  async function runScripted(script: ApplyInjectRequest): Promise<void> {
    const step: ApplyStep = script.events.find((event): event is Extract<ApplyEvent, { type: 'unit' }> => event.type === 'unit')?.step ?? 'equip';
    deps.log.info({ scope: 'apply', event: 'run.scripted', runId: script.runId, events: script.events.length, gapMs: script.gapMs });

    const startedAt = deps.now();
    const replayed: ApplyUnitEvent[] = [];
    let ended = false;
    let failure: string | null = null;
    try {
      for (let index = 0; index < script.events.length; index++) {
        // Always yields at least once, even for the first event with gapMs 0 — so the replay
        // (including its first emit) never runs synchronously inside start()'s own call stack.
        await deps.sleep(index > 0 ? script.gapMs : 0);
        if (stopRequested) break;
        const event = script.events[index];
        if (!event) continue;
        deps.emit(event);
        if (event.type === 'unit') replayed.push(event);
        if (event.type === 'done') {
          ended = true;
          break;
        }
      }
    } catch (err) {
      failure = err instanceof Error ? err.message : String(err);
      deps.log.error({ scope: 'apply', event: 'run.failed', runId: script.runId, error: String(err) });
    }
    if (!ended) {
      const durationMs = Math.max(0, deps.now() - startedAt);
      const stop = failure !== null ? 'error' : stopRequested ? 'stopped' : 'finished';
      deps.emit({ type: 'done', ...synthesisedDone(script, step, replayed, stop, durationMs, failure) });
    }
    deps.writerLock.release('apply');
    activeRunId = null;
    stopRequested = false;
  }

  return {
    start(request) {
      if (activeRunId !== null || deps.writerLock.holder !== null) return refuse('busy');

      const script = deps.scripted?.take();
      if (script) {
        deps.writerLock.acquire('apply');
        activeRunId = script.runId;
        stopRequested = false;
        void runScripted(script);
        return { ok: true, runId: script.runId };
      }

      if (!isApplyStartRequest(request)) return refuse('bad_request');
      if (deps.accountSource() === 'fixture') return refuse('offline');

      const consent = deps.consentStore.read();
      if (!isGranted(consent)) return refuse('not_consented');
      if (!deps.isGameRunning()) return refuse('game_not_running');

      const token = deps.readToken(consent);
      if (!token.ok) return refuse('token_unavailable');

      let session: WriteSession;
      try {
        session = grantWriteSession(grantSession(consent, { accountId: token.accountId, token: token.token }), deps.settings());
      } catch (err) {
        if (err instanceof WriteNotEnabledError) return refuse('writes_disabled');
        throw err;
      }

      if (nothingToApply(request)) return refuse('nothing_to_apply');

      sequence += 1;
      const runId = `${String(deps.now())}-${String(sequence)}`;
      deps.writerLock.acquire('apply');
      activeRunId = runId;
      stopRequested = false;
      deps.log.info({ scope: 'apply', event: 'run.started', runId, step: request.step, planRunId: request.planRunId, units: request.units.length });
      // `run()` catches every throw from its own body and always emits `done`; this is the last
      // resort for a throw from outside that body (before its own try, or from the promise
      // machinery itself), so the lock is never left held by a run nothing is still driving.
      void run(runId, session, request).catch((err: unknown) => {
        deps.log.error({ scope: 'apply', event: 'run.failed', runId, error: String(err) });
        deps.writerLock.release('apply');
        activeRunId = null;
        stopRequested = false;
      });
      return { ok: true, runId };
    },

    stop(runId) {
      if (activeRunId !== runId) return false;
      stopRequested = true;
      return true;
    },

    isRunning() {
      return activeRunId !== null;
    },
  };
}
