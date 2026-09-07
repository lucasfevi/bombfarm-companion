import type { PlannerStore } from '@/shared/stores/planner-store';
import { selectLiveTeamPlanInputSignature } from '@/shared/stores/slices/team-plan-slice';

export function selectTeamPlanIsStale(state: PlannerStore): boolean {
  if (state.planInputSignature == null) return false;
  return state.planInputSignature !== selectLiveTeamPlanInputSignature(state);
}

export function selectInventoryItems(state: PlannerStore) {
  return state.inventory.items;
}

export function selectScopeByHeroId(state: PlannerStore) {
  return state.scopeByHeroId;
}

export function selectForgeFloor(state: PlannerStore) {
  return state.forgeFloor;
}

export function selectTeamPlanObjective(state: PlannerStore) {
  return state.objective;
}

/**
 * The farm objective prices phases the account has actually unlocked, and `runTeamPlan` refuses
 * to guess: with no `max_phase` on the record there is nothing to plan gold against.
 */
export function selectTeamPlanFarmUnavailable(state: PlannerStore): boolean {
  return state.maxPhase == null;
}
