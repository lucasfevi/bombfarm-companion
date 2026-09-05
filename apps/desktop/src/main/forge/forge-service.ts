import type {
  AccountSource,
  AppSettings,
  ConsentRecord,
  ForgeEvent,
  ForgeRunResult,
  ForgeStartRequest,
  ForgeStartResult,
  ForgeStopReason,
} from '@bombfarm/contracts';
import {
  FORGE_ROUTES,
  PacingRefusedError,
  WriteNotEnabledError,
  grantSession,
  grantWriteSession,
  isGranted,
  requestPost,
  type GrantedConsent,
  type HttpTransport,
  type PacingGate,
  type RequestOutcome,
  type WriteSession,
} from '@bombfarm/game-api';
import {
  FORGE_ITEM_LEVELS,
  FORGE_MAX,
  classifyForgeRoll,
  emptyForgeTally,
  evalForgeStop,
  foldForgeStep,
  nextForgeStep,
} from '@bombfarm/domain/forge';
import type { SessionTokenFileResult } from '../game-api/session-token-file.js';
import type { LogPort } from '../storage/index.js';
import type { ForgeAccountPatch } from './forge-account-patch.js';
import type { ForgeHistory } from './forge-history.js';

/**
 * A forge run: the only code in the app that spends the player's gold. It obtains consent, the
 * token and a write session exactly the way an account cycle obtains its read session, one layer
 * up, then walks the ladder one call at a time through the shared pacing gate. The server's
 * returned item is the only truth about where a roll landed; the odds are never consulted to
 * infer it. Cancel is honoured between calls only, so the wallet and the item never disagree
 * with the server.
 */

export interface ForgeItemFacts {
  readonly id: string;
  readonly defId: string;
  readonly rarity: number;
  readonly slot: number | null;
  readonly level: number;
  readonly upgrade: number;
}

export interface ForgeServiceDeps {
  consentStore: { read(): ConsentRecord };
  readToken: (consent: GrantedConsent) => SessionTokenFileResult;
  settings: () => Pick<AppSettings, 'forgeWritesEnabled'>;
  transport: HttpTransport;
  gate: PacingGate;
  accountSource: () => AccountSource;
  isGameRunning: () => boolean;
  /** The items section rows of the account the renderer is looking at. */
  currentItems: () => readonly unknown[] | null;
  /** The wallet the account section last reported; the first shortfall check reads it. */
  currentGold: () => number | null;
  applyResult: (patch: ForgeAccountPatch) => void;
  history: ForgeHistory;
  emit: (event: ForgeEvent) => void;
  log: LogPort;
  /** Milliseconds. */
  now: () => number;
  sleep: (ms: number) => Promise<void>;
  /** The draw behind the humanised gap between calls; injectable so a test can pin it. */
  random?: () => number;
}

