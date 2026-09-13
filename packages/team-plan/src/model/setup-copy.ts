import { mayMoveGear, mayRespendPoints } from '@bombfarm/domain/team-plan';
import type { TeamPlanAllowedChanges } from '@bombfarm/domain/team-plan/types';
import type { TeamPlanCopy } from '../copy';

/**
 * The Optimize button's accessible name has to follow Allowed changes: a points-only plan moves
 * no gear, so an unconditional "gear moves and point resets" describes work it will not do to the
 * one reader who cannot see the control that ruled it out.
 */
export function optimizeAriaFor(t: TeamPlanCopy, allowedChanges: TeamPlanAllowedChanges): string {
  if (!mayMoveGear(allowedChanges)) return t.teamPlanOptimizeAriaPoints;
  if (!mayRespendPoints(allowedChanges)) return t.teamPlanOptimizeAriaGear;
  return t.teamPlanOptimizeAriaBoth;
}

export function allowedChangesHint(t: TeamPlanCopy, allowedChanges: TeamPlanAllowedChanges): string {
  if (allowedChanges === 'points') return t.teamPlanAllowedChangesHintPoints;
  if (allowedChanges === 'gear') return t.teamPlanAllowedChangesHintGear;
  return t.teamPlanAllowedChangesHintBoth;
}

export function ignoreCrowdingHint(t: TeamPlanCopy, on: boolean): string {
  return on ? t.teamPlanIgnoreCrowdingHintOn : t.teamPlanIgnoreCrowdingHintOff;
}
