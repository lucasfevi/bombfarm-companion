import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AccountImportData } from '@bombfarm/domain/import-save';
import { normalizeAccount, saveAccountShared } from '@/shared/lib/storage';
import { selectAccountShared } from '@/shared/stores/selectors/account-selectors';
import { resetPlannerStoreForTests, usePlannerStore } from '@/shared/stores';
import { skillsPricingKey } from '@/features/skills/skills-pricing';

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

function importData(skillTree: AccountImportData['skillTree']): AccountImportData {
  return { tree: null, houseIdx: null, houseLevel: null, phase: null, skillTree };
}

describe('skillTree import wiring', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryLocalStorage());
    resetPlannerStoreForTests();
  });

  afterEach(() => {
    resetPlannerStoreForTests();
    vi.unstubAllGlobals();
  });

  it('defaults to null on a fresh store', () => {
    expect(usePlannerStore.getState().skillTree).toBeNull();
  });

  it('applyAccountImport writes owned levels onto the slice and the persisted bytes', () => {
    const skillTree = { levels: { D01: 5 }, refunds: { D01: 80 }, gold: 9_000 };
    usePlannerStore.getState().applyAccountImport(importData(skillTree));
    expect(usePlannerStore.getState().skillTree).toEqual(skillTree);

    expect(saveAccountShared(selectAccountShared(usePlannerStore.getState()))).toBe(true);
    expect(JSON.parse(localStorage.getItem('bf-hp-account-v1')!) as { skillTree: unknown }).toMatchObject({
      skillTree,
    });
  });

  it('a later import with no levels CLEARS a previously stored tree, not preserves it', () => {
    usePlannerStore.getState().applyAccountImport(importData({ levels: { D01: 5 }, refunds: {}, gold: 1 }));
    usePlannerStore.getState().applyAccountImport(importData(null));
    expect(usePlannerStore.getState().skillTree).toBeNull();
    saveAccountShared(selectAccountShared(usePlannerStore.getState()));
    expect(
      Object.prototype.hasOwnProperty.call(JSON.parse(localStorage.getItem('bf-hp-account-v1')!) as object, 'skillTree'),
    ).toBe(false);
  });

  it('normalizeAccount omits skillTree on a record written before the field existed', () => {
    const normalized = normalizeAccount({
      tree: { danoTotal: 1, critChance: 0, critDmg: 0, speed: 0, energy: 0, teamCoinPct: 0 },
    });
    expect(Object.prototype.hasOwnProperty.call(normalized, 'skillTree')).toBe(false);
  });

  it('hydrateAccount round-trips a concrete tree', () => {
    const skillTree = { levels: { H01: 10 }, refunds: {}, gold: null };
    usePlannerStore.getState().applyAccountImport(importData(skillTree));
    const shared = selectAccountShared(usePlannerStore.getState());
    resetPlannerStoreForTests();
    usePlannerStore.getState().hydrateAccount(shared);
    expect(usePlannerStore.getState().skillTree).toEqual(skillTree);
  });
});

describe('skillsPricingKey', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryLocalStorage());
    resetPlannerStoreForTests();
  });

  afterEach(() => {
    resetPlannerStoreForTests();
    vi.unstubAllGlobals();
  });

  it('returns the same string for two reads of an unchanged store', () => {
    usePlannerStore.getState().applyAccountImport({
      ...importData({ levels: { D01: 5 }, refunds: {}, gold: 1 }),
      phase: 1,
    });
    const first = skillsPricingKey(usePlannerStore.getState());
    const second = skillsPricingKey(usePlannerStore.getState());
    expect(first).not.toBeNull();
    expect(second).toBe(first);
  });
});

