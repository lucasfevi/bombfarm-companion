import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FORJA_MAX } from '@bombfarm/domain/gear';
import type { InventoryItem } from '@bombfarm/domain/inventory';
import { attachInventoryPersistence } from '@/shared/stores/persistence/persist-inventory';
import { attachGearPlanScopePersistence } from '@/shared/stores/persistence/persist-gear-plan-scope';
import { AUTOSAVE_MS } from '@/shared/stores/persistence/debounced-writer';
import { hydratePlannerStore } from '@/shared/stores/hydrate-planner-store';
import { selectGearPlanIsStale } from '@/shared/stores/selectors/gear-plan-selectors';
import { selectLiveGearPlanInputSignature } from '@/shared/stores/slices/gear-plan-slice';
import { buildDefaultScopeMap } from '@/shared/stores/gear-plan/types';
import { resetPlannerStoreForTests, usePlannerStore } from '@/shared/stores';
import { INVENTORY_KEY } from '@/shared/lib/inventory-storage';
import { GEAR_PLAN_SCOPE_KEY } from '@/shared/lib/gear-plan-scope-storage';

function memoryLocalStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => store.clear(),
  };
}

const sampleItem: InventoryItem = {
  id: '1',
  defId: 'ember_calca',
  rarityIdx: 2,
  level: 10,
  upgrade: 8,
  slot: 'calca',
  equipped: false,
  equippedBy: null,
  defResolved: true,
  marketBlocked: false,
};

function hero(id: string, battleAllowed = true) {
  return {
    id,
    name: id,
    updatedAt: 1,
    rarity: 'Raro' as const,
    level: 20,
    stars: 0,
    naked: {
      attack: 10,
      energy: 10,
      speed: 10,
      critChance: 0,
      critDmg: 10,
      penetration: 0,
      cdr: 0,
      luck: 0,
    },
    loadout: {
      arma: null,
      elmo: null,
      anel: null,
      amuleto: null,
      peito: null,
      calca: null,
      luva: null,
      bota: null,
    },
    altLoadout: null,
    gearedOverride: {
      attack: 10,
      energy: 10,
      speed: 10,
      critChance: 0,
      critDmg: 10,
      penetration: 0,
      cdr: 0,
      luck: 0,
    },
    abilities: {},
    pts: {
      attack: 0,
      energy: 0,
      speed: 0,
      critChance: 0,
      critDmg: 0,
      penetration: 0,
      cdr: 0,
      luck: 0,
    },
    sourceId: id,
    battleAllowed,
  };
}

