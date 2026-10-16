import type { Loadout, PointAlloc } from '../gear/types';
import { mayMoveGear } from './allowed-changes';
import { resolveCombatWindow } from './combat-window';
import { loadoutForScoring } from './evaluate';
import { buildFarmObjective, clearSecsAt, isSquadScope } from './farm-objective';
import { SET_FARM_SETS, setFarmBand, type SetFarmBand } from './set-farm';
import { isFarmSearchObjective } from './types';
import type {
  HeroPlanContext,
  RosterEvaluation,
  TeamPlan,
  TeamPlanAllowedChanges,
  TeamPlanFarmObjective,
  TeamPlanInput,
} from './types';

export function currentPtsByHeroId(input: TeamPlanInput): Record<string, PointAlloc> {
  return Object.fromEntries(input.heroes.map((hero) => [hero.heroId, hero.pts]));
}

/**
 * The farm objective's once-per-run setup, or `undefined` in DPS mode.
 *
 * Built over the whole SQUAD rather than the search's optimize scope — a hero the player left
 * alone still farms — while the search below still only moves gear the pool gives it.
 *
 * Seeded from the roster AS IT STANDS — the current loadout at forge floor 0, not the baseline
 * assignment — because the team auras it freezes are priced from every hero's uptime today. That
 * is the same starting point the farm estimator reads off the save, which is what lets the two
 * agree exactly before the search moves anything.
 */
export function farmObjectiveFor(
  input: TeamPlanInput,
  contexts: HeroPlanContext[],
): TeamPlanFarmObjective | undefined {
  if (!isFarmSearchObjective(input.objective)) return undefined;
  const setBand = input.objective === 'setFarm' ? requireSetBand(input.farmSet) : null;
  const squadContexts = contexts.filter((ctx) => isSquadScope(ctx.scope));
  if (squadContexts.length === 0) return undefined;
  const loadoutByHeroId: Record<string, Loadout> = {};
  for (const hero of input.heroes) loadoutByHeroId[hero.heroId] = loadoutForScoring(hero.loadout, 0);
  return buildFarmObjective(
    squadContexts,
    input.account,
    loadoutByHeroId,
    input.targetPhase,
    input.ignoreFieldCrowding,
    input.aurasAtCap,
    setBand,
  );
}

function requireSetBand(farmSet: string | null | undefined): SetFarmBand {
  const band = setFarmBand(farmSet);
  if (band === null) {
    throw new Error(
      `team-plan: objective 'setFarm' needs farmSet to name an equipment set; got ` +
        `${JSON.stringify(farmSet ?? null)}. Known sets: ${SET_FARM_SETS.join(', ')}.`,
    );
  }
  return band;
}

/**
 * Which phase the plan's figures are about, for the reader.
 *
 * The chosen phase is reported as chosen even when the squad cannot clear it — the answer to
 * "what would I earn at phase 400" is allowed to be "nothing", and silently reporting some other
 * phase instead would be a different plan wearing this one's number.
 *
 * A set is searched, never chosen, whatever `targetPhase` says; when no phase of its band is
 * both unlocked and clearable the plan still names the band's first phase rather than none.
 */
export function scoredPhaseReport(
  input: TeamPlanInput,
  farmObjective: TeamPlanFarmObjective | undefined,
  finalEvaluation: RosterEvaluation,
): Pick<TeamPlan, 'scoredPhase' | 'scoredPhaseSource' | 'scoredPhaseInfeasible'> {
  if (input.objective === 'setFarm' && farmObjective) {
    const searched = finalEvaluation.farmPhase ?? null;
    return {
      scoredPhase: searched ?? farmObjective.phaseOptions.phaseRange?.min ?? null,
      scoredPhaseSource: 'searched',
      scoredPhaseInfeasible: searched === null,
    };
  }
  const chosen = input.targetPhase;
  // A gate clear fights the gate the window resolved to, which is the chosen phase only when
  // that phase was a gate; anything else fell through to the account's next one.
  const window = resolveCombatWindow(input);
  if (window !== null && input.objective === 'gateClear') {
    const chosenGate = chosen != null && Math.round(chosen) === window.phase;
    return {
      scoredPhase: window.phase,
      scoredPhaseSource: chosenGate ? 'chosen' : 'account',
      scoredPhaseInfeasible: false,
    };
  }
  if (chosen != null && Number.isFinite(chosen)) {
    return {
      scoredPhase: Math.round(chosen),
      scoredPhaseSource: 'chosen',
      scoredPhaseInfeasible: farmObjective !== undefined && finalEvaluation.farmPhase == null,
    };
  }
  if (farmObjective) {
    return {
      scoredPhase: finalEvaluation.farmPhase ?? null,
      scoredPhaseSource: 'searched',
      scoredPhaseInfeasible: false,
    };
  }
  return {
    scoredPhase: input.account.phase,
    scoredPhaseSource: 'account',
    scoredPhaseInfeasible: false,
  };
}

export function scoredPhaseClearSecs(
  report: Pick<TeamPlan, 'scoredPhase' | 'scoredPhaseInfeasible'>,
  farmObjective: TeamPlanFarmObjective | undefined,
  finalEvaluation: RosterEvaluation,
): number | null {
  if (!farmObjective || report.scoredPhase === null || report.scoredPhaseInfeasible) return null;
  return clearSecsAt(farmObjective, finalEvaluation.farmFacts ?? [], report.scoredPhase);
}

/**
 * The input the whole run below reads, with the forge floor zeroed when gear is off the table.
 *
 * Zeroing here rather than at each of the four places a floor is read is what makes "no gear
 * work" a property of the run instead of a rule every consumer has to remember: the pool, every
 * evaluation, `chooseGearCandidate`'s candidate list and `buildForgeList` all take their floor
 * from this one field, and at 0 each of them independently degenerates to the no-forge case.
 */
export function planInputFor(input: TeamPlanInput, allowedChanges: TeamPlanAllowedChanges): TeamPlanInput {
  const forgeFloor = mayMoveGear(allowedChanges) ? input.forgeFloor : 0;
  return { ...input, allowedChanges, forgeFloor };
}
