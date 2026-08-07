import type { PlannerStore } from '@/shared/stores/planner-store';
import { selectLiveGearPlanInputSignature } from '@/shared/stores/slices/gear-plan-slice';

export function selectGearPlanIsStale(state: PlannerStore): boolean {
  if (state.planInputSignature == null) return false;
  return state.planInputSignature !== selectLiveGearPlanInputSignature(state);
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
