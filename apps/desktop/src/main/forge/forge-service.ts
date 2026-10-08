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
  createRequestIdSource,
  requestPost,
  type GrantedConsent,
  type HttpTransport,
  type PacingGate,
  type RequestOutcome,
  type WriteSession,
} from '@bombfarm/game-api';
import { chanceStoneRarityIdx } from '@bombfarm/domain/inventory-view';
import {
  FORGE_ITEM_LEVELS,
  FORGE_MAX,
  classifyForgeRoll,
  emptyForgeTally,
  evalForgeStop,
  foldForgeStep,
  forgeChance,
  forgeProtectable,
  forgeScrollCost,
  forgeStonePp,
  nextForgeStep,
} from '@bombfarm/domain/forge';
import type { WriterLock } from '../apply/writer-lock.js';
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
  /** Rolls missed in a row, as the item carries them; each adds to the next roll’s chance. */
  readonly fails: number;
  /** Essence the Protection Scroll costs on the item's next roll; 0 where the game does not offer it. */
  readonly scrollCost: number;
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
  /** The essence the account last reported; null when the read does not carry it, in which case the
   *  server's own refusal is what ends a run that cannot pay. */
  currentEssence?: () => number | null;
  applyResult: (patch: ForgeAccountPatch) => void;
  history: ForgeHistory;
  writerLock: WriterLock;
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

function nonNegativeInteger(value: unknown): number | null {
  const parsed = finiteNumber(value);
  return parsed !== null && Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

export function resolveForgeItem(rows: readonly unknown[] | null, itemId: string): ForgeItemFacts | null {
  if (rows === null) return null;
  const row = rows.find((candidate) => isRecord(candidate) && candidate.id === itemId);
  if (!isRecord(row) || typeof row.def_id !== 'string') return null;
  const rarity = finiteNumber(row.rarity);
  const level = finiteNumber(row.level);
  if (rarity === null || level === null || !FORGE_ITEM_LEVELS.includes(level)) return null;
  const slot = finiteNumber(row.slot);
  const upgrade = finiteNumber(row.upgrade);
  if (upgrade === null || !Number.isInteger(upgrade) || upgrade < 0 || upgrade > FORGE_MAX) return null;
  return {
    id: itemId,
    defId: row.def_id,
    rarity,
    slot,
    level,
    upgrade,
    fails: nonNegativeInteger(row.forge_fails) ?? 0,
    scrollCost: upgrade < FORGE_MAX ? scrollCostOf(row, upgrade + 1, level, rarity) : 0,
  };
}

export function isForgeTarget(target: unknown, upgrade: number): target is number {
  return typeof target === 'number' && Number.isInteger(target) && target > upgrade && target <= FORGE_MAX;
}

const STONE_RARITIES = 6;

export function usableStoneCounts(rows: readonly unknown[] | null): number[] {
  const owned = new Array<number>(STONE_RARITIES).fill(0);
  for (const row of rows ?? []) {
    if (!isRecord(row) || typeof row.def_id !== 'string' || !row.def_id.startsWith('forja_pedra_')) continue;
    const category = finiteNumber(row.category);
    if (category !== null && category !== 8) continue;
    if (row.locked === true || (finiteNumber(row.market_state) ?? 0) !== 0) continue;
    if (typeof row.equipped_on === 'string' && row.equipped_on !== '') continue;
    const rarity = chanceStoneRarityIdx(row.def_id, -1);
    if (rarity >= 0 && rarity < STONE_RARITIES) owned[rarity] = (owned[rarity] ?? 0) + 1;
  }
  return owned;
}

function stoneRarityOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < STONE_RARITIES ? value : null;
}

interface ForgeReply {
  readonly item: Record<string, unknown>;
  /** The rarity of the stone the server says it used up; null when it says none. */
  readonly stone: number | null;
  readonly upgrade: number;
  readonly cost: number | null;
  readonly gold: number | null;
  readonly critical: boolean;
  readonly fails: number | null;
  /** Essence the server says it charged for the Protection Scroll; 0 when none. */
  readonly scrollPaid: number;
  /** Essence the server says the roll itself cost, the scroll's not included; null when the reply omits it. */
  readonly essenceCost: number | null;
  /** The essence balance after the roll, when the reply carries it. */
  readonly essence: number | null;
}

