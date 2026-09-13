import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AccountImportData } from '@bombfarm/domain/import-save';
import { loadAccountShared, normalizeAccount, saveAccountShared } from '@/shared/lib/storage';
import { attachAccountPersistence } from '@/shared/stores/persistence/persist-account';
import { AUTOSAVE_MS } from '@/shared/stores/persistence/debounced-writer';
import {
  selectAccountImportedAt,
  selectAccountShared,
} from '@/shared/stores/selectors/account-selectors';
import { resetPlannerStoreForTests, usePlannerStore } from '@/shared/stores';

const ACCOUNT_KEY = 'bf-hp-account-v1';

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
    keys: () => [...store.keys()],
  };
}

const tree = { danoTotal: 1, critChance: 0, critDmg: 0, speed: 0, energy: 0, luckFlatPct: 0 };
const barePayload: AccountImportData = { tree, houseIdx: null, houseLevel: null, phase: null, maxPhase: null };
const fullPayload: AccountImportData = {
  tree: { ...tree, danoTotal: 1.5, critChance: 3, speed: 2, teamCoinPct: 0 },
  houseIdx: 2,
  houseLevel: 4,
  phase: 51,
  maxPhase: 137,
  playerName: 'Ato',
  accountId: '486',
};

describe('account import stamp', () => {
  let storage: ReturnType<typeof memoryLocalStorage>;

  beforeEach(() => {
    vi.useFakeTimers();
    storage = memoryLocalStorage();
    vi.stubGlobal('localStorage', storage);
    resetPlannerStoreForTests();
  });

  afterEach(() => {
    resetPlannerStoreForTests();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('an import stamps the account with the wall clock, whatever the payload carries', () => {
    expect(selectAccountImportedAt(usePlannerStore.getState())).toBeNull();

    vi.setSystemTime(1_700_000_000_000);
    usePlannerStore.getState().applyAccountImport(barePayload);
    expect(selectAccountImportedAt(usePlannerStore.getState())).toBe(1_700_000_000_000);

    vi.setSystemTime(1_700_000_060_000);
    usePlannerStore.getState().applyAccountImport(fullPayload, []);
    expect(selectAccountImportedAt(usePlannerStore.getState())).toBe(1_700_000_060_000);
  });

  it('the stamp survives a save and a load', () => {
    const detach = attachAccountPersistence(usePlannerStore);
    usePlannerStore.getState().setBooted(true);
    usePlannerStore.getState().skipNextAccountToast();
    vi.setSystemTime(1_700_000_000_000);
    usePlannerStore.getState().applyAccountImport(fullPayload, []);
    vi.advanceTimersByTime(AUTOSAVE_MS);
    detach();

    const stored = JSON.parse(localStorage.getItem(ACCOUNT_KEY)!) as { importedAt?: unknown };
    expect(stored.importedAt).toBe(1_700_000_000_000);
    expect(storage.keys()).toEqual([ACCOUNT_KEY]);

    resetPlannerStoreForTests();
    expect(selectAccountImportedAt(usePlannerStore.getState())).toBeNull();
    usePlannerStore.getState().hydrateAccount(loadAccountShared());
    expect(selectAccountImportedAt(usePlannerStore.getState())).toBe(1_700_000_000_000);

    const before = selectAccountShared(usePlannerStore.getState());
    usePlannerStore.setState({ importedAt: 1_700_000_000_001 });
    const after = selectAccountShared(usePlannerStore.getState());
    expect(after).not.toBe(before);
    expect(after.importedAt).toBe(1_700_000_000_001);
  });

  it('the normaliser drops an absent, null, NaN, infinite, string or zero stamp and keeps a positive finite one', () => {
    const rejected = [undefined, null, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 'yesterday', 0, -1];
    for (const raw of rejected) {
      const record = normalizeAccount({ importedAt: raw as unknown as number });
      expect('importedAt' in record, String(raw)).toBe(false);
    }
    expect('importedAt' in normalizeAccount({})).toBe(false);
    expect(normalizeAccount({ importedAt: 1_700_000_000_000 }).importedAt).toBe(1_700_000_000_000);
  });

  it('a record without a stamp re-serialises without the key', () => {
    const fresh = selectAccountShared(usePlannerStore.getState());
    expect('importedAt' in fresh).toBe(false);

    saveAccountShared(fresh);
    expect(localStorage.getItem(ACCOUNT_KEY)).not.toContain('importedAt');

    saveAccountShared(normalizeAccount({ importedAt: null as unknown as number }));
    expect(localStorage.getItem(ACCOUNT_KEY)).not.toContain('importedAt');
  });
});
