import type { PvpHistoryResult } from '@bombfarm/contracts';

/**
 * The phase the duel room is hardened to, as the Optimizer's PVP input, or `null` while nothing
 * is on record — the plan then falls back to the account's phase. The last duel's phase when the
 * app saw one, else the tier floor: the room is hardened to the tier, and a fought duel is the
 * better witness.
 */
export function pvpRoomPhaseInput(history: PvpHistoryResult | null): number | null {
  const fought = history?.rows[0]?.phase;
  if (fought !== undefined) return fought;
  return history?.standing?.tierFloor ?? null;
}
