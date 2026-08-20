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
