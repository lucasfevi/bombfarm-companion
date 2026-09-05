/**
 * The Forge run's IPC seam: what the renderer asks for, what main answers, and the two event
 * shapes a run pushes while it spends the player's gold. The outcome and stop vocabularies mirror
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
  | 'missing'
  | 'error';

export interface ForgeStartRequest {
  itemId: string;
  target: number;
  maxGold: number | null;
  maxAttempts: number | null;
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
}

export interface ForgeDoneEvent {
  runId: string;
  result: ForgeRunResult;
}

export type ForgeEvent = ({ type: 'step' } & ForgeStepEvent) | ({ type: 'done' } & ForgeDoneEvent);

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
}

export interface ForgeHistoryTotals {
  runs: number;
  spent: number;
  rolls: number;
  fails: number;
}

export interface ForgeHistoryResult {
  rows: ForgeHistoryRow[];
  totals: ForgeHistoryTotals;
}

export const EMPTY_FORGE_HISTORY: ForgeHistoryResult = { rows: [], totals: { runs: 0, spent: 0, rolls: 0, fails: 0 } };
