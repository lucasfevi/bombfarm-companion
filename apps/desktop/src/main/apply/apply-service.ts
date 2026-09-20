import type {
  AccountReadResult,
  AccountSource,
  AppSettings,
  ApplyEquipUnit,
  ApplyEvent,
  ApplyFailed,
  ApplyPointsUnit,
  ApplyRunResult,
  ApplySkip,
  ApplyStartReason,
  ApplyStartRequest,
  ApplyStartResult,
  ApplyStopReason,
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

  return {
    start(request) {
      if (activeRunId !== null || deps.writerLock.holder !== null) return refuse('busy');
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
      void run(runId, session, request);
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
