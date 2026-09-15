import type { RequiredAccountField } from '@bombfarm/domain/account-required-fields';
import type { PlannerStore } from '@/shared/stores';

const PHASE_ONLY: readonly RequiredAccountField[] = ['phase'];
const NOTHING: readonly RequiredAccountField[] = [];

export function selectHasRoster(state: PlannerStore): boolean {
  return state.heroes.length > 0;
}

export function selectHasGearPool(state: PlannerStore): boolean {
  return state.inventory.items.length > 0;
}

export function selectAccountUsable(state: PlannerStore): boolean {
  return (
    state.phase != null &&
    state.maxPhase != null &&
    !(state.missingRequiredFields != null && state.missingRequiredFields.length > 0)
  );
}

export function selectFirstVisit(state: PlannerStore): boolean {
  return !selectHasRoster(state) && state.missingRequiredFields == null && state.phase == null;
}

export function selectMissingFieldsToName(state: PlannerStore): readonly RequiredAccountField[] {
  if (state.missingRequiredFields != null && state.missingRequiredFields.length > 0) {
    return state.missingRequiredFields;
  }
  return state.phase == null ? PHASE_ONLY : NOTHING;
}
