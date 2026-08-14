import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AccountImportData } from '@bombfarm/domain/import-save';
import { saveAccountShared } from '@/shared/lib/storage';
import { selectAccountShared } from '@/shared/stores/selectors/account-selectors';
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

/** Minimal AccountImportData literal — every test drives this type, never a raw save payload. */
function importData(maxPhase: number | null): AccountImportData {
  return { tree: null, houseIdx: null, houseLevel: null, phase: null, maxPhase };
}

/**
 * `R-C28` / `OD-9`: `applyAccountImport` maps `AccountImportData.maxPhase` into the account
 * slice and persists it additively to `bf-hp-account-v1`, unconditionally — both the write of a
 * concrete value AND the clearing of a stale one when a later payload carries no source.
 */
describe('maxPhase import wiring (R-C28, OD-9)', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryLocalStorage());
    resetPlannerStoreForTests();
  });

  afterEach(() => {
    resetPlannerStoreForTests();
    vi.unstubAllGlobals();
  });

  it('applyAccountImport({ maxPhase: 42 }) writes the slice and the persisted bytes', () => {
    usePlannerStore.getState().applyAccountImport(importData(42));
    expect(usePlannerStore.getState().maxPhase).toBe(42);

    const wrote = saveAccountShared(selectAccountShared(usePlannerStore.getState()));
    expect(wrote).toBe(true);
  });

  it('applyAccountImport({ maxPhase: null }) sets the slice to null', () => {
    usePlannerStore.getState().applyAccountImport(importData(null));
    expect(usePlannerStore.getState().maxPhase).toBeNull();
  });

  // The discriminating case: a conditional write (`if (data.maxPhase != null)`) passes every
  // other test in this file and fails only this one.
  it('a later import with no max_phase source CLEARS a previously stored value, not preserves it', () => {
    usePlannerStore.getState().applyAccountImport(importData(42));
    expect(usePlannerStore.getState().maxPhase).toBe(42);
    saveAccountShared(selectAccountShared(usePlannerStore.getState()));
    expect(
      (JSON.parse(localStorage.getItem('bf-hp-account-v1')!) as { maxPhase: number | null })
        .maxPhase,
    ).toBe(42);

    usePlannerStore.getState().applyAccountImport(importData(null));
    expect(usePlannerStore.getState().maxPhase).toBeNull();
    saveAccountShared(selectAccountShared(usePlannerStore.getState()));
    expect(
      (JSON.parse(localStorage.getItem('bf-hp-account-v1')!) as { maxPhase: number | null })
        .maxPhase,
    ).toBeNull();
  });

  it('hydrateAccount round-trips a concrete maxPhase', () => {
    usePlannerStore.getState().applyAccountImport(importData(151));
    const shared = selectAccountShared(usePlannerStore.getState());
    resetPlannerStoreForTests();
    usePlannerStore.getState().hydrateAccount(shared);
    expect(usePlannerStore.getState().maxPhase).toBe(151);
  });

  it('hydrateAccount round-trips a null maxPhase', () => {
    const shared = selectAccountShared(usePlannerStore.getState());
    resetPlannerStoreForTests();
    usePlannerStore.getState().hydrateAccount(shared);
    expect(usePlannerStore.getState().maxPhase).toBeNull();
  });

  it('an import with no houseIdx/houseLevel/tree/phase still writes maxPhase unconditionally', () => {
    usePlannerStore.getState().applyAccountImport(importData(7));
    expect(usePlannerStore.getState().maxPhase).toBe(7);
  });
});
