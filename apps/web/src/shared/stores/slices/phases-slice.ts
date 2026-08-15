import type { StateCreator } from 'zustand';
import {
  savePhasesView,
  type PhasesViewState,
  type ReturnBonusMode,
} from '@/shared/lib/phases-view-storage';
// Type-only import — erases at compile time, so this slice never becomes a runtime importer of
// @bombfarm/domain/farm-optimize (farm-ranking-guards.test.ts guard (g) scopes runtime imports
// to farm-ranking-selectors.ts only).
import type { FarmObjectiveKind, FarmRespecResult } from '@bombfarm/domain/farm-optimize';
import type { PlannerStore } from '@/shared/stores/planner-store';

/** The on-demand Tier 2 result, keyed by the EXACT dependency tuple that produced it
 *  (`readFarmRespecDepTuple`'s return value) — the staleness key AND the memo key, compared
 *  element-wise via the selectors module's own `depsEqual`. */
export type FarmRespecProposal = {
  deps: readonly unknown[];
  result: FarmRespecResult;
};

export type FarmRespecStatus = 'idle' | 'solving' | 'done' | 'failed';

export type PhasesSlice = {
  phasesViewPhase: number;
  /** Farm Ranking rotation pool override map. */
  farmPoolOverrides: Record<string, boolean>;
  /** Farm Ranking return-bonus estimate — `@bombfarm/domain`'s `ReturnBonusMode` verbatim. */
  farmReturnBonus: ReturnBonusMode;
  /** Farm Respec Advisor objective preset — PERSISTED and re-solved on change. */
  farmObjective: FarmObjectiveKind;
  /** The on-demand Tier 2 result. EPHEMERAL — never persisted (spec Out of scope). */
  farmRespecProposal: FarmRespecProposal | null;
  /** EPHEMERAL. */
  farmRespecStatus: FarmRespecStatus;
  /** EPHEMERAL — the re-rank toggle (MOD-13, the sort/filter precedent). */
  farmRespecReRank: boolean;
  /** EPHEMERAL — lets the player close the panel without turning re-rank on. */
  farmRespecPanelOpen: boolean;

  hydratePhasesView: (view: PhasesViewState) => void;
  setPhasesViewPhase: (phase: number) => void;
  setFarmHeroEnabled: (heroId: string, enabled: boolean) => void;
  setFarmReturnBonus: (mode: ReturnBonusMode) => void;
  setFarmObjective: (kind: FarmObjectiveKind) => void;
  setFarmRespecReRank: (active: boolean) => void;
  setFarmRespecPanelOpen: (open: boolean) => void;
};

export const createPhasesSlice: StateCreator<
  PlannerStore,
  [['zustand/subscribeWithSelector', never]],
  [],
  PhasesSlice
> = (set, get) => {
  /**
   * The ONLY composer of a complete `PhasesViewState`. Every write path —
   * including `setPhasesViewPhase` — goes through this, so a second persisted field can never
   * be silently erased by a partial-literal write again. Reads current slice values via `get()`
   * rather than trusting a caller-supplied patch.
   */
  function persistPhasesView(state: PlannerStore): void {
    savePhasesView({
      phase: state.phasesViewPhase,
      farmPool: state.farmPoolOverrides,
      farmReturnBonus: state.farmReturnBonus,
      farmObjective: state.farmObjective,
    });
  }

  return {
    phasesViewPhase: 1,
    farmPoolOverrides: {},
    farmReturnBonus: 'off',
    farmObjective: 'gold',
    farmRespecProposal: null,
    farmRespecStatus: 'idle',
    farmRespecReRank: false,
    farmRespecPanelOpen: false,

    hydratePhasesView: (view) => {
      set({
        phasesViewPhase: view.phase,
        farmPoolOverrides: view.farmPool ?? {},
        farmReturnBonus: view.farmReturnBonus ?? 'off',
        farmObjective: view.farmObjective ?? 'gold',
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

    // Does NOT clear farmRespecProposal: the objective is part of the dependency tuple the
    // proposal is keyed on (readFarmRespecDepTuple), so the staleness derivation hides a stale
    // proposal on the very next render. One invalidation mechanism, not two.
    setFarmObjective: (kind) => {
      if (get().farmObjective === kind) return;
      set({ farmObjective: kind });
      persistPhasesView(get());
    },

    // Closes the panel when turning on (the settled layout: re-rank mode is for looking at the
    // table); re-opens it when turning back off. Never re-solves either way — an unchanged
    // proposal is simply reused.
    setFarmRespecReRank: (active) => {
      if (get().farmRespecReRank === active) return;
      set({ farmRespecReRank: active, farmRespecPanelOpen: !active });
    },

    setFarmRespecPanelOpen: (open) => {
      if (get().farmRespecPanelOpen === open) return;
      set({ farmRespecPanelOpen: open });
    },
  };
};
