import type { PlannerStore } from '@/shared/stores/planner-store';
import {
  selectLiveTeamPlanInputSignature,
  selectTeamPlanTargetPhase,
} from '@/shared/stores/slices/team-plan-slice';

export { selectTeamPlanTargetPhase };

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

export function selectTeamPlanAllowedChanges(state: PlannerStore) {
  return state.allowedChanges;
}

/**
 * A gold plan left to find its own phase sweeps the phases the account has unlocked, and
 * `runTeamPlan` refuses to guess that ceiling: with no `max_phase` on the record there is nothing
 * to bound the sweep with. Naming a phase removes the sweep and with it the requirement, so this
 * is only ever true while the phase control sits on None.
 */
export function selectTeamPlanFarmUnavailable(state: PlannerStore): boolean {
  return state.maxPhase == null && selectTeamPlanTargetPhase(state) == null;
}
