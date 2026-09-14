import type { TeamPlanObjective } from '@bombfarm/domain/team-plan/types';
import type { TeamPlanScreenCopy } from '../copy';

/**
 * Every string on this page whose wording depends on what the search was scoring.
 *
 * Two parallel key sets in the namespace, resolved here into one neutrally-named bundle, rather
 * than one key set with the objective substituted into it: a template cannot carry a unit, and
 * "{delta} {unit}" would let a damage word reach a gold plan through a translation nobody
 * re-read. The components below receive this bundle and never the suffixed keys, so farm mode
 * has no damage-worded string in reach — `team-plan-objective-copy.test.ts` holds both halves of
 * that: the bundle's own vocabulary, and the fact that no component reads around it.
 */
export type TeamPlanObjectiveCopy = {
  setupSectionBody: string;
  objectiveHint: string;
  regimeHintSaturated: string;
  totalGainValue: string;
  resultsHeader: string;
  gearDipNote: string;
  phaseHintNone: string;
};

export function teamPlanObjectiveCopy(
  strings: TeamPlanScreenCopy,
  objective: TeamPlanObjective,
): TeamPlanObjectiveCopy {
  return objective === 'farm'
    ? {
        setupSectionBody: strings.teamPlanSetupSectionBodyFarm,
        objectiveHint: strings.teamPlanObjectiveHintFarm,
        regimeHintSaturated: strings.teamPlanRunSummaryRegimeHintSaturatedFarm,
        totalGainValue: strings.teamPlanTotalGainValueFarm,
        resultsHeader: strings.teamPlanResultsHeaderFarm,
        gearDipNote: strings.teamPlanGearDipNoteFarm,
        phaseHintNone: strings.teamPlanPhaseHintNoneFarm,
      }
    : {
        setupSectionBody: strings.teamPlanSetupSectionBodyDps,
        objectiveHint: strings.teamPlanObjectiveHintDps,
        regimeHintSaturated: strings.teamPlanRunSummaryRegimeHintSaturatedDps,
        totalGainValue: strings.teamPlanTotalGainValueDps,
        resultsHeader: strings.teamPlanResultsHeaderDps,
        gearDipNote: strings.teamPlanGearDipNoteDps,
        phaseHintNone: strings.teamPlanPhaseHintNoneDps,
      };
}
