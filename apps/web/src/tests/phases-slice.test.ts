import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadPhasesView } from '@/shared/lib/phases-view-storage';
import { resetPlannerStoreForTests, usePlannerStore } from '@/shared/stores';

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

  // AD-PFRC-03 — red against the shipped implementation before this feature: the old
  // savePhasesView({ phase: clamped }) call site silently erased any second persisted field.
  it('AD-PFRC-03: a pool override survives a later setPhasesViewPhase call', () => {
    usePlannerStore.getState().setFarmHeroEnabled('hero-1', false);
    usePlannerStore.getState().setPhasesViewPhase(151);

    expect(loadPhasesView().farmPool).toEqual({ 'hero-1': false });
    expect(loadPhasesView().phase).toBe(151);
  });

  it('AD-PFRC-03: the return bonus survives a later setPhasesViewPhase call', () => {
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
});
