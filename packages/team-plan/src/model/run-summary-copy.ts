import type { TeamPlan, TeamPlanObjective } from '@bombfarm/domain/team-plan/types';
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
 * Where the plan's phase came from, as the note under the phase card. The automatic case has to
 * say so — a figure the player did not ask for at a phase they did not pick reads as a claim
 * about their own account otherwise.
 */
export function scoredPhaseHint(t: TeamPlanCopy, plan: TeamPlan, objective: TeamPlanObjective = 'dps'): string | null {
  if (plan.scoredPhase == null) {
    return plan.scoredPhaseSource === 'searched' ? t.teamPlanScoredPhaseNoneFeasible : null;
  }
  if (plan.scoredPhaseInfeasible) return t.teamPlanScoredPhaseUnreachable;
  if (plan.scoredPhaseSource === 'searched') return t.teamPlanScoredPhaseSearched;
  // A duel's phase is the room's whatever the source says: the host names it, the player does not.
  if (objective === 'pvp') return t.teamPlanScoredPhasePvp;
  if (plan.scoredPhaseSource === 'account') return t.teamPlanScoredPhaseAccount;
  return objective === 'gateClear' ? t.teamPlanScoredPhaseGate : t.teamPlanScoredPhaseChosen;
}

export function scoredPhaseValue(lang: Lang, plan: TeamPlan): string {
  return plan.scoredPhase == null ? '—' : formatPhaseLabel(plan.scoredPhase, lang);
}

/**
 * The phase the account is on when the plan's figures are about a different one — the sweep moved
 * the squad, or the player pinned a phase away from home. Null when they agree or either is
 * unknown, so the card says nothing rather than "was —".
 */
export function scoredPhaseMovedFrom(
  t: TeamPlanCopy,
  lang: Lang,
  plan: TeamPlan,
  accountPhase: number | null,
): string | null {
  if (plan.scoredPhase == null || accountPhase == null || plan.scoredPhase === accountPhase) return null;
  return sub(t.teamPlanWaterfallPhaseFrom, { phase: formatPhaseLabel(accountPhase, lang) });
}
