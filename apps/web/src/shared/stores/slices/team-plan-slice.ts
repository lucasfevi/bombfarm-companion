import type { StateCreator } from 'zustand';
import type { InventoryItem } from '@bombfarm/domain/inventory';
import { normalizeInventorySnapshot } from '@bombfarm/domain/inventory';
import type { PlannerStore } from '@/shared/stores/planner-store';
import type {
  TeamPlan,
  TeamPlanRunStatus,
  InventorySnapshot,
  ScopeState,
} from '@/shared/stores/team-plan/types';
import type { TeamPlan as DomainTeamPlan } from '@bombfarm/domain/team-plan/types';
import {
  buildDefaultScopeMap,
  clampForgeFloor,
  computeTeamPlanInputSignature,
  mergeScopeForRoster,
} from '@/shared/stores/team-plan/types';

const EMPTY_INVENTORY: InventorySnapshot = { version: 1, importedAt: 0, items: [] };

export type TeamPlanSlice = {
  inventory: InventorySnapshot;
  scopeByHeroId: Record<string, ScopeState>;
  forgeFloor: number;
  runStatus: TeamPlanRunStatus;
  runId: string | null;
  plan: TeamPlan;
  planInputSignature: string | null;

  hydrateInventory: (snapshot: InventorySnapshot, forgeFloor: number) => void;
  hydrateScope: (persisted: Record<string, ScopeState>) => void;
  replaceInventoryFromImport: (items: InventoryItem[]) => void;
  setScope: (heroId: string, scope: ScopeState) => void;
  setForgeFloor: (value: number) => void;
  startRun: (runId: string) => void;
  resolveRun: (runId: string, status: Exclude<TeamPlanRunStatus, 'running'>) => void;
  applyPlan: (runId: string, plan: DomainTeamPlan) => void;
  clearPlan: () => void;
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

export const createTeamPlanSlice: StateCreator<
  PlannerStore,
  [['zustand/subscribeWithSelector', never]],
  [],
  TeamPlanSlice
> = (set, get) => ({
  inventory: EMPTY_INVENTORY,
  scopeByHeroId: {},
  forgeFloor: 10,
  runStatus: 'idle',
  runId: null,
  plan: null,
  planInputSignature: null,

  hydrateInventory: (snapshot, forgeFloor) => {
    const normalized = normalizeInventorySnapshot(snapshot);
    const clampedFloor = clampForgeFloor(forgeFloor);
    const scopeByHeroId = buildDefaultScopeMap(get().heroes);
    set({
      inventory: normalized,
      forgeFloor: clampedFloor,
      scopeByHeroId,
      plan: null,
      planInputSignature: null,
      runStatus: 'idle',
      runId: null,
    });
  },

  // Merges persisted scope choices over the battleAllowed-derived defaults, for heroes still on
  // the roster. Runs once at boot, after `hydrateInventory` has already set the defaults — without
  // this, a page reload silently forgot every Donate/Leave alone choice.
  hydrateScope: (persisted) => {
    set({ scopeByHeroId: mergeScopeForRoster(get().heroes, persisted) });
  },

  replaceInventoryFromImport: (items) => {
    const snapshot: InventorySnapshot = {
      version: 1,
      importedAt: Date.now(),
      items: [...items],
    };
    set({
      inventory: snapshot,
      plan: null,
      planInputSignature: null,
      runStatus: 'idle',
      runId: null,
    });
  },

  // Clears any existing plan outright rather than just marking it stale: scope moves a hero
  // in or out of the search entirely, so the last plan's per-hero rows, proposed items, and
  // battle load can reference a hero that's no longer in scope. A "stale" banner over that is
  // misleading — it reads as "still counted" — so this matches hydrateInventory's pattern of
  // clearing outright on inputs that reshape the problem, not just shift its numbers.
  // Always rewrite the *full* roster map (defaults + prior choices + this move). A partial
  // map left Donate-looking heroes (UI default) as Optimize in the solver input.
  setScope: (heroId, scope) => {
    const heroes = get().heroes;
    const previous = get().scopeByHeroId;
    const previousResolved = mergeScopeForRoster(heroes, previous);
    const next = { ...previousResolved, [heroId]: scope };
    if (scopeMapsEqual(previous, next)) return;
    const assignmentChanged = previousResolved[heroId] !== scope;
    set({
      scopeByHeroId: next,
      ...(assignmentChanged
        ? { plan: null, planInputSignature: null, runStatus: 'idle' as const, runId: null }
        : {}),
    });
  },

  setForgeFloor: (value) => {
    const next = clampForgeFloor(value);
    if (get().forgeFloor === next) return;
    set({ forgeFloor: next });
  },

  startRun: (runId) => {
    if (get().runId === runId && get().runStatus === 'running') return;
    set({ runId, runStatus: 'running' });
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
    });
  },

  clearPlan: () => {
    if (
      get().plan === null &&
      get().planInputSignature === null &&
      get().runStatus === 'idle' &&
      get().runId === null
    ) {
      return;
    }
    set({ plan: null, planInputSignature: null, runStatus: 'idle', runId: null });
  },

  // Keep prior per-hero choices; seed defaults only for heroes missing from the map (import /
  // roster churn). Never wipe Donate/Leave alone back to battleAllowed defaults.
  syncScopeForRoster: () => {
    const next = mergeScopeForRoster(get().heroes, get().scopeByHeroId);
    if (scopeMapsEqual(get().scopeByHeroId, next)) return;
    set({ scopeByHeroId: next });
  },
});

export function selectLiveTeamPlanInputSignature(state: PlannerStore): string {
  return computeTeamPlanInputSignature({
    heroes: state.heroes,
    inventory: state.inventory,
    scopeByHeroId: state.scopeByHeroId,
    forgeFloor: state.forgeFloor,
    slots: state.slots,
    treeDanoTotal: state.treeDanoTotal,
    houseIdx: state.houseIdx,
    houseCycleSecs: state.houseCycleSecs,
  });
}
