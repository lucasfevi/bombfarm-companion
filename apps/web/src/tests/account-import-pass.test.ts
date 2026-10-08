import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AccountImportData } from '@bombfarm/domain/import-save';
import { resetPlannerStoreForTests, usePlannerStore } from '@/shared/stores';

const memoryLocalStorage = () => {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
  };
};

const DAY_SECS = 86_400;

function importWith(vipUntil: number | null | undefined): AccountImportData {
  return {
    tree: null,
    houseIdx: null,
    houseLevel: null,
    phase: null,
    maxPhase: null,
    ...(vipUntil === undefined ? {} : { vipUntil }),
  };
}

describe('importing an account prefills the Pass', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryLocalStorage());
    resetPlannerStoreForTests();
  });

  afterEach(() => {
    resetPlannerStoreForTests();
    vi.unstubAllGlobals();
  });

  it('turns it on for a Pass that ends in the future', () => {
    const nowSecs = Math.floor(Date.now() / 1000);
    usePlannerStore.getState().applyAccountImport(importWith(nowSecs + DAY_SECS));
    expect(usePlannerStore.getState().farmPass).toBe(true);
  });

  it.each([0, 1])('turns it off for a Pass that ended (%i)', (vipUntil) => {
    usePlannerStore.getState().setFarmPass(true);
    usePlannerStore.getState().applyAccountImport(importWith(vipUntil));
    expect(usePlannerStore.getState().farmPass).toBe(false);
  });

  it.each([true, false])('leaves the stored toggle (%s) alone when the import carries no Pass date', (stored) => {
    usePlannerStore.getState().setFarmPass(stored);
    usePlannerStore.getState().applyAccountImport(importWith(null));
    expect(usePlannerStore.getState().farmPass).toBe(stored);
    usePlannerStore.getState().applyAccountImport(importWith(undefined));
    expect(usePlannerStore.getState().farmPass).toBe(stored);
  });

  it('lets the player toggle it afterwards', () => {
    const nowSecs = Math.floor(Date.now() / 1000);
    usePlannerStore.getState().applyAccountImport(importWith(nowSecs + DAY_SECS));
    usePlannerStore.getState().setFarmPass(false);
    expect(usePlannerStore.getState().farmPass).toBe(false);
  });
});
