/**
 * `crit_dmg_mult` must reach `resolveDeriveSheets` as the **persisted numeric**, never
 * re-derived from the `treeGlassCannon` boolean.
 *
 * `detectGlassCannon` (`save-units.ts`) flags the keystone for any `crit_dmg_mult >= 1.5`, so
 * the boolean cannot reconstruct the value. Before this fix the advisor path computed
 * `treeGlassCannon ? 2 : 1` while `selectTreeSheetTotals` read the numeric — a save carrying
 * anything other than exactly `2` would show two different crit-damage numbers for the same
 * account depending on which code path rendered it.
 *
 * Every assertion below deliberately uses a multiplier that is NOT 2: a test at 2 cannot
 * distinguish the two implementations and would pass against the bug.
 */
import { describe, expect, it } from 'vitest';
import { resolveDeriveSheets } from '@bombfarm/domain/advisor-pipeline-sheets';
import { emptyLoadout, emptySheetOther, type SheetStats } from '@bombfarm/domain/gear';

const SHEET: SheetStats = {
  attack: 1000,
  energy: 500,
  speed: 50,
  critChance: 10,
  critDmg: 100,
  penetration: 5,
  cdr: 5,
  luck: 1,
};

function resolve(overrides: Partial<Parameters<typeof resolveDeriveSheets>[0]>) {
  return resolveDeriveSheets({
    naked: SHEET,
    geared: SHEET,
    loadout: emptyLoadout(),
    level: 50,
    stars: 1,
    sheetOther: emptySheetOther(),
    treeDanoTotal: 1,
    treeCritChance: 0,
    treeCritDmg: 0,
    treeSpeed: 0,
    treeEnergy: 0,
    treeLuckFlatPct: 0,
    ...overrides,
  });
}

describe('resolveDeriveSheets — crit_dmg_mult comes from the save, not the boolean', () => {
  it('carries a non-2 multiplier verbatim (fails against `treeGlassCannon ? 2 : 1`)', () => {
    const { treeSheet } = resolve({ treeGlassCannon: true, treeCritDmgMult: 1.7 });
    expect(treeSheet.critDmgMult).toBe(1.7);
  });

  it('a second non-2 value, to rule out a hardcoded 1.7', () => {
    const { treeSheet } = resolve({ treeGlassCannon: true, treeCritDmgMult: 2.5 });
    expect(treeSheet.critDmgMult).toBe(2.5);
  });

  it('Abisso does not suppress it — the keystones are independent', () => {
    const { treeSheet } = resolve({ treeGlassCannon: true, treeCritDmgMult: 1.7, treeAbisso: true });
    expect(treeSheet.critDmgMult).toBe(1.7);
  });

  it('the energy halving still keys off the boolean, which has no numeric in the save', () => {
    const owned = resolve({ treeGlassCannon: true, treeCritDmgMult: 1.7 });
    const unowned = resolve({ treeGlassCannon: false, treeCritDmgMult: 1 });
    expect(owned.treeSheet.glassCannon).toBe(true);
    expect(unowned.treeSheet.glassCannon).toBe(false);
  });

  it('falls back to the boolean when the numeric is absent (pre-persistence state)', () => {
    expect(resolve({ treeGlassCannon: true }).treeSheet.critDmgMult).toBe(2);
    expect(resolve({ treeGlassCannon: false }).treeSheet.critDmgMult).toBe(1);
  });

  it('the two common cases are unchanged: 1 without the keystone, 2 with it', () => {
    expect(resolve({ treeGlassCannon: false, treeCritDmgMult: 1 }).treeSheet.critDmgMult).toBe(1);
    expect(resolve({ treeGlassCannon: true, treeCritDmgMult: 2 }).treeSheet.critDmgMult).toBe(2);
  });
});
