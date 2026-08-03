import type { StateCreator } from 'zustand';
import { savePhasesView } from '@/shared/lib/phases-view-storage';
import type { PlannerStore } from '@/shared/stores/planner-store';

export type PhasesSlice = {
  phasesViewPhase: number;
  hydratePhasesView: (phase: number) => void;
  setPhasesViewPhase: (phase: number) => void;
};

export const createPhasesSlice: StateCreator<
  PlannerStore,
  [['zustand/subscribeWithSelector', never]],
  [],
  PhasesSlice
> = (set, get) => ({
  phasesViewPhase: 1,

  hydratePhasesView: (phase) => {
    if (get().phasesViewPhase === phase) return;
    set({ phasesViewPhase: phase });
  },

  setPhasesViewPhase: (phase) => {
    const clamped = Math.max(1, Math.min(600, Math.round(phase)));
    if (get().phasesViewPhase === clamped) return;
    savePhasesView({ phase: clamped });
    set({ phasesViewPhase: clamped });
  },
});