describe('gear-plan slice', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('localStorage', memoryLocalStorage());
    resetPlannerStoreForTests();
  });

  afterEach(() => {
    resetPlannerStoreForTests();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('defaults battleAllowed false heroes to donate scope', () => {
    const scope = buildDefaultScopeMap([
      { id: 'a', battleAllowed: true },
      { id: 'b', battleAllowed: false },
    ]);
    expect(scope).toEqual({ a: 'optimize', b: 'donate' });
  });

  it('hydrateInventory loads snapshot and forge floor', () => {
    usePlannerStore.getState().hydrateRoster([hero('a')], 'a');
    usePlannerStore.getState().hydrateInventory(
      { version: 1, importedAt: 5, items: [sampleItem] },
      12,
    );
    const state = usePlannerStore.getState();
    expect(state.inventory.items).toEqual([sampleItem]);
    expect(state.forgeFloor).toBe(12);
    expect(state.scopeByHeroId.a).toBe('optimize');
  });

  it('replaceInventoryFromImport clears plan state', () => {
    usePlannerStore.setState({ planInputSignature: 'old', runStatus: 'done', runId: '1' });
    usePlannerStore.getState().replaceInventoryFromImport([sampleItem]);
    const state = usePlannerStore.getState();
    expect(state.inventory.items).toEqual([sampleItem]);
    expect(state.plan).toBeNull();
    expect(state.planInputSignature).toBeNull();
    expect(state.runStatus).toBe('idle');
    expect(state.runId).toBeNull();
  });

  it('setScope no-op preserves scope map identity', () => {
    usePlannerStore.getState().hydrateRoster([hero('a')], 'a');
    usePlannerStore.getState().hydrateInventory({ version: 1, importedAt: 0, items: [] }, 10);
    const before = usePlannerStore.getState().scopeByHeroId;
    usePlannerStore.getState().setScope('a', 'optimize');
    expect(usePlannerStore.getState().scopeByHeroId).toBe(before);
  });

  it('setScope updates scope for a hero', () => {
    usePlannerStore.getState().hydrateRoster([hero('a')], 'a');
    usePlannerStore.getState().hydrateInventory({ version: 1, importedAt: 0, items: [] }, 10);
    usePlannerStore.getState().setScope('a', 'leaveAlone');
    expect(usePlannerStore.getState().scopeByHeroId.a).toBe('leaveAlone');
  });

  it('hydrateScope merges persisted choices over the battleAllowed defaults', () => {
    usePlannerStore.getState().hydrateRoster([hero('a'), hero('b'), hero('c', false)], 'a');
    usePlannerStore.getState().hydrateInventory({ version: 1, importedAt: 0, items: [] }, 10);
    usePlannerStore.getState().hydrateScope({ a: 'donate', b: 'leaveAlone' });
    const state = usePlannerStore.getState();
    expect(state.scopeByHeroId).toEqual({ a: 'donate', b: 'leaveAlone', c: 'donate' });
  });

  it('hydrateScope ignores persisted entries for heroes no longer on the roster', () => {
    usePlannerStore.getState().hydrateRoster([hero('a')], 'a');
    usePlannerStore.getState().hydrateInventory({ version: 1, importedAt: 0, items: [] }, 10);
    usePlannerStore.getState().hydrateScope({ a: 'leaveAlone', ghost: 'donate' });
    expect(usePlannerStore.getState().scopeByHeroId).toEqual({ a: 'leaveAlone' });
  });

  it('setForgeFloor clamps to 0…FORJA_MAX', () => {
    usePlannerStore.getState().setForgeFloor(99);
    expect(usePlannerStore.getState().forgeFloor).toBe(FORJA_MAX);
    usePlannerStore.getState().setForgeFloor(-1);
    expect(usePlannerStore.getState().forgeFloor).toBe(0);
  });

  it('setForgeFloor no-op when value unchanged', () => {
    usePlannerStore.getState().setForgeFloor(10);
    const before = usePlannerStore.getState().forgeFloor;
    usePlannerStore.getState().setForgeFloor(10);
    expect(usePlannerStore.getState().forgeFloor).toBe(before);
  });

  it('startRun and resolveRun track run id', () => {
    usePlannerStore.getState().startRun('run-1');
    expect(usePlannerStore.getState().runStatus).toBe('running');
    usePlannerStore.getState().resolveRun('run-1', 'done');
    expect(usePlannerStore.getState().runStatus).toBe('done');
    usePlannerStore.getState().resolveRun('stale', 'error');
    expect(usePlannerStore.getState().runStatus).toBe('done');
  });

  it('clearPlan resets plan markers', () => {
    usePlannerStore.setState({ planInputSignature: 'sig', runId: '1', runStatus: 'done' });
    usePlannerStore.getState().clearPlan();
    expect(usePlannerStore.getState().planInputSignature).toBeNull();
    expect(usePlannerStore.getState().runId).toBeNull();
    expect(usePlannerStore.getState().runStatus).toBe('idle');
  });

  it('clearPlan resets a running search with no plan yet', () => {
    usePlannerStore.setState({ plan: null, planInputSignature: null, runId: 'run-cancel', runStatus: 'running' });
    usePlannerStore.getState().clearPlan();
    expect(usePlannerStore.getState().runId).toBeNull();
    expect(usePlannerStore.getState().runStatus).toBe('idle');
  });

  it('selectGearPlanIsStale is false without a stored signature', () => {
    expect(selectGearPlanIsStale(usePlannerStore.getState())).toBe(false);
  });

  it('selectGearPlanIsStale becomes true when inputs drift', () => {
    usePlannerStore.getState().hydrateRoster([hero('a')], 'a');
    usePlannerStore.getState().hydrateInventory({ version: 1, importedAt: 1, items: [] }, 10);
    const signature = selectLiveGearPlanInputSignature(usePlannerStore.getState());
    usePlannerStore.setState({ planInputSignature: signature });
    usePlannerStore.getState().setForgeFloor(11);
    expect(selectGearPlanIsStale(usePlannerStore.getState())).toBe(true);
  });

  it('hydratePlannerStore loads inventory without writing on a clean load', () => {
    localStorage.setItem(
      'bf-hp-heroes-v1',
      JSON.stringify([hero('a')]),
    );
    localStorage.setItem('bf-hp-active-hero-v1', JSON.stringify('a'));
    localStorage.setItem(
      'bf-hp-account-v1',
      JSON.stringify({
        tree: {
          danoTotal: 1,
          critChance: 0,
          critDmg: 0,
          speed: 0,
          energy: 0,
          teamCoinPct: 0,
          glassCannon: false,
          tempoDobrado: false,
        },
        teamBuffs: {},
        context: {
          houseIdx: 0,
          houseLevel: 1,
          phase: null,
          mitigationPct: 1,
          rankMode: 'dps',
          targetProp: 'stone',
        },
        forgeFloor: 10,
      }),
    );
    localStorage.setItem(
      INVENTORY_KEY,
      JSON.stringify({ version: 1, importedAt: 7, items: [sampleItem] }),
    );
    const setItem = vi.spyOn(localStorage, 'setItem');
    hydratePlannerStore();
    expect(usePlannerStore.getState().inventory.items).toEqual([sampleItem]);
    expect(setItem).not.toHaveBeenCalled();
  });

  it('inventory persistence writes after boot and debounce', () => {
    const detach = attachInventoryPersistence(usePlannerStore);
    usePlannerStore.getState().setBooted(true);
    usePlannerStore.getState().replaceInventoryFromImport([sampleItem]);
    vi.advanceTimersByTime(AUTOSAVE_MS);
    expect(localStorage.getItem(INVENTORY_KEY)).toBeTruthy();
    detach();
  });

  it('inventory persistence does not write before boot', () => {
    attachInventoryPersistence(usePlannerStore);
    usePlannerStore.getState().replaceInventoryFromImport([sampleItem]);
    vi.advanceTimersByTime(AUTOSAVE_MS);
    expect(localStorage.getItem(INVENTORY_KEY)).toBeNull();
  });

  it('gear-plan scope persists after boot and debounce', () => {
    usePlannerStore.getState().hydrateRoster([hero('a')], 'a');
    const detach = attachGearPlanScopePersistence(usePlannerStore);
    usePlannerStore.getState().setBooted(true);
    usePlannerStore.getState().setScope('a', 'leaveAlone');
    vi.advanceTimersByTime(AUTOSAVE_MS);
    expect(JSON.parse(localStorage.getItem(GEAR_PLAN_SCOPE_KEY) ?? '{}')).toEqual({
      a: 'leaveAlone',
    });
    detach();
  });

  it('gear-plan scope persistence does not write before boot', () => {
    usePlannerStore.getState().hydrateRoster([hero('a')], 'a');
    attachGearPlanScopePersistence(usePlannerStore);
    usePlannerStore.getState().setScope('a', 'leaveAlone');
    vi.advanceTimersByTime(AUTOSAVE_MS);
    expect(localStorage.getItem(GEAR_PLAN_SCOPE_KEY)).toBeNull();
  });

  it('a reload restores a scope choice made before the previous reload', () => {
    localStorage.setItem('bf-hp-heroes-v1', JSON.stringify([hero('a')]));
    localStorage.setItem('bf-hp-active-hero-v1', JSON.stringify('a'));
    localStorage.setItem(GEAR_PLAN_SCOPE_KEY, JSON.stringify({ a: 'leaveAlone' }));
    hydratePlannerStore();
    expect(usePlannerStore.getState().scopeByHeroId.a).toBe('leaveAlone');
  });
});
