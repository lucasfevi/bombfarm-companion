import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadPhasesView } from '@/shared/lib/phases-view-storage';
import { resetPlannerStoreForTests, usePlannerStore } from '@/shared/stores';
import type { FarmRespecProposal } from '@/shared/stores/slices/phases-slice';

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

describe('phases slice', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryLocalStorage());
    resetPlannerStoreForTests();
  });

  afterEach(() => {
    resetPlannerStoreForTests();
    vi.unstubAllGlobals();
  });

  it('clamps setPhasesViewPhase to 1–600 and writes through', () => {
    usePlannerStore.getState().setPhasesViewPhase(0);
    expect(usePlannerStore.getState().phasesViewPhase).toBe(1);
    expect(loadPhasesView().phase).toBe(1);

    usePlannerStore.getState().setPhasesViewPhase(999);
    expect(usePlannerStore.getState().phasesViewPhase).toBe(600);
    expect(loadPhasesView().phase).toBe(600);

    usePlannerStore.getState().setPhasesViewPhase(42);
    expect(usePlannerStore.getState().phasesViewPhase).toBe(42);
    expect(loadPhasesView().phase).toBe(42);
  });

  it('hydratePhasesView does not write', () => {
    usePlannerStore.getState().hydratePhasesView({ phase: 88 });
    expect(usePlannerStore.getState().phasesViewPhase).toBe(88);
    expect(localStorage.getItem('bf-hp-phases-view-v1')).toBeNull();
  });

  it('hydratePhasesView restores farmPool and farmReturnBonus, defaulting absent fields', () => {
    usePlannerStore
      .getState()
      .hydratePhasesView({ phase: 5, farmPool: { 'hero-1': false }, farmReturnBonus: 'vip' });
    expect(usePlannerStore.getState().farmPoolOverrides).toEqual({ 'hero-1': false });
    expect(usePlannerStore.getState().farmReturnBonus).toBe('vip');

    usePlannerStore.getState().hydratePhasesView({ phase: 6 });
    expect(usePlannerStore.getState().farmPoolOverrides).toEqual({});
    expect(usePlannerStore.getState().farmReturnBonus).toBe('off');
  });

  // Whole-state writer — red against the shipped implementation before this feature: the old
  // savePhasesView({ phase: clamped }) call site silently erased any second persisted field.
  it('a pool override survives a later setPhasesViewPhase call (whole-state writer)', () => {
    usePlannerStore.getState().setFarmHeroEnabled('hero-1', false);
    usePlannerStore.getState().setPhasesViewPhase(151);

    expect(loadPhasesView().farmPool).toEqual({ 'hero-1': false });
    expect(loadPhasesView().phase).toBe(151);
  });

  it('the return bonus survives a later setPhasesViewPhase call (whole-state writer)', () => {
    usePlannerStore.getState().setFarmReturnBonus('vip');
    usePlannerStore.getState().setPhasesViewPhase(42);

    expect(loadPhasesView().farmReturnBonus).toBe('vip');
    expect(loadPhasesView().phase).toBe(42);
  });

  it('setFarmHeroEnabled persists additively and is a no-op write when unchanged', () => {
    usePlannerStore.getState().setFarmHeroEnabled('hero-1', true);
    expect(usePlannerStore.getState().farmPoolOverrides).toEqual({ 'hero-1': true });
    expect(loadPhasesView().farmPool).toEqual({ 'hero-1': true });

    const before = usePlannerStore.getState().farmPoolOverrides;
    usePlannerStore.getState().setFarmHeroEnabled('hero-1', true);
    expect(usePlannerStore.getState().farmPoolOverrides).toBe(before);
  });

  it('setFarmReturnBonus persists and is a no-op write when unchanged', () => {
    usePlannerStore.getState().setFarmReturnBonus('on');
    expect(usePlannerStore.getState().farmReturnBonus).toBe('on');
    expect(loadPhasesView().farmReturnBonus).toBe('on');

    usePlannerStore.getState().setFarmReturnBonus('on');
    expect(usePlannerStore.getState().farmReturnBonus).toBe('on');
  });

  // Farm Respec Advisor T3: the objective, the proposal, and the status machine.
  describe('farm respec slice fields (T3)', () => {
    it('initializes farmObjective to gold and every ephemeral field to its idle value', () => {
      const state = usePlannerStore.getState();
      expect(state.farmObjective).toBe('gold');
      expect(state.farmRespecProposal).toBeNull();
      expect(state.farmRespecStatus).toBe('idle');
      expect(state.farmRespecReRank).toBe(false);
      expect(state.farmRespecPanelOpen).toBe(false);
    });

    it('hydratePhasesView restores farmObjective, defaulting an absent value to gold', () => {
      usePlannerStore.getState().hydratePhasesView({ phase: 5, farmObjective: 'chests' });
      expect(usePlannerStore.getState().farmObjective).toBe('chests');

      usePlannerStore.getState().hydratePhasesView({ phase: 6 });
      expect(usePlannerStore.getState().farmObjective).toBe('gold');
    });

    it('setFarmObjective persists and is a no-op write when unchanged', () => {
      usePlannerStore.getState().setFarmObjective('blend');
      expect(usePlannerStore.getState().farmObjective).toBe('blend');
      expect(loadPhasesView().farmObjective).toBe('blend');

      usePlannerStore.getState().setFarmObjective('blend');
      expect(usePlannerStore.getState().farmObjective).toBe('blend');
    });

    it('setFarmObjective persists through the whole-state composer without erasing pool, return bonus or phase', () => {
      usePlannerStore.getState().setFarmHeroEnabled('hero-1', false);
      usePlannerStore.getState().setFarmReturnBonus('vip');
      usePlannerStore.getState().setFarmObjective('chests');
      usePlannerStore.getState().setPhasesViewPhase(151);

      const persisted = loadPhasesView();
      expect(persisted.farmPool).toEqual({ 'hero-1': false });
      expect(persisted.farmReturnBonus).toBe('vip');
      expect(persisted.farmObjective).toBe('chests');
      expect(persisted.phase).toBe(151);
    });

    it('the persisted payload never carries the four ephemeral fields', () => {
      usePlannerStore.getState().setFarmObjective('chests');
      const raw = JSON.parse(localStorage.getItem('bf-hp-phases-view-v1')!) as Record<string, unknown>;
      expect(Object.keys(raw).sort()).toEqual(['farmObjective', 'farmPool', 'farmReturnBonus', 'phase']);
    });

    it('setFarmObjective does NOT clear an existing farmRespecProposal — invalidation is the staleness derivation\'s job', () => {
      const sentinelProposal: FarmRespecProposal = {
        deps: [1, 2, 3],
        result: {} as FarmRespecProposal['result'],
      };
      usePlannerStore.setState({ farmRespecProposal: sentinelProposal, farmRespecStatus: 'done' });
      usePlannerStore.getState().setFarmObjective('blend');
      expect(usePlannerStore.getState().farmRespecProposal).toBe(sentinelProposal);
      expect(usePlannerStore.getState().farmRespecStatus).toBe('done');
    });

    it('setFarmRespecReRank(true) closes the panel; setting it back to false re-opens the panel', () => {
      usePlannerStore.getState().setFarmRespecPanelOpen(true);
      usePlannerStore.getState().setFarmRespecReRank(true);
      expect(usePlannerStore.getState().farmRespecReRank).toBe(true);
      expect(usePlannerStore.getState().farmRespecPanelOpen).toBe(false);

      usePlannerStore.getState().setFarmRespecReRank(false);
      expect(usePlannerStore.getState().farmRespecReRank).toBe(false);
      expect(usePlannerStore.getState().farmRespecPanelOpen).toBe(true);
    });

    it('setFarmRespecReRank is a no-op write when unchanged', () => {
      usePlannerStore.getState().setFarmRespecReRank(true);
      usePlannerStore.getState().setFarmRespecPanelOpen(true);
      usePlannerStore.getState().setFarmRespecReRank(true);
      // The panel-open flip from the first call is not repeated on the no-op second call.
      expect(usePlannerStore.getState().farmRespecPanelOpen).toBe(true);
    });

    it('setFarmRespecPanelOpen toggles independently and is a no-op write when unchanged', () => {
      usePlannerStore.getState().setFarmRespecPanelOpen(true);
      expect(usePlannerStore.getState().farmRespecPanelOpen).toBe(true);
      usePlannerStore.getState().setFarmRespecPanelOpen(true);
      expect(usePlannerStore.getState().farmRespecPanelOpen).toBe(true);
      usePlannerStore.getState().setFarmRespecPanelOpen(false);
      expect(usePlannerStore.getState().farmRespecPanelOpen).toBe(false);
    });
  });
});
