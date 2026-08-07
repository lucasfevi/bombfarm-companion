import type { StateCreator } from 'zustand';
import type { InventoryItem } from '@bombfarm/domain/inventory';
import { normalizeInventorySnapshot } from '@bombfarm/domain/inventory';
import type { PlannerStore } from '@/shared/stores/planner-store';
import type {
  GearPlan,
  GearPlanRunStatus,
  InventorySnapshot,
  ScopeState,
} from '@/shared/stores/gear-plan/types';
import type { GearPlan as DomainGearPlan } from '@bombfarm/domain/gear-plan/types';
import {
  buildDefaultScopeMap,
  clampForgeFloor,
  computeGearPlanInputSignature,
} from '@/shared/stores/gear-plan/types';

const EMPTY_INVENTORY: InventorySnapshot = { version: 1, importedAt: 0, items: [] };

export type GearPlanSlice = {
  inventory: InventorySnapshot;
  scopeByHeroId: Record<string, ScopeState>;
  forgeFloor: number;
  runStatus: GearPlanRunStatus;
  runId: string | null;
  plan: GearPlan;
  planInputSignature: string | null;

  hydrateInventory: (snapshot: InventorySnapshot, forgeFloor: number) => void;
  replaceInventoryFromImport: (items: InventoryItem[]) => void;
  setScope: (heroId: string, scope: ScopeState) => void;
  setForgeFloor: (value: number) => void;
  startRun: (runId: string) => void;
  resolveRun: (runId: string, status: Exclude<GearPlanRunStatus, 'running'>) => void;
  applyPlan: (runId: string, plan: DomainGearPlan) => void;
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

export const createGearPlanSlice: StateCreator<
  PlannerStore,
  [['zustand/subscribeWithSelector', never]],
  [],
  GearPlanSlice
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

  setScope: (heroId, scope) => {
    const current = get().scopeByHeroId[heroId];
    if (current === scope) return;
    set({ scopeByHeroId: { ...get().scopeByHeroId, [heroId]: scope } });
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
      planInputSignature: selectLiveGearPlanInputSignature(get()),
      runStatus: 'done',
      runId,
    });
  },

  clearPlan: () => {
    if (get().plan === null && get().planInputSignature === null) return;
    set({ plan: null, planInputSignature: null, runStatus: 'idle', runId: null });
  },

  syncScopeForRoster: () => {
    const next = buildDefaultScopeMap(get().heroes);
    if (scopeMapsEqual(get().scopeByHeroId, next)) return;
    set({ scopeByHeroId: next });
  },
});

export function selectLiveGearPlanInputSignature(state: PlannerStore): string {
  return computeGearPlanInputSignature({
    heroes: state.heroes,
    inventory: state.inventory,
    scopeByHeroId: state.scopeByHeroId,
    forgeFloor: state.forgeFloor,
    slots: state.slots,
    treeDanoTotal: state.treeDanoTotal,
    houseIdx: state.houseIdx,
  });
}
