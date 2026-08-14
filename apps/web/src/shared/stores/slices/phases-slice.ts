import type { StateCreator } from 'zustand';
import {
  savePhasesView,
  type PhasesViewState,
  type ReturnBonusMode,
} from '@/shared/lib/phases-view-storage';
import type { PlannerStore } from '@/shared/stores/planner-store';

export type PhasesSlice = {
  phasesViewPhase: number;
  /** Farm Ranking rotation pool override map (`AD-PFR-05`, `AD-PFRC-05`). */
  farmPoolOverrides: Record<string, boolean>;
  /** Farm Ranking return-bonus estimate — B's `ReturnBonusMode` verbatim (`ASM-C15`). */
  farmReturnBonus: ReturnBonusMode;

  hydratePhasesView: (view: PhasesViewState) => void;
  setPhasesViewPhase: (phase: number) => void;
  setFarmHeroEnabled: (heroId: string, enabled: boolean) => void;
  setFarmReturnBonus: (mode: ReturnBonusMode) => void;
};

export const createPhasesSlice: StateCreator<
  PlannerStore,
  [['zustand/subscribeWithSelector', never]],
  [],
  PhasesSlice
> = (set, get) => {
  /**
   * The ONLY composer of a complete `PhasesViewState` (`AD-PFRC-03`). Every write path —
   * including `setPhasesViewPhase` — goes through this, so a second persisted field can never
   * be silently erased by a partial-literal write again. Reads current slice values via `get()`
   * rather than trusting a caller-supplied patch.
   */
  function persistPhasesView(state: PlannerStore): void {
    savePhasesView({
      phase: state.phasesViewPhase,
      farmPool: state.farmPoolOverrides,
      farmReturnBonus: state.farmReturnBonus,
    });
  }

  return {
    phasesViewPhase: 1,
    farmPoolOverrides: {},
    farmReturnBonus: 'off',

    hydratePhasesView: (view) => {
      set({
        phasesViewPhase: view.phase,
        farmPoolOverrides: view.farmPool ?? {},
        farmReturnBonus: view.farmReturnBonus ?? 'off',
      });
    },

    setPhasesViewPhase: (phase) => {
      const clamped = Math.max(1, Math.min(600, Math.round(phase)));
      if (get().phasesViewPhase === clamped) return;
      set({ phasesViewPhase: clamped });
      persistPhasesView(get());
    },

    setFarmHeroEnabled: (heroId, enabled) => {
      const current = get().farmPoolOverrides;
      if (current[heroId] === enabled) return;
      const next = { ...current, [heroId]: enabled };
      set({ farmPoolOverrides: next });
      persistPhasesView(get());
    },

    setFarmReturnBonus: (mode) => {
      if (get().farmReturnBonus === mode) return;
      set({ farmReturnBonus: mode });
      persistPhasesView(get());
    },
  };
};
