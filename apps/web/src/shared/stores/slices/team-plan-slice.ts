import type { StateCreator } from 'zustand';
import type { InventoryItem } from '@bombfarm/domain/inventory';
import { normalizeInventorySnapshot } from '@bombfarm/domain/inventory';
import { applyTeamPlanControlChange, type TeamPlanControlChange } from '@bombfarm/team-plan/core';
import type { HeroRecord } from '@/shared/lib/storage';
import type { PlannerStore } from '@/shared/stores/planner-store';
import type {
  TeamPlan,
  TeamPlanRunStatus,
  InventorySnapshot,
  ScopeState,
} from '@/shared/stores/team-plan/types';
import type {
  TeamPlan as DomainTeamPlan,
  TeamPlanAllowedChanges,
  TeamPlanObjective,
} from '@bombfarm/domain/team-plan/types';
import {
  buildDefaultScopeMap,
  clampForgeFloor,
  computeTeamPlanInputSignature,
  DEFAULT_TEAM_PLAN_ALLOWED_CHANGES,
  DEFAULT_TEAM_PLAN_OBJECTIVE,
  mergeScopeForRoster,
} from '@/shared/stores/team-plan/types';
// Legal intra-element import (boundaries/elements declares one `shared-stores` element covering
// both slices/ and selectors/) — the reverse edge of the same shape already ships in
// phases-slice.ts, which imports from farm-ranking-selectors.ts.
import {
  selectTeamPlanControls,
  selectTeamPlanInputs,
} from '@/shared/stores/selectors/team-plan-selectors';

const EMPTY_INVENTORY: InventorySnapshot = { version: 1, importedAt: 0, items: [] };

export type TeamPlanSlice = {
  inventory: InventorySnapshot;
  scopeByHeroId: Record<string, ScopeState>;
  forgeFloor: number;
  objective: TeamPlanObjective;
  /** Which kinds of change the plan may propose — gear work, stat-point resets, or both. A
   *  different axis from `scopeByHeroId`, which decides WHICH HEROES the search may touch. */
  allowedChanges: TeamPlanAllowedChanges;
  /** Score as if the field always had room, and keep every hero geared. A deliberate
   *  mis-pricing the player opts into — see the domain field of the same name. */
  ignoreFieldCrowding: boolean;
  /** The phase both objectives score at, or `null` for the objective's own default. Read through
   *  `selectTeamPlanTargetPhase`, never directly — it is a default until `targetPhaseChosen`. */
  targetPhase: number | null;
  /** `true` once the player has picked from the phase control, None included — the same
   *  choice-vs-default split `phasesViewPhaseChosen` makes on the Farm tab. */
  targetPhaseChosen: boolean;
  runStatus: TeamPlanRunStatus;
  runId: string | null;
  plan: TeamPlan;
  planInputSignature: string | null;
  /** The roster the run was solved from, frozen at startRun: the result rows name these heroes,
   *  not whatever the roster holds by the time they are read. */
  planHeroes: readonly HeroRecord[] | null;
  /** The result rows the player has opened; `null` is the default (the first hero), which every
   *  new plan starts from. Lives here so a route change does not close them. */
  openHeroIds: readonly string[] | null;

  hydrateInventory: (snapshot: InventorySnapshot, forgeFloor: number) => void;
  hydrateScope: (persisted: Record<string, ScopeState>) => void;
  replaceInventoryFromImport: (items: InventoryItem[]) => void;
  setScope: (heroId: string, scope: ScopeState) => void;
  setForgeFloor: (value: number) => void;
  setObjective: (value: TeamPlanObjective) => void;
  setAllowedChanges: (value: TeamPlanAllowedChanges) => void;
  setIgnoreFieldCrowding: (value: boolean) => void;
  setTargetPhase: (value: number | null) => void;
  startRun: (runId: string) => void;
  resolveRun: (runId: string, status: Exclude<TeamPlanRunStatus, 'running'>) => void;
  applyPlan: (runId: string, plan: DomainTeamPlan) => void;
  clearPlan: () => void;
  setOpenHeroIds: (heroIds: readonly string[]) => void;
  syncScopeForRoster: () => void;
};

function scopeMapsEqual(
  left: Record<string, ScopeState>,
  right: Record<string, ScopeState>,
): boolean {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every((key) => left[key] === right[key]);
}

const CLEARED_PLAN = {
  plan: null,
  planInputSignature: null,
  runStatus: 'idle',
  runId: null,
  planHeroes: null,
  openHeroIds: null,
} as const;

