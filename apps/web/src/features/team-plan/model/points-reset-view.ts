import type { PointAlloc } from '@bombfarm/domain/gear';
import type { TeamPlan, TeamPlanPerHeroRow } from '@bombfarm/domain/team-plan/types';

export type PointsResetView = { before: PointAlloc; after: PointAlloc; level: number };

/**
 * Every field comes from the plan, never from the live roster. A plan outlives the roster it
 * was scored against — the player can respec, re-import or edit points before opening this
 * panel — and the stat rows rendered beside this table were computed at `ptsBefore`. Reading
 * `hero.pts` here instead pairs this run's target with someone else's starting point and prints
 * a reset whose deltas never happened.
 *
 * `pts` / `ptsBefore` are always full absolute `PointAlloc`s (`buildPointResets` takes them from
 * `finalPtsByHeroId` / the run's own current vector) — the domain type widens them for storage.
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
