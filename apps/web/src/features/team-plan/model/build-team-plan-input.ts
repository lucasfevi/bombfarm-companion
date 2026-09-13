import type { TeamPlanInput } from '@bombfarm/domain/team-plan/types';
import { buildTeamPlanInput, countOptimizeScopeHeroes as countOptimizeScopeHeroesOf } from '@bombfarm/team-plan/core';
import type { PlannerStore } from '@/shared/stores/planner-store';
import {
  selectTeamPlanControls,
  selectTeamPlanInputs,
} from '@/shared/stores/selectors/team-plan-selectors';

export function buildTeamPlanInputFromStore(state: PlannerStore): TeamPlanInput {
  return buildTeamPlanInput(selectTeamPlanInputs(state), selectTeamPlanControls(state));
}

export function countOptimizeScopeHeroes(state: PlannerStore): number {
  return countOptimizeScopeHeroesOf(state.heroes, state.scopeByHeroId);
}
