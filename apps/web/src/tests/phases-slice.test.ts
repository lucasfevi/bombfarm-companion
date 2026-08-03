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
    usePlannerStore.getState().hydratePhasesView(88);
    expect(usePlannerStore.getState().phasesViewPhase).toBe(88);
    expect(localStorage.getItem('bf-hp-phases-view-v1')).toBeNull();
  });
});
