import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FORJA_MAX } from '@bombfarm/domain/gear';
import { DEFAULT_CASA_SLOTS } from '@bombfarm/domain/casa-slots';
import type { InventoryItem } from '@bombfarm/domain/inventory';
import {
  INVENTORY_KEY,
  loadInventory,
  normalizeInventory,
  replaceInventory,
  saveInventory,
} from '@/shared/lib/inventory-storage';
import {
  clearStorageWriteErrorListenersForTests,
  loadAccountShared,
  normalizeAccount,
  onStorageWriteError,
  saveAccountShared,
  type AccountShared,
} from '@/shared/lib/storage';

function memoryLocalStorage(opts?: { throwOnSet?: boolean }) {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (opts?.throwOnSet) {
        const err = new Error('QuotaExceededError');
        err.name = 'QuotaExceededError';
        throw err;
      }
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => store.clear(),
  };
}

const sampleItem: InventoryItem = {
  id: '1',
  defId: 'ember_calca',
  rarityIdx: 2,
  level: 10,
  upgrade: 8,
  slot: 'calca',
  equipped: false,
  equippedBy: null,
  defResolved: true,
  marketBlocked: false,
};

describe('inventory storage adapter', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryLocalStorage());
    clearStorageWriteErrorListenersForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearStorageWriteErrorListenersForTests();
  });

  it('returns an empty snapshot when the key is absent', () => {
    expect(loadInventory()).toEqual({ version: 1, importedAt: 0, items: [] });
  });

  it('returns an empty snapshot for malformed JSON without throwing', () => {
    localStorage.setItem(INVENTORY_KEY, '{not json');
    expect(loadInventory()).toEqual({ version: 1, importedAt: 0, items: [] });
  });

  it('normalizes a partial record', () => {
    const snapshot = normalizeInventory({ version: 1, importedAt: 5, items: [sampleItem, 'bad'] });
    expect(snapshot.items).toHaveLength(1);
    expect(snapshot.importedAt).toBe(5);
  });

  it('round-trips a snapshot through save and load', () => {
    const snapshot = { version: 1 as const, importedAt: 99, items: [sampleItem] };
    expect(saveInventory(snapshot)).toBe(true);
    expect(loadInventory()).toEqual(snapshot);
  });

  it('replaceInventory writes a wholesale snapshot', () => {
    expect(replaceInventory([sampleItem], 42)).toBe(true);
    expect(loadInventory()).toEqual({ version: 1, importedAt: 42, items: [sampleItem] });
  });

  it('fires onStorageWriteError and returns false when setItem throws', () => {
    vi.stubGlobal('localStorage', memoryLocalStorage({ throwOnSet: true }));
    const errors: string[] = [];
    onStorageWriteError(({ key }) => errors.push(key));
    expect(saveInventory({ version: 1, importedAt: 0, items: [] })).toBe(false);
    expect(errors).toEqual([INVENTORY_KEY]);
  });

  it('legacy account records without slots/forgeFloor normalize with defaults', () => {
    const legacy: AccountShared = {
      tree: {
        danoTotal: 2,
        critChance: 1,
        critDmg: 0,
        speed: 0,
        energy: 0,
        teamCoinPct: 5,
        glassCannon: true,
        tempoDobrado: false,
      },
      teamBuffs: { grito_guerra: 3 },
      context: {
        houseIdx: 1,
        houseLevel: 4,
        phase: 12,
        mitigationPct: 2,
        rankMode: 'dps',
        targetProp: 'stone',
      },
    };
    expect(normalizeAccount(legacy)).toEqual({
      ...legacy,
      slots: DEFAULT_CASA_SLOTS,
      forgeFloor: 10,
    });
  });

  it('clamps forgeFloor to 0…FORJA_MAX on account normalize', () => {
    expect(normalizeAccount({ forgeFloor: -1 }).forgeFloor).toBe(0);
    expect(normalizeAccount({ forgeFloor: 99 }).forgeFloor).toBe(FORJA_MAX);
    expect(normalizeAccount({ forgeFloor: 7.6 }).forgeFloor).toBe(8);
  });

  it('clamps slots to at least 1 on account normalize', () => {
    expect(normalizeAccount({ slots: 0 }).slots).toBe(1);
  });

  it('loadAccountShared seeds defaults for legacy account JSON', () => {
    localStorage.setItem(
      'bf-hp-account-v1',
      JSON.stringify({
        tree: { danoTotal: 1.5, critChance: 0, critDmg: 0, speed: 0, energy: 0, teamCoinPct: 0, glassCannon: false, tempoDobrado: false },
        teamBuffs: {},
        context: { houseIdx: 0, houseLevel: 1, phase: null, mitigationPct: 1, rankMode: 'dps', targetProp: 'stone' },
      }),
    );
    const account = loadAccountShared();
    expect(account.slots).toBe(DEFAULT_CASA_SLOTS);
    expect(account.forgeFloor).toBe(10);
    expect(account.tree.danoTotal).toBe(1.5);
  });

  it('saveAccountShared preserves unrelated account fields', () => {
    const account = normalizeAccount({
      tree: {
        danoTotal: 3,
        critChance: 0,
        critDmg: 0,
        speed: 0,
        energy: 0,
        teamCoinPct: 0,
        glassCannon: false,
        tempoDobrado: false,
      },
      teamBuffs: {},
      context: {
        houseIdx: 2,
        houseLevel: 5,
        phase: null,
        mitigationPct: 1,
        rankMode: 'dps',
        targetProp: 'stone',
      },
      slots: 6,
      forgeFloor: 12,
    });
    saveAccountShared(account);
    const loaded = loadAccountShared();
    expect(loaded.slots).toBe(6);
    expect(loaded.forgeFloor).toBe(12);
    expect(loaded.context.houseIdx).toBe(2);
  });

  it('normalizeInventory drops invalid item rows', () => {
    expect(normalizeInventory({ items: [{ id: 'only-id' }] }).items).toEqual([]);
  });
});
