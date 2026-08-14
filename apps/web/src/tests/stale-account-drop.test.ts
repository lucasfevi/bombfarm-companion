/**
 * MP5 F4 (T9) — `dropStaleLocalAccount()` unit coverage: `MSG-21`…`MSG-25`, `MSG-28`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DROPPED_KEYS, dropStaleLocalAccount, RETIRED_TREE_FIELDS } from '@/shared/lib/stale-account';
import { hydratePlannerStore } from '@/shared/stores/hydrate-planner-store';
import { resetPlannerStoreForTests } from '@/shared/stores';
import { usePlannerStore } from '@/shared/stores/planner-store';
import { normalizeAccount } from '@/shared/lib/storage';
import { WEB_PACKAGE_ROOT } from './helpers/web-package-root';

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

const LEGACY_ACCOUNT_JSON =
  '{"tree":{"danoTotal":1.35,"critChance":6.2,"critDmg":18.5,"speed":4.1,"energy":7.3,' +
  '"teamCoinPct":9.4,"glassCannon":true,"tempoDobrado":true,"abisso":true,"abissoBase":1.008,' +
  '"critDmgMult":2,"luckFlatPct":5.5}}';

const CLEAN_FIXTURE_PATH = join(WEB_PACKAGE_ROOT, 'src/tests/fixtures/storage-roundtrip-20260729.json');
const CLEAN_FIXTURE = JSON.parse(readFileSync(CLEAN_FIXTURE_PATH, 'utf8')) as {
  'bf-hp-heroes-v1': string;
  'bf-hp-active-hero-v1': string;
  'bf-hp-account-v1': string;
};

describe('dropStaleLocalAccount', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryLocalStorage());
    resetPlannerStoreForTests();
  });

  afterEach(() => {
    resetPlannerStoreForTests();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('reads RAW bytes: the drop still fires on a record that normalizeAccount would silently clean', () => {
    // Proves the raw-bytes requirement directly: feeding the SAME record through
    // normalizeAccount first (F3's own discard rebuild) makes every retired field disappear —
    // if dropStaleLocalAccount() read the normalized value instead of localStorage, it would
    // find nothing, every time, and would be a permanent no-op.
    const raw = JSON.parse(LEGACY_ACCOUNT_JSON) as Record<string, unknown>;
    const normalized = normalizeAccount(raw);
    for (const field of RETIRED_TREE_FIELDS) {
      expect(field in normalized.tree, `${field} unexpectedly survived normalizeAccount`).toBe(false);
    }

    // The real function, reading raw localStorage, still finds it and drops.
    localStorage.setItem('bf-hp-account-v1', LEGACY_ACCOUNT_JSON);
    const report = dropStaleLocalAccount();
    expect(report.dropped).toBe(true);
    expect(report.triggers.length).toBeGreaterThan(0);
  });

  it('MSG-21 discriminating case: every retired field at its all-falsy value still triggers the drop — presence, not truthiness', () => {
    // LEGACY_ACCOUNT_JSON above (and every other fixture in this file) carries at least one
    // truthy retired value (critDmgMult: 2, glassCannon: true, …) — a truthiness-checking
    // implementation (`tree.critDmgMult` instead of `'critDmgMult' in tree`) would pass every
    // test above for the wrong reason. This fixture is the discriminating case: every retired
    // field is set to its own all-falsy value (0 / false), so ONLY a presence check can find it.
    const allFalsyRetiredJson =
      '{"tree":{"danoTotal":1,"critChance":0,"critDmg":0,"speed":0,"energy":0,"teamCoinPct":0,' +
      '"abisso":false,"abissoBase":0,"critDmgMult":0,"glassCannon":false,"tempoDobrado":false,' +
      '"luckFlatPct":0}}';

    localStorage.setItem('bf-hp-account-v1', allFalsyRetiredJson);
    const report = dropStaleLocalAccount();

    expect(report.dropped).toBe(true);
    expect(report.triggers).toEqual(
      expect.arrayContaining([
        'account.tree.abisso',
        'account.tree.abissoBase',
        'account.tree.critDmgMult',
        'account.tree.glassCannon',
        'account.tree.tempoDobrado',
      ]),
    );
  });

  it('runs as the FIRST statement of hydratePlannerStore — before loadHeroes ever sees the raw bytes', () => {
    // If the drop ran after loadHeroes/loadAccountShared (or not at all), a legacy-shaped hero
    // list would still populate the store even though the account itself gets dropped. This
    // proves ordering by observing the net effect: nothing is populated from the dropped
    // storage at all, roster included.
    localStorage.setItem('bf-hp-account-v1', LEGACY_ACCOUNT_JSON);
    localStorage.setItem('bf-hp-heroes-v1', '[{"id":"h1","name":"Ghost","sourceId":"s1","naked":{},"loadout":{}}]');

    hydratePlannerStore();

    expect(usePlannerStore.getState().heroes).toEqual([]);
    expect(localStorage.getItem('bf-hp-heroes-v1')).toBeNull();
  });

  it('idempotent: a second hydratePlannerStore() call on the same (now-cleared) storage reports no further drop', () => {
    localStorage.setItem('bf-hp-account-v1', LEGACY_ACCOUNT_JSON);
    hydratePlannerStore();

    // Directly call the drop function again against the now-cleared storage — the store itself
    // is already `booted` after the first hydrate, so this isolates the drop's own idempotency
    // rather than hydratePlannerStore's separate no-op-when-booted guard.
    const second = dropStaleLocalAccount();
    expect(second).toEqual({ dropped: false, triggers: [], cleared: [] });
  });

  it('store failure ≠ drop: a throwing getItem reports no drop and does not throw into the caller', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('SecurityError');
      },
      removeItem: () => {
        throw new Error('SecurityError');
      },
    });

    let report: ReturnType<typeof dropStaleLocalAccount> | undefined;
    expect(() => {
      report = dropStaleLocalAccount();
    }).not.toThrow();
    expect(report).toEqual({ dropped: false, triggers: [], cleared: [] });
  });

  it('store failure on ONE key during clearing: the remaining keys are still cleared, and cleared[] reports exactly what succeeded', () => {
    const store = new Map<string, string>();
    store.set('bf-hp-account-v1', LEGACY_ACCOUNT_JSON);
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        if (k === 'bf-hp-heroes-v1') throw new Error('QuotaExceededError');
        store.delete(k);
      },
    });

    const report = dropStaleLocalAccount();

    expect(report.dropped).toBe(true);
    expect(report.cleared).not.toContain('bf-hp-heroes-v1');
    expect(report.cleared).toContain('bf-hp-account-v1');
    // The account key (the one that threw no error) is actually gone from the store.
    expect(store.has('bf-hp-account-v1')).toBe(false);
  });

  it('MSG-25 clean control: storage-roundtrip-20260729.json is NOT dropped — every key stays byte-identical', () => {
    localStorage.setItem('bf-hp-heroes-v1', CLEAN_FIXTURE['bf-hp-heroes-v1']);
    localStorage.setItem('bf-hp-active-hero-v1', CLEAN_FIXTURE['bf-hp-active-hero-v1']);
    localStorage.setItem('bf-hp-account-v1', CLEAN_FIXTURE['bf-hp-account-v1']);

    const report = dropStaleLocalAccount();

    expect(report).toEqual({ dropped: false, triggers: [], cleared: [] });
    expect(localStorage.getItem('bf-hp-heroes-v1')).toBe(CLEAN_FIXTURE['bf-hp-heroes-v1']);
    expect(localStorage.getItem('bf-hp-active-hero-v1')).toBe(CLEAN_FIXTURE['bf-hp-active-hero-v1']);
    expect(localStorage.getItem('bf-hp-account-v1')).toBe(CLEAN_FIXTURE['bf-hp-account-v1']);
  });

  it('MSG-28: the log payload names field paths only — a seeded gold amount and hero name never appear in it', () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const sentinelHeroName = 'Bellatrix-Sentinel-9182';
    const sentinelGold = 918273645;
    const accountJson = JSON.stringify({
      tree: { danoTotal: 1, glassCannon: true },
      teamBuffs: {},
      context: {},
      slots: 9,
      forgeFloor: 10,
      _sentinelGold: sentinelGold,
    });
    localStorage.setItem('bf-hp-account-v1', accountJson);
    localStorage.setItem(
      'bf-hp-heroes-v1',
      JSON.stringify([{ id: 'h1', name: sentinelHeroName, sourceId: 's1', naked: {}, loadout: {} }]),
    );

    dropStaleLocalAccount();

    expect(infoSpy).toHaveBeenCalledTimes(1);
    const payload = JSON.stringify(infoSpy.mock.calls[0]);
    expect(payload).not.toContain(sentinelHeroName);
    expect(payload).not.toContain(String(sentinelGold));
  });

  it('DROPPED_KEYS has exactly the nine designed keys, including bf-hp-active-hero-v1', () => {
    expect(DROPPED_KEYS).toEqual([
      'bf-hp-account-v1',
      'bf-hp-heroes-v1',
      'bf-hp-inventory-v1',
      'bf-hp-active-hero-v1',
      'bf-pa-account-v1',
      'bf-pa-heroes-v2',
      'bf-pa-heroes-v1',
      'bf-pa-active-hero-v2',
      'bf-pa-active-hero-v1',
    ]);
  });
});