export function parseForgeReply(json: unknown): ForgeReply | null {
  if (!isRecord(json) || !isRecord(json.item)) return null;
  const upgrade = finiteNumber(json.item.upgrade);
  if (upgrade === null || !Number.isInteger(upgrade)) return null;
  return {
    item: json.item,
    stone: stoneRarityOrNull(json.pedra_gasta),
    upgrade,
    cost: finiteNumber(json.cost),
    gold: finiteNumber(json.gold),
    critical: json.critical === true,
    fails: nonNegativeInteger(json.item.forge_fails),
    scrollPaid: nonNegativeInteger(json.pergaminho_pago) ?? 0,
    essenceCost: nonNegativeInteger(json.essence_cost),
    essence: finiteNumber(json.essence),
  };
}

/**
 * What the item says the Protection Scroll costs for the roll it is about to make: the wire's own
 * `pergaminho_custo`, which is above zero exactly where the game offers the scroll. A row that
 * does not carry the field at all falls back to the published price, so an older read does not
 * read as "never offered".
 */
export function scrollCostOf(item: Record<string, unknown>, nextTarget: number, level: number, rarity: number): number {
  const wire = nonNegativeInteger(item.pergaminho_custo);
  if (wire !== null) return wire;
  return forgeProtectable(nextTarget) ? forgeScrollCost(level, rarity, nextTarget) : 0;
}

function stopFor(outcome: RequestOutcome): ForgeStopReason {
  switch (outcome.kind) {
    case 'cooldown':
      return 'cooldown';
    case 'http_error':
      return 'missing';
    case 'api_error':
      if (outcome.code === 'NOT_ENOUGH_ESSENCE') return 'shortfall';
      // A named refusal on a 4xx/5xx carries the same signal `http_error` did — the server
      // rejected this item. A refusal on an otherwise-OK response (maintenance, a dead session)
      // says nothing about the item, so it stays a plain error.
      return outcome.status >= 400 ? 'missing' : 'error';
    default:
      return 'error';
  }
}

function stoneWanted(stones: ForgeStartRequest['stones'], target: number): number | null {
  return stoneRarityOrNull(stones?.[target - 1] ?? null);
}

function limitOrNull(value: number | null): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

