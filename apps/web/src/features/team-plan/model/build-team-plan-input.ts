import type { TeamPlanInput } from '@bombfarm/domain/team-plan/types';
import { buildTeamPlanInput } from '@bombfarm/team-plan/core';
import type { PlannerStore } from '@/shared/stores/planner-store';
import {
  selectOptimizeScopeHeroCount,
  selectTeamPlanControls,
  selectTeamPlanInputs,
} from '@/shared/stores/selectors/team-plan-selectors';

export { selectOptimizeScopeHeroCount as countOptimizeScopeHeroes };

export function buildTeamPlanInputFromStore(state: PlannerStore): TeamPlanInput {
  return buildTeamPlanInput(selectTeamPlanInputs(state), selectTeamPlanControls(state));
}
