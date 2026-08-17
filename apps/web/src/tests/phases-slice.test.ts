import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyLoadout } from '@bombfarm/domain/gear';
import { ZERO_PTS } from '@bombfarm/domain/planner-constants';
import { loadPhasesView } from '@/shared/lib/phases-view-storage';
import { normalizeHero } from '@/shared/lib/storage';
import { resetPlannerStoreForTests, usePlannerStore } from '@/shared/stores';
import {
  readFarmRespecDepTuple,
  runFarmRespecSolve,
  selectFarmRespecIsStale,
} from '@/shared/stores/selectors/farm-ranking-selectors';
import type { FarmRespecProposal } from '@/shared/stores/slices/phases-slice';

vi.mock('@/shared/stores/selectors/farm-ranking-selectors', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/shared/stores/selectors/farm-ranking-selectors')>();
  // Only runFarmRespecSolve is ever mocked (per-test, via mockImplementationOnce) to prove the
  // named-failure-state path when a solve throws. Every other export passes through to the real
  // implementation, including for every OTHER test in this file.
  return { ...actual, runFarmRespecSolve: vi.fn(actual.runFarmRespecSolve) };
});

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

function farmHero(id: string) {
  return normalizeHero({
    id,
    name: `Hero ${id}`,
    sourceId: `src-${id}`,
    updatedAt: 1,
    rarity: 'Raro',
    level: 10,
    stars: 1,
    naked: { attack: 100, energy: 100, speed: 50, critChance: 0, critDmg: 10, penetration: 0, cdr: 0, luck: 0 },
    gearedOverride: {
      attack: 100,
      energy: 100,
      speed: 50,
      critChance: 0,
      critDmg: 10,
      penetration: 0,
      cdr: 0,
      luck: 0,
    },
    loadout: emptyLoadout(),
    pts: ZERO_PTS(),
    battleAllowed: true,
  });
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

  // Farm Respec Advisor T5: the on-demand solve action.
  describe('runFarmRespec', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      usePlannerStore.getState().hydrateRoster([farmHero('a')], null);
    });

    afterEach(() => {
      vi.clearAllTimers();
      vi.useRealTimers();
      // mockImplementationOnce (used only by the injected-throw test) self-reverts to the base
      // implementation after one call; this just resets call counts between tests.
      vi.mocked(runFarmRespecSolve).mockClear();
    });

    it('sets status solving and opens the panel synchronously, then resolves to done with a fresh proposal after the paint yield', () => {
      usePlannerStore.getState().runFarmRespec();
      expect(usePlannerStore.getState().farmRespecStatus).toBe('solving');
      expect(usePlannerStore.getState().farmRespecPanelOpen).toBe(true);
      expect(usePlannerStore.getState().farmRespecProposal).toBeNull();

      vi.runAllTimers();

      const state = usePlannerStore.getState();
      expect(state.farmRespecStatus).toBe('done');
      expect(state.farmRespecProposal).not.toBeNull();
      expect(selectFarmRespecIsStale(state)).toBe(false);
    });

    it('does not return a Promise and cannot leave an unhandled rejection — the action itself never throws synchronously', () => {
      expect(() => usePlannerStore.getState().runFarmRespec()).not.toThrow();
      expect(usePlannerStore.getState().runFarmRespec()).toBeUndefined();
    });

    it('a second activation while solving is a no-op — no concurrent second run', () => {
      usePlannerStore.getState().runFarmRespec();
      usePlannerStore.getState().runFarmRespec();
      vi.runAllTimers();
      expect(vi.mocked(runFarmRespecSolve)).toHaveBeenCalledTimes(1);
    });

    it('a second activation on unchanged inputs reuses the existing proposal — no second solve, panel just re-opens', () => {
      usePlannerStore.getState().runFarmRespec();
      vi.runAllTimers();
      expect(vi.mocked(runFarmRespecSolve)).toHaveBeenCalledTimes(1);

      usePlannerStore.getState().setFarmRespecPanelOpen(false);
      usePlannerStore.getState().runFarmRespec();
      expect(vi.mocked(runFarmRespecSolve)).toHaveBeenCalledTimes(1);
      expect(usePlannerStore.getState().farmRespecPanelOpen).toBe(true);
    });

    it('a second activation AFTER an input change re-solves', () => {
      usePlannerStore.getState().runFarmRespec();
      vi.runAllTimers();
      expect(vi.mocked(runFarmRespecSolve)).toHaveBeenCalledTimes(1);

      usePlannerStore.getState().setFarmReturnBonus('vip');
      usePlannerStore.getState().runFarmRespec();
      vi.runAllTimers();
      expect(vi.mocked(runFarmRespecSolve)).toHaveBeenCalledTimes(2);
    });

    it('a mutation during the two-frame yield keys the result to the POST-mutation tuple, never a pre-mutation one', () => {
      const depsBeforeMutation = readFarmRespecDepTuple(usePlannerStore.getState());

      usePlannerStore.getState().runFarmRespec();
      // The race: an input changes DURING the yield, before the scheduled solve actually runs.
      usePlannerStore.getState().setFarmReturnBonus('vip');
      const depsAfterMutation = readFarmRespecDepTuple(usePlannerStore.getState());
      expect(depsAfterMutation).not.toEqual(depsBeforeMutation);

      vi.runAllTimers();

      const state = usePlannerStore.getState();
      expect(state.farmRespecStatus).toBe('done');
      // Deps match the LIVE (post-mutation) tuple — proof the callback read live state inside
      // itself rather than closing over a reference captured before the mutation, which would
      // otherwise key a fresh computation to the wrong (stale) tuple.
      expect(state.farmRespecProposal?.deps).toEqual(depsAfterMutation);
      expect(selectFarmRespecIsStale(state)).toBe(false);
    });

    it('a thrown solve sets a named failed status and clears the proposal, without the exception escaping into React', () => {
      vi.mocked(runFarmRespecSolve).mockImplementationOnce(() => {
        throw new Error('injected solve failure');
      });

      expect(() => {
        usePlannerStore.getState().runFarmRespec();
        vi.runAllTimers();
      }).not.toThrow();

      const state = usePlannerStore.getState();
      expect(state.farmRespecStatus).toBe('failed');
      expect(state.farmRespecProposal).toBeNull();
    });

    it('setFarmRespecReRank(true) sets farmRespecPanelOpen: false; turning it back off re-opens the panel without re-solving', () => {
      usePlannerStore.getState().runFarmRespec();
      vi.runAllTimers();
      expect(vi.mocked(runFarmRespecSolve)).toHaveBeenCalledTimes(1);

      usePlannerStore.getState().setFarmRespecReRank(true);
      expect(usePlannerStore.getState().farmRespecPanelOpen).toBe(false);

      usePlannerStore.getState().setFarmRespecReRank(false);
      expect(usePlannerStore.getState().farmRespecPanelOpen).toBe(true);
      expect(vi.mocked(runFarmRespecSolve)).toHaveBeenCalledTimes(1);
    });
  });
});