export interface ForgeService {
  start(request: ForgeStartRequest): ForgeStartResult;
  cancel(runId: string): boolean;
  isRunning(): boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function resolveForgeItem(rows: readonly unknown[] | null, itemId: string): ForgeItemFacts | null {
  if (rows === null) return null;
  const row = rows.find((candidate) => isRecord(candidate) && candidate.id === itemId);
  if (!isRecord(row) || typeof row.def_id !== 'string') return null;
  const rarity = finiteNumber(row.rarity);
  const level = finiteNumber(row.level);
  if (rarity === null || level === null || !FORGE_ITEM_LEVELS.includes(level)) return null;
  const slot = finiteNumber(row.slot);
  const upgrade = finiteNumber(row.upgrade) ?? 0;
  if (!Number.isInteger(upgrade) || upgrade < 0 || upgrade > FORGE_MAX) return null;
  return { id: itemId, defId: row.def_id, rarity, slot, level, upgrade };
}

export function isForgeTarget(target: unknown, upgrade: number): target is number {
  return typeof target === 'number' && Number.isInteger(target) && target > upgrade && target <= FORGE_MAX;
}

interface ForgeReply {
  readonly item: Record<string, unknown>;
  readonly upgrade: number;
  readonly cost: number | null;
  readonly gold: number | null;
  readonly critical: boolean;
}

export function parseForgeReply(json: unknown): ForgeReply | null {
  if (!isRecord(json) || !isRecord(json.item)) return null;
  const upgrade = finiteNumber(json.item.upgrade);
  if (upgrade === null || !Number.isInteger(upgrade)) return null;
  return {
    item: json.item,
    upgrade,
    cost: finiteNumber(json.cost),
    gold: finiteNumber(json.gold),
    critical: json.critical === true,
  };
}

function stopFor(outcome: RequestOutcome): ForgeStopReason {
  switch (outcome.kind) {
    case 'cooldown':
      return 'cooldown';
    case 'http_error':
      return 'missing';
    default:
      return 'error';
  }
}

function limitOrNull(value: number | null): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

export function createForgeService(deps: ForgeServiceDeps): ForgeService {
  const random = deps.random ?? Math.random;
  let activeRunId: string | null = null;
  let cancelled = false;
  let sequence = 0;

  async function run(
    runId: string,
    session: WriteSession,
    accountId: string,
    item: ForgeItemFacts,
    request: ForgeStartRequest,
  ): Promise<void> {
    const startedAt = deps.now();
    const limits = { target: request.target, maxAttempts: limitOrNull(request.maxAttempts), maxGold: limitOrNull(request.maxGold) };
    let tally = emptyForgeTally();
    let upgrade = item.upgrade;
    let wallet = deps.currentGold();
    let lastItem: Record<string, unknown> | null = null;
    let calls = 0;
    let stop: ForgeStopReason = 'error';

    try {
      for (;;) {
        const step = nextForgeStep(upgrade, request.target, item.level, item.rarity);
        if (step.kind === 'done') {
          stop = 'target';
          break;
        }
        const limitHit = evalForgeStop(
          { upgrade, attempt: tally.rolls, spent: tally.spent, cancelled, nextCost: step.cost, wallet },
          limits,
        );
        if (limitHit !== null) {
          stop = limitHit;
          break;
        }

        if (calls > 0) await deps.sleep(deps.gate.nextForgeDelayMs(random));

        const route = step.kind === 'safe' ? FORGE_ROUTES.forgeToSafe : FORGE_ROUTES.forge;
        let outcome: RequestOutcome;
        try {
          outcome = await deps.gate.runWrite(`forge:${item.id}`, () => requestPost(session, deps.transport, route, item.id));
        } catch (err) {
          stop = err instanceof PacingRefusedError && err.gateState !== 'halted' ? 'cooldown' : 'error';
          deps.log.warn({ scope: 'forge', event: 'run.refused_by_gate', runId, error: String(err) });
          break;
        }
        calls += 1;

        if (outcome.kind !== 'ok') {
          deps.gate.observe(outcome);
          stop = stopFor(outcome);
          deps.log.warn({ scope: 'forge', event: 'run.call_failed', runId, kind: outcome.kind });
          break;
        }
        deps.gate.observe(outcome);

        const reply = parseForgeReply(outcome.json);
        if (reply === null) {
          stop = 'error';
          deps.log.warn({ scope: 'forge', event: 'run.reply_unreadable', runId });
          break;
        }

        const cost = reply.cost ?? step.cost;
        const rollOutcome = classifyForgeRoll({
          after: reply.upgrade,
          target: step.target,
          kind: step.kind,
          serverCritical: reply.critical,
        });
        tally = foldForgeStep(tally, { outcome: rollOutcome, kind: step.kind, cost });
        wallet = reply.gold ?? (wallet === null ? null : wallet - cost);
        lastItem = reply.item;
        const from = upgrade;
        upgrade = reply.upgrade;

        deps.emit({
          type: 'step',
          runId,
          itemId: item.id,
          attempt: calls,
          kind: step.kind,
          target: step.target,
          from,
          to: upgrade,
          outcome: rollOutcome,
          cost,
          spent: tally.spent,
          wallet,
        });
      }
    } catch (err) {
      stop = 'error';
      deps.log.error({ scope: 'forge', event: 'run.failed', runId, error: String(err) });
    }

    const finishedAt = deps.now();
    const result: ForgeRunResult = {
      itemId: item.id,
      from: item.upgrade,
      to: upgrade,
      target: request.target,
      stop,
      reached: upgrade >= request.target,
      rolls: tally.rolls,
      fails: tally.fails,
      crits: tally.crits,
      safeJumps: tally.safeJumps,
      spent: tally.spent,
      walletAfter: wallet,
      durationMs: Math.max(0, finishedAt - startedAt),
    };

    if (lastItem !== null) {
      try {
        deps.applyResult({ itemId: item.id, item: lastItem, gold: wallet });
      } catch (err) {
        deps.log.error({ scope: 'forge', event: 'run.apply_failed', runId, error: String(err) });
      }
      deps.history.append({
        startedAt: new Date(startedAt).toISOString(),
        finishedAt: new Date(finishedAt).toISOString(),
        accountId,
        itemId: item.id,
        defId: item.defId,
        rarity: item.rarity,
        slot: item.slot,
        itemLevel: item.level,
        fromUpgrade: result.from,
        toUpgrade: result.to,
        target: result.target,
        stop: result.stop,
        reached: result.reached,
        rolls: result.rolls,
        fails: result.fails,
        crits: result.crits,
        safeJumps: result.safeJumps,
        spent: result.spent,
        walletAfter: result.walletAfter,
        durationMs: result.durationMs,
      });
    }

    deps.log.info({ scope: 'forge', event: 'run.finished', runId, stop, rolls: result.rolls, spent: result.spent });
    activeRunId = null;
    cancelled = false;
    deps.emit({ type: 'done', runId, result });
  }

  function refuse(reason: Extract<ForgeStartResult, { ok: false }>['reason']): ForgeStartResult {
    deps.log.info({ scope: 'forge', event: 'run.refused', reason });
    return { ok: false, reason };
  }

  return {
    start(request) {
      if (activeRunId !== null) return refuse('busy');
      if (deps.accountSource() === 'fixture') return refuse('offline');

      const item = resolveForgeItem(deps.currentItems(), request.itemId);
      if (item === null) return refuse('unknown_item');
      if (!isForgeTarget(request.target, item.upgrade)) return refuse('bad_target');

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

      sequence += 1;
      const runId = `${String(deps.now())}-${String(sequence)}`;
      activeRunId = runId;
      cancelled = false;
      deps.log.info({ scope: 'forge', event: 'run.started', runId, from: item.upgrade, target: request.target });
      void run(runId, session, token.accountId, item, request);
      return { ok: true, runId };
    },

    cancel(runId) {
      if (activeRunId !== runId) return false;
      cancelled = true;
      return true;
    },

    isRunning() {
      return activeRunId !== null;
    },
  };
}
