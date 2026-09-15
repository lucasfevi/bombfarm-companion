import type { StateCreator } from 'zustand';
import {
  savePhasesView,
  type PhasesViewState,
  type ReturnBonusMode,
} from '@/shared/lib/phases-view-storage';
import { noTeamAuraSwitches, type TeamAuraId, type TeamAuraSwitches } from '@bombfarm/domain/team-buffs';
import type { PlannerStore } from '@/shared/stores/planner-store';

export type PhasesSlice = {
  phasesViewPhase: number;
  /** `true` once the user has explicitly picked a phase (a click, or a hydrated stored `phase`) —
   *  distinguishes a genuine choice of phase 1 from `phasesViewPhase`'s own unchosen default. */
  phasesViewPhaseChosen: boolean;
  /** Farm Ranking rotation pool override map. */
  farmPoolOverrides: Record<string, boolean>;
  /** Farm Ranking return-bonus estimate — `@bombfarm/domain`'s `ReturnBonusMode` verbatim. */
  farmReturnBonus: ReturnBonusMode;
  /**
   * EPHEMERAL — the planner's Combat tab asking about a phase other than the one the app would
   * choose on its own (`selectCombatPhase`). `null` while no such pick is in force. Never
   * persisted and never written into the phases explorer's own selection: the two are one
   * player's two questions about the same account, and answering one must not re-answer the
   * other.
   */
  plannerPhaseOverride: number | null;
  /**
   * EPHEMERAL — which team auras the Combat tab prices the active hero under at their cap, on top
   * of the hero's own (`computeTeamBuffsAroundHero`). All off on every load, like the phase
   * override beside it: a what-if that outlived the session would inflate every per-hero figure
   * with no control in sight to explain it.
   */
  teamAuraSwitches: TeamAuraSwitches;

  hydratePhasesView: (view: PhasesViewState) => void;
  setPhasesViewPhase: (phase: number) => void;
  /** The board's auto-picked best-gold/hr default — see the action body for the full contract. */
  syncDefaultPhaseSelection: (phase: number) => void;
  setFarmHeroEnabled: (heroId: string, enabled: boolean) => void;
  setFarmReturnBonus: (mode: ReturnBonusMode) => void;
  /** `null` clears the pick and hands the planner back to `selectCombatPhase`'s own answer. */
  setPlannerPhaseOverride: (phase: number | null) => void;
  setTeamAuraSwitch: (buffId: TeamAuraId, enabled: boolean) => void;
  /** "Back to your current phase": drops the phase pick AND every aura switch in one write. */
  clearPlannerWhatIfs: () => void;
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
   *
   * `phase` is omitted while `phasesViewPhaseChosen` is false: writing `phase: 1` for an
   * unchosen selection would make the auto-picked "best map" default indistinguishable from a
   * real choice on the very next unrelated write (e.g. toggling a rotation-pool hero), freezing
   * the user onto phase 1 before the auto-select ever gets to run.
   */
  function persistPhasesView(state: PlannerStore): void {
    savePhasesView({
      ...(state.phasesViewPhaseChosen ? { phase: state.phasesViewPhase } : {}),
      farmPool: state.farmPoolOverrides,
      farmReturnBonus: state.farmReturnBonus,
    });
  }

  return {
    phasesViewPhase: 1,
    phasesViewPhaseChosen: false,
    farmPoolOverrides: {},
    farmReturnBonus: 'off',
    plannerPhaseOverride: null,
    teamAuraSwitches: noTeamAuraSwitches(),

    hydratePhasesView: (view) => {
      set({
        phasesViewPhase: view.phase ?? 1,
        phasesViewPhaseChosen: view.phase != null,
        farmPoolOverrides: view.farmPool ?? {},
        farmReturnBonus: view.farmReturnBonus ?? 'off',
      });
    },

    setPhasesViewPhase: (phase) => {
      const clamped = Math.max(1, Math.min(600, Math.round(phase)));
      const current = get();
      // Not just an equality check on the number: the FIRST explicit pick of the phase the
      // unchosen default already happens to sit on (phase 1) must still flip `chosen` and
      // persist, or clicking phase 1 on a fresh load would silently do nothing.
      if (current.phasesViewPhase === clamped && current.phasesViewPhaseChosen) return;
      set({ phasesViewPhase: clamped, phasesViewPhaseChosen: true });
      persistPhasesView(get());
    },

    /**
     * Writes `phasesViewPhase` so every phase-reading surface — the board's highlighted row and
     * the Phases explorer's seven panels below it — agrees on which map is shown. Deliberately
     * leaves `phasesViewPhaseChosen` false and does NOT persist: the pick stays a derived
     * default that re-syncs to the best map on the next load, rather than hardening into a
     * choice the user never made. A real pick (`setPhasesViewPhase`) always wins from then on.
     */
    syncDefaultPhaseSelection: (phase) => {
      const clamped = Math.max(1, Math.min(600, Math.round(phase)));
      const current = get();
      if (current.phasesViewPhaseChosen || current.phasesViewPhase === clamped) return;
      set({ phasesViewPhase: clamped });
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

    setPlannerPhaseOverride: (phase) => {
      if (get().plannerPhaseOverride === phase) return;
      set({ plannerPhaseOverride: phase });
    },

    setTeamAuraSwitch: (buffId, enabled) => {
      const current = get().teamAuraSwitches;
      if (current[buffId] === enabled) return;
      set({ teamAuraSwitches: { ...current, [buffId]: enabled } });
    },

    clearPlannerWhatIfs: () => {
      const current = get();
      const switched = Object.values(current.teamAuraSwitches).some(Boolean);
      if (current.plannerPhaseOverride === null && !switched) return;
      set({ plannerPhaseOverride: null, teamAuraSwitches: noTeamAuraSwitches() });
    },
  };
};
