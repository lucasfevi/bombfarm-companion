import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  resetPlannerStoreForTests,
  usePlannerStore,
  type PlannerStore,
} from '@/shared/stores';

describe('planner store scaffold (W4 T2)', () => {
  beforeEach(() => {
    resetPlannerStoreForTests();
  });

  afterEach(() => {
    resetPlannerStoreForTests();
  });

  it('composes session, account, roster, and phases slice keys', () => {
    const state = usePlannerStore.getState();
    // Session (T6) — other slices still placeholders until T7–T9
    expect(state.lang).toBe('pt');
    expect(typeof state.setLang).toBe('function');
    expect(state.treeDanoTotal).toBe(1);
    expect(typeof state.hydrateAccount).toBe('function');
    expect(state.heroes).toEqual([]);
    expect(typeof state.patchHero).toBe('function');
    expect(state.phasesViewPhase).toBe(1);
    expect(typeof state.setPhasesViewPhase).toBe('function');
  });

  it('imports with localStorage absent from globalThis (W4-01)', async () => {
    expect(typeof globalThis.localStorage).toBe('undefined');
    expect(() => usePlannerStore.getState()).not.toThrow();

    vi.stubGlobal('localStorage', undefined);
    vi.resetModules();
    const mod = await import('@/shared/stores/planner-store');
    expect(mod.usePlannerStore.getState().lang).toBe('pt');
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('subscribeWithSelector is available on the store', () => {
    const unsub = usePlannerStore.subscribe(
      (s: PlannerStore) => s.lang,
      () => undefined,
    );
    unsub();
  });

  it('resetPlannerStoreForTests restores initial state', () => {
    usePlannerStore.getState().setBooted(true);
    resetPlannerStoreForTests();
    expect(usePlannerStore.getState().booted).toBe(false);
    expect(usePlannerStore.getState().lang).toBe('pt');
  });
});
