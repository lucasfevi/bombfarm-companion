import type { PvpHistoryResult } from '@bombfarm/contracts';

/**
 * The duel squad's slots as the Optimizer's PVP input, or `null` while no standing reports them —
 * the plan then assumes the top squad house's. The standing's `slots` is what the account can
 * field now; its `slotsMax` is the top of the squad-house ladder, which says nothing about this
 * account.
 */
export function pvpSquadSlotsInput(history: PvpHistoryResult | null): number | null {
  return history?.standing?.slots ?? null;
}
