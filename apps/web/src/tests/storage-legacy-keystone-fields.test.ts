/**
 * MP5 F3 (MSC-10, AD-083) — glassCannon/tempoDobrado/abisso/abissoBase/critDmgMult were
 * removed from `TreeState` (the 2026-08-13 game patch removed all five keystones). Proves a
 * `bf-hp-account-v1` value captured BEFORE that removal still loads: no throw, the five fields
 * are discarded on normalize, and every surviving field keeps its stored value. Same shape as
 * `storage-legacy-obs-fields.test.ts` (`obsHit`/`obsCrit`, `BSPW1-04`), the stated-exception-to
 * -rule-5 precedent this removal follows (`local-data-compat.md`'s `Removed fields` table).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadAccountShared, saveAccountShared, normalizeAccount, type AccountShared } from '@/shared/lib/storage';

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
// exact shape TreeState required before MP5 F3. A JSON string, not a TS literal, so it does not
// hit the excess-property check a typed literal would now trip (same reasoning as
// storage-legacy-obs-fields.test.ts's context.obsHit/obsCrit case).
const LEGACY_ACCOUNT_JSON =
  '{"tree":{"danoTotal":1.35,"critChance":6.2,"critDmg":18.5,"speed":4.1,"energy":7.3,' +
  '"teamCoinPct":9.4,"glassCannon":true,"tempoDobrado":true,"abisso":true,"abissoBase":1.008,' +
  '"critDmgMult":2,"luckFlatPct":5.5},' +
  '"teamBuffs":{"grito_guerra":20},' +
  '"context":{"houseIdx":2,"houseLevel":10,"phase":151,"mitigationPct":13.27,"rankMode":"dps",' +
  '"targetProp":"prop_a"},' +
  '"slots":11,' +
  '"forgeFloor":12}';

const LEGACY_ACCOUNT = JSON.parse(LEGACY_ACCOUNT_JSON) as Record<string, unknown>;
const LEGACY_TREE = LEGACY_ACCOUNT.tree as Record<string, unknown>;

describe('legacy keystone field discard (MP5 F3, MSC-10)', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryLocalStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('loads a pre-removal bf-hp-account-v1 value without throwing, discards the five keystone fields, and keeps every survivor', () => {
    localStorage.setItem('bf-hp-account-v1', LEGACY_ACCOUNT_JSON);

    let shared!: AccountShared;
    expect(() => {
      shared = loadAccountShared();
    }).not.toThrow();

    // The five keystone-derived fields are gone.
    expect('glassCannon' in shared.tree).toBe(false);
    expect('tempoDobrado' in shared.tree).toBe(false);
    expect('abisso' in shared.tree).toBe(false);
    expect('abissoBase' in shared.tree).toBe(false);
    expect('critDmgMult' in shared.tree).toBe(false);

    // Every surviving tree field keeps its stored value.
    expect(shared.tree.danoTotal).toBe(LEGACY_TREE.danoTotal);
    expect(shared.tree.critChance).toBe(LEGACY_TREE.critChance);
    expect(shared.tree.critDmg).toBe(LEGACY_TREE.critDmg);
    expect(shared.tree.speed).toBe(LEGACY_TREE.speed);
    expect(shared.tree.energy).toBe(LEGACY_TREE.energy);
    expect(shared.tree.teamCoinPct).toBe(LEGACY_TREE.teamCoinPct);
    expect(shared.tree.luckFlatPct).toBe(LEGACY_TREE.luckFlatPct);

    // Every surviving top-level AccountShared field keeps its stored value too.
    expect(shared.teamBuffs).toEqual(LEGACY_ACCOUNT.teamBuffs);
    expect(shared.context).toEqual(LEGACY_ACCOUNT.context);
    expect(shared.slots).toBe(LEGACY_ACCOUNT.slots);
    expect(shared.forgeFloor).toBe(LEGACY_ACCOUNT.forgeFloor);
  });

  it('discards the five fields via normalizeAccount directly, not just through the load path', () => {
    const normalized = normalizeAccount(LEGACY_ACCOUNT);
    expect('glassCannon' in normalized.tree).toBe(false);
    expect('tempoDobrado' in normalized.tree).toBe(false);
    expect('abisso' in normalized.tree).toBe(false);
    expect('abissoBase' in normalized.tree).toBe(false);
    expect('critDmgMult' in normalized.tree).toBe(false);
  });

  it('drops the keys on re-save and never creates a -v2 key', () => {
    localStorage.setItem('bf-hp-account-v1', LEGACY_ACCOUNT_JSON);
    const shared = loadAccountShared();

    saveAccountShared(shared);

    const raw = localStorage.getItem('bf-hp-account-v1');
    expect(raw).not.toBeNull();
    expect(raw).not.toContain('glassCannon');
    expect(raw).not.toContain('tempoDobrado');
    expect(raw).not.toContain('abisso');
    expect(raw).not.toContain('critDmgMult');
    expect(localStorage.getItem('bf-hp-account-v2')).toBeNull();
  });

  it('discards the fields silently — no console warning or error', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    localStorage.setItem('bf-hp-account-v1', LEGACY_ACCOUNT_JSON);
    loadAccountShared();

    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
