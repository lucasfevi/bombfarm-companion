import type { TeamPlanAllowedChanges } from './types';

/**
 * The two halves of {@link TeamPlanAllowedChanges}, as predicates rather than string comparisons
 * spread across the solver, the seed list and the waterfall — four call sites reading
 * `!== 'points'` is four places for the sense to be inverted.
 *
 * `undefined` reads as `'both'` throughout, so a caller that predates the field keeps the
 * behaviour it has always had.
 */
export function mayMoveGear(allowedChanges: TeamPlanAllowedChanges | undefined): boolean {
  return allowedChanges !== 'points';
}

export function mayRespendPoints(allowedChanges: TeamPlanAllowedChanges | undefined): boolean {
  return allowedChanges !== 'gear';
}