export const createTeamPlanSlice: StateCreator<
  PlannerStore,
  [['zustand/subscribeWithSelector', never]],
  [],
  TeamPlanSlice
> = (set, get) => {
  // Every setter that reshapes the search rather than shifting its numbers routes through here:
  // the classification (no-op / clamp / clear-versus-stale) lives in the package, this slice
  // restates none of it.
  const applyChange = (change: TeamPlanControlChange) => {
    const state = get();
    const inputs = selectTeamPlanInputs(state);
    const next = applyTeamPlanControlChange(selectTeamPlanControls(state), change, {
      heroes: inputs.heroes,
      farmChosenPhase: inputs.farmChosenPhase,
      phase: inputs.phase,
    });
    if (!next) return;
    set({ ...next.controls, ...(next.clearsPlan ? CLEARED_PLAN : {}) });
  };

  return {
    inventory: EMPTY_INVENTORY,
    scopeByHeroId: {},
    forgeFloor: 10,
    objective: DEFAULT_TEAM_PLAN_OBJECTIVE,
    allowedChanges: DEFAULT_TEAM_PLAN_ALLOWED_CHANGES,
    ignoreFieldCrowding: false,
    targetPhase: null,
    targetPhaseChosen: false,
    runStatus: 'idle',
    runId: null,
    plan: null,
    planInputSignature: null,
    planHeroes: null,
    openHeroIds: null,

    hydrateInventory: (snapshot, forgeFloor) => {
      const normalized = normalizeInventorySnapshot(snapshot);
      const clampedFloor = clampForgeFloor(forgeFloor);
      const scopeByHeroId = buildDefaultScopeMap(get().heroes);
      set({
        inventory: normalized,
        forgeFloor: clampedFloor,
        scopeByHeroId,
        ...CLEARED_PLAN,
      });
    },

    // Merges persisted scope choices over the battleAllowed-derived defaults, for heroes still on
    // the roster. Runs once at boot, after `hydrateInventory` has already set the defaults —
    // without this, a page reload silently forgot every Donate/Leave alone choice.
    hydrateScope: (persisted) => {
      set({ scopeByHeroId: mergeScopeForRoster(get().heroes, persisted) });
    },

    replaceInventoryFromImport: (items) => {
      const snapshot: InventorySnapshot = {
        version: 1,
        importedAt: Date.now(),
        items: [...items],
      };
      set({ inventory: snapshot, ...CLEARED_PLAN });
    },

    setScope: (heroId, scope) => applyChange({ kind: 'scope', heroId, scope }),
    setForgeFloor: (value) => applyChange({ kind: 'forgeFloor', value }),
    setObjective: (value) => applyChange({ kind: 'objective', value }),
    setAllowedChanges: (value) => applyChange({ kind: 'allowedChanges', value }),
    setIgnoreFieldCrowding: (value) => applyChange({ kind: 'ignoreFieldCrowding', value }),
    setTargetPhase: (value) => applyChange({ kind: 'targetPhase', value }),

    startRun: (runId) => {
      if (get().runId === runId && get().runStatus === 'running') return;
      set({ runId, runStatus: 'running', planHeroes: selectTeamPlanInputs(get()).heroes });
    },

    resolveRun: (runId, status) => {
      if (get().runId !== runId) return;
      set({ runStatus: status });
    },

    applyPlan: (runId, plan) => {
      if (get().runId !== runId) return;
      set({
        plan,
        planInputSignature: selectLiveTeamPlanInputSignature(get()),
        runStatus: 'done',
        runId,
        openHeroIds: null,
      });
    },

    clearPlan: () => {
      if (
        get().plan === null &&
        get().planInputSignature === null &&
        get().runStatus === 'idle' &&
        get().runId === null &&
        get().planHeroes === null &&
        get().openHeroIds === null
      ) {
        return;
      }
      set(CLEARED_PLAN);
    },

    setOpenHeroIds: (heroIds) => {
      set({ openHeroIds: [...heroIds] });
    },

    // Keep prior per-hero choices; seed defaults only for heroes missing from the map (import /
    // roster churn). Never wipe Donate/Leave alone back to battleAllowed defaults.
    syncScopeForRoster: () => {
      const next = mergeScopeForRoster(get().heroes, get().scopeByHeroId);
      if (scopeMapsEqual(get().scopeByHeroId, next)) return;
      set({ scopeByHeroId: next });
    },
  };
};

export function selectLiveTeamPlanInputSignature(state: PlannerStore): string {
  return computeTeamPlanInputSignature(selectTeamPlanInputs(state), selectTeamPlanControls(state));
}
