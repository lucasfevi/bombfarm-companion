/**
 * The Forge run's IPC seam: what the renderer asks for, what main answers, and the event shapes a
 * run pushes while it spends the player's gold. The outcome and stop vocabularies mirror
 * the domain's forge session module by value — this package sits below it and cannot import it.
 */

export type ForgeCallKind = 'safe' | 'roll';
export type ForgeRollOutcome = 'success' | 'critical' | 'fail';
export type ForgeStopReason =
  | 'target'
  | 'attempts'
  | 'budget'
  | 'cancelled'
  | 'cooldown'
  | 'shortfall'
  | 'stones'
  | 'stone_mismatch'
  | 'scroll_mismatch'
  | 'missing'
  | 'error';

export interface ForgeStartRequest {
  itemId: string;
  target: number;
  maxGold: number | null;
  maxAttempts: number | null;
  /** The Chance Stone rarity (0 to 5) to spend on the roll for each target, indexed target - 1; absent or null is none. */
  stones?: readonly (number | null | undefined)[];
  /** Ask for the Protection Scroll on every roll that offers it; absent or false is none. */
  scroll?: boolean;
  /** Absent or true stops the run when a chosen Chance Stone runs out; false rolls on without it. */
  stopWhenOutOfStones?: boolean;
}

/** Why a run did not start. `busy` is another run in flight; `offline` is an account with no
 *  server behind it; `unavailable` is a request that reached main before its service existed. */
export type ForgeStartReason =
  | 'busy'
  | 'offline'
  | 'not_consented'
  | 'game_not_running'
  | 'token_unavailable'
  | 'writes_disabled'
  | 'unknown_item'
  | 'bad_target'
  | 'unavailable';

export type ForgeStartResult = { ok: true; runId: string } | { ok: false; reason: ForgeStartReason };

export interface ForgeStepEvent {
  runId: string;
  itemId: string;
  /** The ordinal of this call within the run, safe jumps included — the chart's x axis. */
  attempt: number;
  kind: ForgeCallKind;
  /** The level the call was rolling for. */
  target: number;
  from: number;
  /** Where the server said the piece landed — the only truth about the roll. */
  to: number;
  outcome: ForgeRollOutcome;
  cost: number;
  spent: number;
  wallet: number | null;
  /** The rarity of the Chance Stone this roll used up, as the server reported it; null when none. */
  stone?: number | null;
  /** Essence the roll was charged in all, the Protection Scroll's included; absent when the reply did not say. */
  essence?: number;
  /** The part of that essence the Protection Scroll cost, as the server reported it; 0 or absent when none. */
  scrollEssence?: number;
}

export interface ForgeRunResult {
  itemId: string;
  from: number;
  to: number;
  target: number;
  stop: ForgeStopReason;
  reached: boolean;
  rolls: number;
  fails: number;
  crits: number;
  safeJumps: number;
  spent: number;
  walletAfter: number | null;
  durationMs: number;
  /** Chance Stones used up by the run, by rarity 0 to 5. */
  stonesSpent?: readonly number[];
  /** The rarity involved when the run stopped for want of stones, or on a stone the server did not take as asked. */
  stoneRarity?: number | null;
  /** Essence the run was charged in all, Protection Scrolls included. */
  essence?: number;
  /** The part of that essence the Protection Scrolls cost. */
  scrollEssence?: number;
}

/**
 * A roll is pending: pushed before every call, the moment the gap ahead of it is drawn and before
 * it is waited out. The run decides its own gaps so its calls do not fall into a fixed beat;
 * nothing outside is holding it back, and a cooldown the server asks for ends a run rather than
 * pausing one. The first call of a run takes no gap and carries `ms: 0`, so a screen watching
 * these knows a roll is in flight from the first one onwards.
 */
export interface ForgePauseEvent {
  runId: string;
  /** How long the run will wait before the next roll, in milliseconds; `0` for no wait at all. */
  ms: number;
}

export interface ForgeDoneEvent {
  runId: string;
  result: ForgeRunResult;
}

export type ForgeEvent =
  | ({ type: 'step' } & ForgeStepEvent)
  | ({ type: 'pause' } & ForgePauseEvent)
  | ({ type: 'done' } & ForgeDoneEvent);

export interface ForgeHistoryRow {
  id: number;
  startedAt: string;
  finishedAt: string;
  accountId: string;
  itemId: string;
  defId: string;
  rarity: number;
  slot: number | null;
  itemLevel: number;
  fromUpgrade: number;
  toUpgrade: number;
  target: number;
  stop: ForgeStopReason;
  reached: boolean;
  rolls: number;
  fails: number;
  crits: number;
  safeJumps: number;
  spent: number;
  walletAfter: number | null;
  durationMs: number;
  /** Chance Stones used up by the run, by rarity 0 to 5; all zeros for a run recorded before stones. */
  stonesSpent: readonly number[];
  stoneRarity: number | null;
  /** Essence paid for Protection Scrolls; zero for a run recorded before scrolls. */
  scrollEssence: number;
  /** Essence the run was charged in all, scrolls included; null for a run recorded before essence was tracked. */
  essence: number | null;
}

export interface ForgeHistoryTotals {
  runs: number;
  spent: number;
  /** Essence across the runs that recorded it. */
  essence: number;
  rolls: number;
  fails: number;
}

export interface ForgeHistoryResult {
  rows: ForgeHistoryRow[];
  totals: ForgeHistoryTotals;
}

export const EMPTY_FORGE_HISTORY: ForgeHistoryResult = { rows: [], totals: { runs: 0, spent: 0, essence: 0, rolls: 0, fails: 0 } };
