/**
 * Abisso damage-mult wave — the rule-3/rule-4 backward-compat proof for `abissoBase`,
 * following `storage-luck-compat.test.ts`'s pattern (BSPW2-05) — the same precedent
 * `storage-roundtrip-20260729.json`'s `_meta.comment` documents for `luckFlatPct`
 * (BSPW5-03) and `luck` (BSP-40): a byte-identity fixture proves the CURRENT schema
 * round-trips; this suite proves the opposite property — that a genuine pre-feature
 * `bf-hp-account-v1` blob (no `abissoBase` key) still loads cleanly through
 * `loadAccountShared` / `normalizeAccount` (the "user's existing localStorage from a
 * previous version" path, distinct from `applyAccountImport`'s fresh-save path already
 * covered by `account-slice.test.ts`).
 *
 * The legacy blob below sets `abisso: true` on purpose (not the trivial already-false
 * case) — a user who owned Abisso and already had the account-level `abisso` toggle on
 * from an earlier wave is exactly who the `0 ** phase` guard in `computeCombatMults`
 * protects: defaulting `abissoBase` to 0 must NOT zero out their damage.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { computeCombatMults } from '@bombfarm/domain/derive';
import { abilityMods } from '@bombfarm/domain/model';
import { zeroTeamBuffs } from '@bombfarm/domain/team-buffs';
import { loadAccountShared, saveAccountShared, type AccountShared } from '@/shared/lib/storage';

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

// Real pre-abissoBase shape — same `bf-hp-account-v1` tree as
// storage-roundtrip-20260729.json BEFORE this wave inserted "abissoBase" (see that
// fixture's _meta.comment), with `abisso: true` so this exercises the zero-base guard
// rather than the no-op false case. `context.phase` is a previously-synced 50, kept
// here to prove it survives the normalize pass untouched.
const LEGACY_ACCOUNT_JSON =
  '{"tree":{"danoTotal":1.15,"critChance":3,"critDmg":0,"speed":0,"energy":0,' +
  '"teamCoinPct":5,"glassCannon":false,"tempoDobrado":false,"abisso":true,"luckFlatPct":0},' +
  '"teamBuffs":{"grito_guerra":2,"pressagio_mortal":0,"marcha_acelerada":0,"folego_mineiro":0,"contra_relogio":0},' +
  '"context":{"houseIdx":1,"houseLevel":4,"phase":50,"mitigationPct":1,"rankMode":"dps","targetProp":"prop_x"},' +
  '"slots":9,"forgeFloor":10}';

describe('legacy abissoBase compat (Abisso damage-mult wave)', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryLocalStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads a pre-abissoBase account blob without throwing; abissoBase defaults to 0, phase survives untouched', () => {
    localStorage.setItem('bf-hp-account-v1', LEGACY_ACCOUNT_JSON);

    let shared: AccountShared | undefined;
    expect(() => {
      shared = loadAccountShared();
    }).not.toThrow();

    expect(shared!.tree.abissoBase).toBe(0);
    // Pre-existing fields, including the toggle this guard protects against, are untouched.
    expect(shared!.tree.abisso).toBe(true);
    expect(shared!.context.phase).toBe(50);
    expect(shared!.tree.danoTotal).toBe(1.15);
    expect(shared!.tree.critChance).toBe(3);
    expect(shared!.tree.luckFlatPct).toBe(0);
    expect(shared!.slots).toBe(9);
    expect(shared!.forgeFloor).toBe(10);
  });

  it("the resulting Abisso damage multiplier is exactly 1 — an existing user's DPS cannot silently shift on upgrade", () => {
    localStorage.setItem('bf-hp-account-v1', LEGACY_ACCOUNT_JSON);
    const shared = loadAccountShared();

    const mults = computeCombatMults({
      mods: abilityMods({}),
      teamBuffs: zeroTeamBuffs(),
      treeGlassCannon: shared.tree.glassCannon,
      treeTempoDobrado: shared.tree.tempoDobrado,
      treeAbisso: shared.tree.abisso,
      treeAbissoBase: shared.tree.abissoBase,
      phase: shared.context.phase,
      extraDmgPct: 0,
    });

    expect(mults.abissoMult).toBe(1);
    expect(mults.dmgMult).toBe(1);
  });

  it('re-save emits "abissoBase":0 and never creates a -v2 key', () => {
    localStorage.setItem('bf-hp-account-v1', LEGACY_ACCOUNT_JSON);
    const shared = loadAccountShared();

    saveAccountShared(shared);

    const raw = localStorage.getItem('bf-hp-account-v1');
    expect(raw).not.toBeNull();
    expect(raw).toContain('"abissoBase":0');
    expect(localStorage.getItem('bf-hp-account-v2')).toBeNull();
  });
});