export function createForgeService(deps: ForgeServiceDeps): ForgeService {
  const random = deps.random ?? Math.random;
  // The game's key counts from its own start, not the epoch; `now()` at construction is this
  // process's equivalent zero. One source per service, so the sequence is monotonic across runs.
  const startedAtMs = deps.now();
  const requestIds = createRequestIdSource({ uptimeMs: () => deps.now() - startedAtMs, random });
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
    let fails = item.fails;
    let wallet = deps.currentGold();
    let lastItem: Record<string, unknown> | null = null;
    let calls = 0;
    let stop: ForgeStopReason = 'error';
    const owned = usableStoneCounts(deps.currentItems());
    const stonesSpent = new Array<number>(STONE_RARITIES).fill(0);
    let stoneRarity: number | null = null;
    let scrollCost = item.scrollCost;
    let scrollEssence = 0;
    let essence = deps.currentEssence?.() ?? null;

    try {
      for (;;) {
        const step = nextForgeStep(upgrade, request.target, item.level, item.rarity, fails);
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

        const wanted = stoneWanted(request.stones, step.target);
        const rollsOnWithoutStones = request.stopWhenOutOfStones === false;
        const wantsStone = wanted !== null && step.chance < 1;
        const outOfStone = wantsStone && (owned[wanted] ?? 0) <= 0;
        if (outOfStone && !rollsOnWithoutStones) {
          stop = 'stones';
          stoneRarity = wanted;
          break;
        }
        const useStone = wantsStone && !outOfStone;

        const wantsScroll = request.scroll === true && forgeProtectable(step.target);
        const chanceAfterStone = useStone ? forgeChance(step.target, fails, forgeStonePp(wanted)) : step.chance;
        const useScroll = wantsScroll && chanceAfterStone < 1;
        if (useScroll && scrollCost <= 0) {
          stop = 'scroll_mismatch';
          deps.log.warn({ scope: 'forge', event: 'run.scroll_not_offered', runId, target: step.target });
          break;
        }
        if (useScroll && essence !== null && essence < step.essence + scrollCost) {
          stop = 'shortfall';
          break;
        }

        const gapMs = calls > 0 ? deps.gate.nextForgeDelayMs(random) : 0;
        deps.emit({ type: 'pause', runId, ms: gapMs });
        if (gapMs > 0) await deps.sleep(gapMs);

        const send = (stone: number | null, scroll: boolean): Promise<RequestOutcome> =>
          deps.gate.runWrite(`forge:${item.id}`, () =>
            requestPost(
              session,
              deps.transport,
              {
                route: FORGE_ROUTES.forge,
                item: item.id,
                ...(stone === null ? {} : { stone }),
                ...(scroll ? { scroll: true as const } : {}),
              },
              requestIds.next(),
            ),
          );
        let sentStone = useStone ? wanted : null;
        let sentScroll = useScroll;
        let outcome: RequestOutcome;
        try {
          outcome = await send(sentStone, sentScroll);
          if (sentStone !== null && outcome.kind === 'api_error' && outcome.code === 'FORGE_AID_USELESS') {
            deps.gate.observe(outcome);
            deps.log.info({ scope: 'forge', event: 'run.stone_useless', runId });
            sentStone = null;
            sentScroll = false;
            outcome = await send(null, false);
          } else if (sentStone !== null && rollsOnWithoutStones && outcome.kind === 'api_error' && outcome.code === 'NO_FORGE_AID') {
            deps.gate.observe(outcome);
            deps.log.info({ scope: 'forge', event: 'run.stone_out_rolling_on', runId });
            owned[sentStone] = 0;
            sentStone = null;
            sentScroll = wantsScroll && step.chance < 1 && scrollCost > 0;
            outcome = await send(null, sentScroll);
          }
        } catch (err) {
          stop = err instanceof PacingRefusedError && err.gateState !== 'halted' ? 'cooldown' : 'error';
          deps.log.warn({ scope: 'forge', event: 'run.refused_by_gate', runId, error: String(err) });
          break;
        }
        calls += 1;

        if (outcome.kind !== 'ok') {
          deps.gate.observe(outcome);
          if (sentStone !== null && outcome.kind === 'api_error' && outcome.code === 'NO_FORGE_AID') {
            owned[sentStone] = 0;
            stop = 'stones';
            stoneRarity = sentStone;
          } else {
            stop = stopFor(outcome);
          }
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
          kind: 'roll',
          serverCritical: reply.critical,
        });
        const rollEssence = (reply.essenceCost ?? step.essence) + reply.scrollPaid;
        tally = foldForgeStep(tally, { outcome: rollOutcome, kind: 'roll', cost, essence: rollEssence });
        wallet = reply.gold ?? (wallet === null ? null : wallet - cost);
        lastItem = reply.item;
        scrollEssence += reply.scrollPaid;
        essence = reply.essence ?? (essence === null ? null : essence - rollEssence);
        const from = upgrade;
        upgrade = reply.upgrade;
        fails = reply.fails ?? (rollOutcome === 'fail' ? fails + 1 : 0);
        if (upgrade < FORGE_MAX) scrollCost = scrollCostOf(reply.item, upgrade + 1, item.level, item.rarity);
        if (reply.stone !== null) {
          owned[reply.stone] = Math.max(0, (owned[reply.stone] ?? 0) - 1);
          stonesSpent[reply.stone] = (stonesSpent[reply.stone] ?? 0) + 1;
        }

        deps.emit({
          type: 'step',
          runId,
          itemId: item.id,
          attempt: calls,
          kind: 'roll',
          target: step.target,
          from,
          to: upgrade,
          outcome: rollOutcome,
          cost,
          spent: tally.spent,
          wallet,
          stone: reply.stone,
          essence: rollEssence,
          scrollEssence: reply.scrollPaid,
        });

        if (reply.stone !== sentStone) {
          stop = 'stone_mismatch';
          stoneRarity = sentStone ?? reply.stone;
          deps.log.warn({ scope: 'forge', event: 'run.stone_mismatch', runId, sent: sentStone, spent: reply.stone });
          break;
        }

        if (sentScroll !== (reply.scrollPaid > 0)) {
          stop = 'scroll_mismatch';
          deps.log.warn({ scope: 'forge', event: 'run.scroll_mismatch', runId, sent: sentScroll, paid: reply.scrollPaid });
          break;
        }
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
      stonesSpent,
      stoneRarity,
      essence: tally.essence,
      scrollEssence,
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
        stonesSpent,
        stoneRarity,
        scrollEssence,
        essence: tally.essence,
      });
    }

    deps.log.info({ scope: 'forge', event: 'run.finished', runId, stop, rolls: result.rolls, spent: result.spent });
    deps.writerLock.release('forge');
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
      if (activeRunId !== null || deps.writerLock.holder !== null) return refuse('busy');
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
      deps.writerLock.acquire('forge');
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
