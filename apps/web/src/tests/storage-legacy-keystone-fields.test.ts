/**
 * (T9) — SUPERSEDES the old discard-and-keep rule for keystone-carrying records. F3's version of
 * this file (`storage-legacy-keystone-fields.test.ts`) asserted a keystone-carrying
 * `bf-hp-account-v1` value "loads and keeps every survivor" — the exact opposite of the drop-the-whole-record rule.
 * Under this feature, a stored planner account carrying any of the five retired `TreeState`
 * fields is dropped WHOLE, never discarded-and-kept: `dropStaleLocalAccount()` runs as the first
 * statement of `hydratePlannerStore()`, before `loadAccountShared`/`loadHeroes` ever see the raw
 * bytes. Same fixture string as before this rewrite; the expectation is inverted.
 *
 * The `obsHit`/`obsCrit` row (`storage-legacy-obs-fields.test.ts`) is UNTOUCHED — discard-and-keep
 * is still correct for those fields; this supersession is scoped to the five keystone fields only.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hydratePlannerStore } from '@/shared/stores/hydrate-planner-store';
import { resetPlannerStoreForTests } from '@/shared/stores';
import { selectAccountShared } from '@/shared/stores/selectors/account-selectors';
import { usePlannerStore } from '@/shared/stores/planner-store';

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

// A pre-change bf-hp-account-v1 value carrying all five keystone-derived tree fields — the
// exact shape TreeState required before this change. Same string this file used pre-rewrite. A JSON
// string, not a TS literal, so it does not hit the excess-property check a typed literal would
// now trip (same reasoning as storage-legacy-obs-fields.test.ts's context.obsHit/obsCrit case).
const LEGACY_ACCOUNT_JSON =
  '{"tree":{"danoTotal":1.35,"critChance":6.2,"critDmg":18.5,"speed":4.1,"energy":7.3,' +
  '"teamCoinPct":9.4,"glassCannon":true,"tempoDobrado":true,"abisso":true,"abissoBase":1.008,' +
  '"critDmgMult":2,"luckFlatPct":5.5},' +
  '"teamBuffs":{"grito_guerra":20},' +
  '"context":{"houseIdx":2,"houseLevel":10,"phase":151,"mitigationPct":13.27,"rankMode":"dps",' +
  '"targetProp":"prop_a"},' +
  '"slots":11,' +
  '"forgeFloor":12}';

const LEGACY_HEROES_JSON = '[{"id":"h1","name":"Legacy","sourceId":"save-1","naked":{},"loadout":{}}]';

describe('legacy keystone-carrying account is dropped whole (supersedes the old discard-and-keep rule for these five fields)', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryLocalStorage());
    resetPlannerStoreForTests();
  });

  afterEach(() => {
    resetPlannerStoreForTests();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('drops the whole account instead of loading it with the five keystone fields merely discarded — the app starts from defaults', () => {
    // The store's actual "existing empty state" — captured on the pristine, never-
    // hydrated store `beforeEach` just reset to. Not necessarily `DEFAULT_ACCOUNT()` verbatim:
    // this snapshot goes through whatever `selectAccountShared` currently derives (issue #132:
    // an unset `teamBuffsOverride` reads back as `{}` here, not a real roster-derived total,
    // since the pristine store has no roster either).
    const emptyStateAccount = selectAccountShared(usePlannerStore.getState());

    localStorage.setItem('bf-hp-account-v1', LEGACY_ACCOUNT_JSON);
    localStorage.setItem('bf-hp-heroes-v1', LEGACY_HEROES_JSON);
    localStorage.setItem('bf-hp-active-hero-v1', '"h1"');

    expect(() => hydratePlannerStore()).not.toThrow();

    // Not the legacy record's own surviving values (danoTotal 1.35, slots 11, forgeFloor 12,
    // context.houseIdx 2, …) — the existing empty state, because the whole record was dropped
    // before ever being normalized and served.
    const account = selectAccountShared(usePlannerStore.getState());
    expect(account).toEqual(emptyStateAccount);
    // No placeholder/zeroed roster either — the existing empty state.
    expect(usePlannerStore.getState().heroes).toEqual([]);
  });

  it('clears every bf-hp-* key from localStorage — the record is not left readable, half or whole', () => {
    localStorage.setItem('bf-hp-account-v1', LEGACY_ACCOUNT_JSON);
    localStorage.setItem('bf-hp-heroes-v1', LEGACY_HEROES_JSON);
    localStorage.setItem('bf-hp-inventory-v1', '{"version":1,"importedAt":0,"items":[]}');
    localStorage.setItem('bf-hp-active-hero-v1', '"h1"');

    hydratePlannerStore();

    expect(localStorage.getItem('bf-hp-account-v1')).toBeNull();
    expect(localStorage.getItem('bf-hp-heroes-v1')).toBeNull();
    expect(localStorage.getItem('bf-hp-inventory-v1')).toBeNull();
    expect(localStorage.getItem('bf-hp-active-hero-v1')).toBeNull();
  });

  it('never migrates the record into a -v2 key — no new copy is created anywhere', () => {
    localStorage.setItem('bf-hp-account-v1', LEGACY_ACCOUNT_JSON);

    hydratePlannerStore();

    expect(localStorage.getItem('bf-hp-account-v2')).toBeNull();
    expect(localStorage.getItem('bf-hp-heroes-v2')).toBeNull();
  });

  it('a keystone field with an all-false/zero value still triggers the drop — presence, not truthiness', () => {
    const allFalseJson =
      '{"tree":{"danoTotal":1,"critChance":0,"critDmg":0,"speed":0,"energy":0,"teamCoinPct":0,' +
      '"glassCannon":false,"tempoDobrado":false,"abisso":false,"abissoBase":0,"critDmgMult":1,' +
      '"luckFlatPct":0}}';
    localStorage.setItem('bf-hp-account-v1', allFalseJson);

    hydratePlannerStore();

    expect(localStorage.getItem('bf-hp-account-v1')).toBeNull();
  });

  it('discards the record silently — no console warning or error', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    localStorage.setItem('bf-hp-account-v1', LEGACY_ACCOUNT_JSON);
    hydratePlannerStore();

    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
