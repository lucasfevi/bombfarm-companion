import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  defaultPhasesView,
  loadPhasesView,
  savePhasesView,
} from '@/features/phases/model/phases-view-storage';

function memoryLocalStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
  };
}

describe('phases-view-storage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('defaults to phase 1', () => {
    vi.stubGlobal('localStorage', memoryLocalStorage());
    expect(loadPhasesView()).toEqual(defaultPhasesView());
  });

  it('clamps saved phase to 1..600', () => {
    vi.stubGlobal('localStorage', memoryLocalStorage());
    savePhasesView({ phase: 9999 });
    expect(loadPhasesView().phase).toBe(600);
    savePhasesView({ phase: 0 });
    expect(loadPhasesView().phase).toBe(1);
  });

  it('round-trips phase selection', () => {
    vi.stubGlobal('localStorage', memoryLocalStorage());
    savePhasesView({ phase: 42 });
    expect(loadPhasesView().phase).toBe(42);
  });
});
