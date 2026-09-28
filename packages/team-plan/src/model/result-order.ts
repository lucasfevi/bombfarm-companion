/**
 * How the per-hero result rows are ordered. The plan hands them over by name; the player may want
 * them by what the plan does to each hero instead.
 *
 * Every comparator is total — ties fall back to the name, then the hero id — so an order never
 * reshuffles between two renders of the same plan.
 */
import type { TeamPlanPerHeroRow } from '@bombfarm/domain/team-plan/types';

export const TEAM_PLAN_RESULT_SORT_KEYS = ['name', 'delta', 'deltaPct', 'after', 'before', 'level'] as const;
export type TeamPlanResultSortKey = (typeof TEAM_PLAN_RESULT_SORT_KEYS)[number];
export type TeamPlanResultSortDirection = 'asc' | 'desc';

export type TeamPlanResultSort = {
  readonly key: TeamPlanResultSortKey;
  readonly direction: TeamPlanResultSortDirection;
};

/** The order the plan itself arrives in, so a player who never touches the control sees no change. */
export const DEFAULT_TEAM_PLAN_RESULT_SORT: TeamPlanResultSort = { key: 'name', direction: 'asc' };

/** A to Z for a name; biggest first for every figure. Picking a key starts from here. */
export function firstResultSortDirection(key: TeamPlanResultSortKey): TeamPlanResultSortDirection {
  return key === 'name' ? 'asc' : 'desc';
}

/** Undefined when the figure does not exist — a relative gain on a hero doing no damage today. */
function figureFor(row: TeamPlanPerHeroRow, key: Exclude<TeamPlanResultSortKey, 'name'>): number | undefined {
  switch (key) {
    case 'delta':
      return row.delta;
    case 'deltaPct':
      return row.before > 0 ? row.delta / row.before : undefined;
    case 'after':
      return row.after;
    case 'before':
      return row.before;
    case 'level':
      return row.level;
  }
}

function byName(left: TeamPlanPerHeroRow, right: TeamPlanPerHeroRow): number {
  return left.heroName.localeCompare(right.heroName) || left.heroId.localeCompare(right.heroId);
}

export function sortTeamPlanResultRows(
  rows: readonly TeamPlanPerHeroRow[],
  sort: TeamPlanResultSort,
): readonly TeamPlanPerHeroRow[] {
  const sign = sort.direction === 'asc' ? 1 : -1;
  return [...rows].sort((left, right) => {
    if (sort.key === 'name') return byName(left, right) * sign;
    const a = figureFor(left, sort.key);
    const b = figureFor(right, sort.key);
    // Missing last in both directions: an absent figure is not a small one.
    if (a === undefined || b === undefined) {
      if (a === b) return byName(left, right);
      return a === undefined ? 1 : -1;
    }
    if (a !== b) return (a - b) * sign;
    return byName(left, right);
  });
}

function isResultSortKey(value: unknown): value is TeamPlanResultSortKey {
  return (TEAM_PLAN_RESULT_SORT_KEYS as readonly unknown[]).includes(value);
}

/** Reads a stored value back; anything unrecognised reads as the default rather than half of one. */
export function normalizeTeamPlanResultSort(value: unknown): TeamPlanResultSort {
  if (typeof value !== 'object' || value === null) return DEFAULT_TEAM_PLAN_RESULT_SORT;
  const raw = value as Record<string, unknown>;
  if (!isResultSortKey(raw.key)) return DEFAULT_TEAM_PLAN_RESULT_SORT;
  const direction = raw.direction === 'asc' || raw.direction === 'desc' ? raw.direction : firstResultSortDirection(raw.key);
  return { key: raw.key, direction };
}
