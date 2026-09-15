/**
 * Confirmed real in-game cost: 1000 gold per hero level for one in-game stat-point respec.
 * Ability resets cost the same again, separately, and are never recommended here.
 */
export const RESPEC_COST_GOLD_PER_LEVEL = 1000;

/**
 * `level × RESPEC_COST_GOLD_PER_LEVEL`, in ABSOLUTE GOLD.
 *
 * Deliberately does NOT clamp, round or floor: both call sites already normalize `level` before
 * calling this, and adding normalization here would change the value the Team Plan waterfall has
 * always emitted for the same input.
 */
export function respecCostGold(level: number): number {
  return level * RESPEC_COST_GOLD_PER_LEVEL;
}

/**
 * Whether acting on a proposal actually costs a respec — true iff it takes a point AWAY from some
 * stat. A proposal that only ADDS is the player spending points the game has already granted and
 * nobody has placed, which is free: the gold buys back what is already committed, and there is
 * nothing to buy back.
 *
 * Reachable only since the gold search gained a move that places an unplaced pool
 * (`farm-optimize-search.ts`) — before that every proposal was a transfer, so every proposal that
 * changed anything necessarily took a point off something and the two questions had one answer.
 *
 * All eight keys, not the seven reallocatable ones: both callers copy `luck` through untouched
 * today, but a proposal that ever did lower it would need the same reset, and reading the extra
 * key costs nothing. Missing keys read as 0 — `buildPointResets` defaults an absent hero to `{}`,
 * and an empty-to-empty comparison is correctly "no reset needed".
 */
export function requiresPointReset(
  before: Readonly<Record<string, number>>,
  after: Readonly<Record<string, number>>,
): boolean {
  for (const key of Object.keys(before)) {
    if ((after[key] ?? 0) < (before[key] ?? 0)) return true;
  }
  return false;
}
