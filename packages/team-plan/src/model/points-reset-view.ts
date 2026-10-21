import type { PointAlloc } from '@bombfarm/domain/gear';
import type { TeamPlan, TeamPlanPerHeroRow } from '@bombfarm/domain/team-plan/types';

export type PointsResetView = {
  before: PointAlloc;
  after: PointAlloc;
  level: number;
  /** What the reset adds to the plan's objective, as a percentage of today's; `null` when today
   *  scores nothing to divide by. */
  gainPct: number | null;
};

/**
 * Every field comes from the plan, never from the live roster — see `TeamPlan.pointResets[]`'s
 * `ptsBefore`. The casts are safe: `buildPointResets` only ever emits full absolute allocations,
 * and the domain type widens them for storage.
 */
export function pointsResetView(plan: TeamPlan, row: TeamPlanPerHeroRow): PointsResetView | null {
  const reset = plan.pointResets.find((entry) => entry.heroId === row.heroId);
  if (!reset) return null;
  const today = plan.steps.find((step) => step.id === 'today')?.objective ?? 0;
  return {
    before: reset.ptsBefore as PointAlloc,
    after: reset.pts as PointAlloc,
    level: row.level,
    gainPct: today > 0 ? (reset.rosterGainObjective / today) * 100 : null,
  };
}
