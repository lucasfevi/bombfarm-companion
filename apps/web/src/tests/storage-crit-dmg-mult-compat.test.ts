/**
 * `critDmgMult` backward-compat proof — follows `storage-abisso-base-compat.test.ts`'s
 * pattern exactly (same precedent `abissoBase` set for the Abisso damage-mult wave): a genuine
 * pre-`critDmgMult` `bf-hp-account-v1` blob (no `critDmgMult` key) must still load cleanly
 * through `loadAccountShared` / `normalizeAccount` (the "user's existing localStorage from a
 * previous version" path), default `critDmgMult` to `1` (identity — no Glass Cannon
 * crit-damage effect), and never silently change an existing user's numbers on upgrade.
 *
 * The legacy blob below sets `glassCannon: true` on purpose (not the trivial already-false
 * case) — a user who already had the Glass Cannon boolean flag on from an earlier wave (it
 * gates the energy ×0.5 sheet effect, which does NOT depend on `critDmgMult`) is exactly who
 * this guard protects: defaulting the still-missing `critDmgMult` to `1` must leave their
 * crit-damage sheet term untouched (identity), never invent a ×2 or a ×0 out of thin air.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applySkillTree, type TreeSheetTotals } from '@bombfarm/domain/birth-sheet';
import { emptySheetOther, type SheetStats } from '@bombfarm/domain/gear';
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

// Real pre-critDmgMult shape — the abissoBase wave's own schema (abissoBase already present)
// BEFORE this wave added "critDmgMult", with `glassCannon: true` so this exercises the
// identity-default guard rather than the no-op already-false case. `context.phase` is a
// previously-synced 50, kept here to prove it survives the normalize pass untouched.
const LEGACY_ACCOUNT_JSON =
  '{"tree":{"danoTotal":1.15,"critChance":3,"critDmg":0,"speed":0,"energy":0,' +
  '"teamCoinPct":5,"glassCannon":true,"tempoDobrado":false,"abisso":false,"abissoBase":0,' +
  '"luckFlatPct":0},' +
  '"teamBuffs":{"grito_guerra":2,"pressagio_mortal":0,"marcha_acelerada":0,"folego_mineiro":0,"contra_relogio":0},' +
  '"context":{"houseIdx":1,"houseLevel":4,"phase":50,"mitigationPct":1,"rankMode":"dps","targetProp":"prop_x"},' +
  '"slots":9,"forgeFloor":10}';

const SAMPLE_SHEET: SheetStats = {
  attack: 1000,
  energy: 500,
  speed: 50,
  critChance: 20,
  critDmg: 200,
  penetration: 10,
  cdr: 30,
  luck: 5,
};

describe('legacy critDmgMult compat (Glass Cannon numeric wave)', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryLocalStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads a pre-critDmgMult account blob without throwing; critDmgMult defaults to 1, phase survives untouched', () => {
    localStorage.setItem('bf-hp-account-v1', LEGACY_ACCOUNT_JSON);

    let shared: AccountShared | undefined;
    expect(() => {
      shared = loadAccountShared();
    }).not.toThrow();

    expect(shared!.tree.critDmgMult).toBe(1);
    // Pre-existing fields, including the toggle this guard protects against, are untouched.
    expect(shared!.tree.glassCannon).toBe(true);
    expect(shared!.context.phase).toBe(50);
    expect(shared!.tree.danoTotal).toBe(1.15);
    expect(shared!.tree.critChance).toBe(3);
    expect(shared!.tree.luckFlatPct).toBe(0);
    expect(shared!.slots).toBe(9);
    expect(shared!.forgeFloor).toBe(10);
  });

  it("the resulting crit-damage sheet effect is exactly neutral — an existing user's Total cannot silently shift on upgrade", () => {
    localStorage.setItem('bf-hp-account-v1', LEGACY_ACCOUNT_JSON);
    const shared = loadAccountShared();

    const tree: TreeSheetTotals = {
      danoStatic: shared.tree.danoTotal,
      energyPct: shared.tree.energy,
      speedPct: shared.tree.speed,
      critChancePct: shared.tree.critChance,
      critDmgPct: shared.tree.critDmg,
      luckFlatPct: shared.tree.luckFlatPct ?? 0,
      critDmgMult: shared.tree.critDmgMult ?? 1,
      glassCannon: shared.tree.glassCannon,
      tempoDobrado: shared.tree.tempoDobrado,
    };
    const identityTree: TreeSheetTotals = { ...tree, critDmgMult: 1 };

    const sheetOther = emptySheetOther();
    const withLegacyDefault = applySkillTree(SAMPLE_SHEET, SAMPLE_SHEET, sheetOther, tree);
    const withExplicitIdentity = applySkillTree(SAMPLE_SHEET, SAMPLE_SHEET, sheetOther, identityTree);

    // critDmgMult defaulting to 1 is bit-for-bit the same as an explicit identity multiplier —
    // no crit-damage shift is invented for a user whose blob predates this field.
    expect(withLegacyDefault.critDmg).toBe(withExplicitIdentity.critDmg);
    expect(withLegacyDefault.critDmg).toBe(SAMPLE_SHEET.critDmg);
  });

  it('re-save emits "critDmgMult":1 and never creates a -v2 key', () => {
    localStorage.setItem('bf-hp-account-v1', LEGACY_ACCOUNT_JSON);
    const shared = loadAccountShared();

    saveAccountShared(shared);

    const raw = localStorage.getItem('bf-hp-account-v1');
    expect(raw).not.toBeNull();
    expect(raw).toContain('"critDmgMult":1');
    expect(localStorage.getItem('bf-hp-account-v2')).toBeNull();
  });
});
