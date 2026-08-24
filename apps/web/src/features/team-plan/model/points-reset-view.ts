import type { PointAlloc } from '@bombfarm/domain/gear';
import type { TeamPlan, TeamPlanPerHeroRow } from '@bombfarm/domain/team-plan/types';

export type PointsResetView = { before: PointAlloc; after: PointAlloc; level: number };

/**
 * Every field comes from the plan, never from the live roster — see `TeamPlan.pointResets[]`'s
 * `ptsBefore`. The casts are safe: `buildPointResets` only ever emits full absolute allocations,
 * and the domain type widens them for storage.
 */
export function pointsResetView(plan: TeamPlan, row: TeamPlanPerHeroRow): PointsResetView | null {
  const reset = plan.pointResets.find((entry) => entry.heroId === row.heroId);
  if (!reset) return null;
  return {
    before: reset.ptsBefore as PointAlloc,
    after: reset.pts as PointAlloc,
    level: row.level,
  };
}
