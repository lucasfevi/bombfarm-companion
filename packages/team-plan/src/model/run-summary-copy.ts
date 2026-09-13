import type { TeamPlan } from '@bombfarm/domain/team-plan/types';
import { formatNumber } from '@bombfarm/ui';
import { formatPhaseLabel } from '@bombfarm/farm';
import { sub, type Lang } from '@bombfarm/hero/copy';
import type { TeamPlanCopy } from '../copy';

export function formatElapsedSeconds(elapsedMs: number, lang: Lang): string {
  return formatNumber(elapsedMs / 1000, lang, 1);
}

export function seedStartLabel(t: TeamPlanCopy, seedUsed: string): string {
  switch (seedUsed) {
    case 'current':
      return t.teamPlanRunSeedCurrent;
    case 'greedyHeroDps':
      return t.teamPlanRunSeedGreedyHeroDps;
    case 'greedySlotValue':
      return t.teamPlanRunSeedGreedySlotValue;
    case 'bestItemFirst':
      return t.teamPlanRunSeedBestItemFirst;
    default:
      return t.teamPlanRunSeedFallback;
  }
}

/**
 * What the plan was scored against, in one sentence: the phase, and where that phase came from.
 * The automatic case has to say so — a figure the player did not ask for at a phase they did not
 * pick reads as a claim about their own account otherwise.
 */
export function scoredPhaseHint(t: TeamPlanCopy, lang: Lang, plan: TeamPlan): string | null {
  if (plan.scoredPhase == null) {
    return plan.scoredPhaseSource === 'searched' ? t.teamPlanScoredPhaseNoneFeasible : null;
  }
  const phase = formatPhaseLabel(plan.scoredPhase, lang);
  if (plan.scoredPhaseInfeasible) return sub(t.teamPlanScoredPhaseUnreachable, { phase });
  if (plan.scoredPhaseSource === 'searched') {
    return sub(t.teamPlanScoredPhaseSearched, { phase });
  }
  if (plan.scoredPhaseSource === 'account') {
    return sub(t.teamPlanScoredPhaseAccount, { phase });
  }
  return sub(t.teamPlanScoredPhaseChosen, { phase });
}
