import { describe, expect, it } from 'vitest';
import {
  nakedAfterSheetAbilityChange,
  rescaleNakedCrit,
  rescaleNakedCritChance,
  rescaleNakedCritDmg,
  rescaleNakedPen,
  type SheetStats,
} from '@bombfarm/domain/gear';
import { abilityMods } from '@bombfarm/domain/model';

const naked = (): SheetStats => ({
  attack: 200,
  energy: 300,
  speed: 50,
  critChance: 10,
  critDmg: 70,
  penetration: 5,
  cdr: 5,
  luck: 20,
});

describe('nakedAfterSheetAbilityChange (DEC-04, BSP-31a)', () => {
  it("critChancePctOfBase dispatches to rescaleNakedCritChance, not rescaleNakedCrit — preserves a non-midpoint hero's own roll (AC-45's discriminating case)", () => {
    const bellatrixCritChance = 9.51; // vs Raro's rarity midpoint (7) — a 36% error if reset.
    const custom: SheetStats = { ...naked(), critChance: bellatrixCritChance };
    const prevMods = abilityMods({});
    const nextMods = abilityMods({ olho_clinico: 10 }); // 0.04574 pp/rank, flat, onSheet=true.

    const result = nakedAfterSheetAbilityChange(custom, 'critChanceFlat', prevMods, nextMods);
    const expected = rescaleNakedCritChance(
      custom,
      prevMods.sheetCritChanceFlat,
      nextMods.sheetCritChanceFlat,
    );
    expect(result.critChance).toBeCloseTo(expected.critChance, 10);
    expect(result.critChance).toBeCloseTo(bellatrixCritChance + nextMods.sheetCritChanceFlat, 6);

    // The rescaleNakedCrit (rarity-midpoint) form disagrees — proving the dispatcher does NOT
    // call it.
    const midpointForm = rescaleNakedCrit(custom, 'Raro', nextMods.sheetCritChanceFlat);
    expect(result.critChance).not.toBeCloseTo(midpointForm.critChance, 1);
  });

  it('penetrationPp dispatches to rescaleNakedPen', () => {
    const custom: SheetStats = { ...naked(), penetration: 5 };
    const prevMods = abilityMods({});
    const nextMods = abilityMods({ ponta_diamante: 10 }); // +1pp/level onSheet=true.
    const result = nakedAfterSheetAbilityChange(custom, 'penetrationPp', prevMods, nextMods);
    const expected = rescaleNakedPen(custom, prevMods.sheetPenetrationRaw, nextMods.sheetPenetrationRaw);
    expect(result.penetration).toBeCloseTo(expected.penetration, 10);
    expect(nextMods.sheetPenetrationRaw).toBeCloseTo(10, 6);
  });

  it('critDmgFlat dispatches to rescaleNakedCritDmg', () => {
    const custom: SheetStats = { ...naked(), critDmg: 90 };
    const prevMods = abilityMods({});
    const nextMods = abilityMods({ golpe_brutal: 13 }); // 4 planner pp/level.
    const result = nakedAfterSheetAbilityChange(custom, 'critDmgFlat', prevMods, nextMods);
    const expected = rescaleNakedCritDmg(custom, prevMods.sheetCritDmgFlat, nextMods.sheetCritDmgFlat);
    expect(result.critDmg).toBeCloseTo(expected.critDmg, 10);
    expect(nextMods.sheetCritDmgFlat).toBe(52);
  });

  it('returns naked unchanged (same reference) for a non-sheet-ability kind', () => {
    const n = naked();
    const prevMods = abilityMods({});
    const nextMods = abilityMods({});
    expect(nakedAfterSheetAbilityChange(n, 'drainPct', prevMods, nextMods)).toBe(n);
    expect(nakedAfterSheetAbilityChange(n, 'none', prevMods, nextMods)).toBe(n);
    expect(nakedAfterSheetAbilityChange(n, 'rangeCells', prevMods, nextMods)).toBe(n);
  });
});
