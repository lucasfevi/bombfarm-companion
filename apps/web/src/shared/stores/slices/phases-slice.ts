import type { StateCreator } from 'zustand';
import {
  savePhasesView,
  type PhasesViewState,
  type ReturnBonusMode,
} from '@/shared/lib/phases-view-storage';
import type { FarmRespecProposal, FarmRespecStatus } from '@bombfarm/farm';
import { scheduleAfterPaint } from '@/shared/lib/schedule-after-paint';
// Legal intra-element import (boundaries/elements declares one `shared-stores` element covering
// both slices/ and selectors/) — the reverse edge of the same shape already ships in
// team-plan-selectors.ts, which imports from team-plan-slice.ts.
import {
  readFarmRespecDepTuple,
  runFarmRespecSolve,
  selectFarmRespecIsStale,
} from '@/shared/stores/selectors/farm-ranking-selectors';
import type { PlannerStore } from '@/shared/stores/planner-store';

/** Declared in `@bombfarm/farm` beside the view model that reads them, and re-exported here so
 *  this slice stays the import surface its existing consumers already use. The dependency tuple
 *  a `FarmRespecProposal` is keyed by is `readFarmRespecDepTuple`'s return value, compared
 *  element-wise via the selectors module's own `depsEqual`. */
export type { FarmRespecProposal, FarmRespecStatus };

export type PhasesSlice = {
  phasesViewPhase: number;
  /** `true` once the user has explicitly picked a phase (a click, or a hydrated stored `phase`) —
   *  distinguishes a genuine choice of phase 1 from `phasesViewPhase`'s own unchosen default. */
  phasesViewPhaseChosen: boolean;
  /** Farm Ranking rotation pool override map. */
  farmPoolOverrides: Record<string, boolean>;
  /** Farm Ranking return-bonus estimate — `@bombfarm/domain`'s `ReturnBonusMode` verbatim. */
  farmReturnBonus: ReturnBonusMode;
  /** The on-demand Tier 2 result. EPHEMERAL — never persisted (spec Out of scope). */
  farmRespecProposal: FarmRespecProposal | null;
  /** EPHEMERAL. */
  farmRespecStatus: FarmRespecStatus;
  /** EPHEMERAL — the re-rank toggle (the sort/filter precedent). */
  farmRespecReRank: boolean;
  /** EPHEMERAL — lets the player close the panel without turning re-rank on. */
  farmRespecPanelOpen: boolean;

  hydratePhasesView: (view: PhasesViewState) => void;
  setPhasesViewPhase: (phase: number) => void;
  /** The board's auto-picked best-gold/hr default — see the action body for the full contract. */
  syncDefaultPhaseSelection: (phase: number) => void;
  setFarmHeroEnabled: (heroId: string, enabled: boolean) => void;
  setFarmReturnBonus: (mode: ReturnBonusMode) => void;
  setFarmRespecReRank: (active: boolean) => void;
  setFarmRespecPanelOpen: (open: boolean) => void;
  /** Runs Tier 2 on demand, off the render path — see the action body for the full contract. */
  runFarmRespec: () => void;
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
    farmRespecProposal: null,
    farmRespecStatus: 'idle',
    farmRespecReRank: false,
    farmRespecPanelOpen: false,

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

    /**
     * The ONLY caller of `runFarmRespecSolve` — an explicit user event (the Optimize button),
     * never the render path. Synchronous and returns `void`, not `async`: nothing here is I/O,
     * and an `async` handler would return a floating promise into an `onClick`.
     */
    runFarmRespec: () => {
      const state = get();
      // An unchanged, still-fresh proposal is reused: no second solve, just re-open the panel.
      if (state.farmRespecProposal && !selectFarmRespecIsStale(state) && state.farmRespecStatus === 'done') {
        set({ farmRespecPanelOpen: true });
        return;
      }
      if (state.farmRespecStatus === 'solving') return; // no concurrent second run
      set({ farmRespecStatus: 'solving', farmRespecPanelOpen: true });
      scheduleAfterPaint(() => {
        // Read LIVE state inside the scheduled callback, not the `state` captured above — a
        // change during the two-frame yield must key the result to the tuple it actually
        // solved against, never to a tuple read before the yield.
        const live = get();
        try {
          const result = runFarmRespecSolve(live);
          set({
            farmRespecProposal: { deps: readFarmRespecDepTuple(live), result },
            farmRespecStatus: 'done',
          });
        } catch {
          // Caught at THIS boundary only. Item A never throws by contract; this is
          // belt-and-braces, and it renders a NAMED failure state, never an empty panel.
          set({ farmRespecProposal: null, farmRespecStatus: 'failed' });
        }
      });
    },
  };
};
