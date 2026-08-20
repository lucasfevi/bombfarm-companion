import type { PlannerStore } from '@/shared/stores/planner-store';

export const selectPhasesViewPhase = (state: PlannerStore): number => state.phasesViewPhase;
export const selectPhasesViewPhaseChosen = (state: PlannerStore): boolean =>
  state.phasesViewPhaseChosen;
