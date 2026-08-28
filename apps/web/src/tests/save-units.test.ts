/**
 * The single shared unit-conversion site. Every assertion
 * here is a hand-computed literal, never a round-trip through another converter — a shared
 * converter that only proves itself against its own inverse could cancel its own error on
 * both sides (design.md's stated risk).
 */
import { describe, expect, it } from 'vitest';
import { birthFromSave, hasUsableBirthStats, saveSheetUnits, treeTotalsFromSave } from '@bombfarm/domain/save-units';

describe('saveSheetUnits / birthFromSave (hand-computed literals)', () => {
  it('dmg / energia / speed convert 1:1', () => {
    const converted = saveSheetUnits({ dmg: 1470.4, energia: 836.4, speed: 50.3 });
    expect(converted.attack).toBe(1470.4);
    expect(converted.energy).toBe(836.4);
    expect(converted.speed).toBe(50.3);
  });

  it('penetration converts 1:1 despite looking fractional', () => {
    expect(saveSheetUnits({ penetration: 2.20531741067436 }).penetration).toBe(2.20531741067436);
    expect(saveSheetUnits({ penetration: 141.22613536827 }).penetration).toBe(141.22613536827);
  });

  it('crit_chance / luck / cooldown_reduction are fractions in the save, × 100 here', () => {
    const converted = saveSheetUnits({ crit_chance: 0.127, luck: 0.0995, cooldown_reduction: 0.0314 });
    expect(converted.critChance).toBeCloseTo(12.7, 9);
    expect(converted.luck).toBeCloseTo(9.95, 9);
    expect(converted.cdr).toBeCloseTo(3.14, 9);
  });

  it('crit_dmg is a multiplier in the save, (x-1)*100 excess percentage points here', () => {
    expect(saveSheetUnits({ crit_dmg: 1.6236 }).critDmg).toBeCloseTo(62.36, 9);
  });

  it('Bellatrix\'s birth_stats.crit_dmg 1.67344467136338 converts to 67.344467136338…', () => {
    const converted = birthFromSave({ crit_dmg: 1.67344467136338 });
    expect(converted.critDmg).toBeCloseTo(67.344467136338, 9);
  });

  it('Bellatrix\'s birth_stats.luck converts to percent, not a fraction', () => {
    // Real fixture value (save-20260813-5heroes.json, Bellatrix birth_stats.luck) —
    // The ground-truth rule's class (a) (re-read from the post-patch capture).
    const converted = birthFromSave({ luck: 0.0922693386123672 });
    expect(converted.luck).toBeCloseTo(9.22693386123672, 9);
    expect(converted.luck).not.toBeCloseTo(0.0922693386123672, 3);
  });

  it('saveSheetUnits and birthFromSave are the same table', () => {
    const raw = {
      dmg: 123.194610565468,
      energia: 230.190706065598,
      speed: 52.1452945759431,
      penetration: 2.9941090435946,
      crit_chance: 0.0951417735670745,
      cooldown_reduction: 0.0271958471874361,
      crit_dmg: 1.67344467136338,
      luck: 0.082486912718623,
    };
    expect(birthFromSave(raw)).toEqual(saveSheetUnits(raw));
  });

  it('missing keys default to 0 (or 1 before the crit_dmg -1 excess conversion)', () => {
    const converted = saveSheetUnits({});
    expect(converted.attack).toBe(0);
    expect(converted.energy).toBe(0);
    expect(converted.speed).toBe(0);
    expect(converted.penetration).toBe(0);
    expect(converted.critChance).toBe(0);
    expect(converted.cdr).toBe(0);
    expect(converted.luck).toBe(0);
    expect(converted.critDmg).toBe(0); // (1 - 1) * 100
  });
});

describe('treeTotalsFromSave', () => {
  it('converts skills.totals into planner-unit TreeSheetTotals', () => {
    const converted = treeTotalsFromSave({
      dmg_static: 1.78324567735483,
      energia_add: 0.812711865,
      speed_add: 0.027186897,
      crit_chance_add: 0.3372935775,
      crit_dmg_add: 0.196153846,
      luck_add: 0.0530647275,
    });
    expect(converted.danoStatic).toBeCloseTo(1.78324567735483, 9);
    expect(converted.energyPct).toBeCloseTo(81.2711865, 9);
    expect(converted.speedPct).toBeCloseTo(2.7186897, 9);
    expect(converted.critChancePct).toBeCloseTo(33.72935775, 9);
    expect(converted.critDmgPct).toBeCloseTo(19.6153846, 9);
    expect(converted.luckFlatPct).toBeCloseTo(5.30647275, 9);
  });

  it('dmg_static defaults to 1 when absent, everything else to 0', () => {
    const converted = treeTotalsFromSave({});
    expect(converted.danoStatic).toBe(1);
    expect(converted.energyPct).toBe(0);
    expect(converted.speedPct).toBe(0);
    expect(converted.critChancePct).toBe(0);
    expect(converted.critDmgPct).toBe(0);
    expect(converted.luckFlatPct).toBe(0);
  });
});

describe('hasUsableBirthStats', () => {
  const fullBirth = {
    dmg: 100,
    energia: 200,
    speed: 50,
    penetration: 2,
    crit_chance: 0.1,
    cooldown_reduction: 0.02,
    crit_dmg: 1.5,
    luck: 0.05,
  };

  it('true when all 8 birth_stats keys are present and finite', () => {
    expect(hasUsableBirthStats({ birth_stats: fullBirth })).toBe(true);
  });

  it('false when birth_stats is entirely absent', () => {
    expect(hasUsableBirthStats({ id: '1' })).toBe(false);
  });

  it('false when birth_stats is not an object', () => {
    expect(hasUsableBirthStats({ birth_stats: null })).toBe(false);
    expect(hasUsableBirthStats({ birth_stats: 'x' })).toBe(false);
  });

  it('false when a single key is missing — a partial block is not usable', () => {
    const { luck: _luck, ...partial } = fullBirth;
    expect(hasUsableBirthStats({ birth_stats: partial })).toBe(false);
  });

  it('false when a key is non-finite (NaN, Infinity, or a string)', () => {
    expect(hasUsableBirthStats({ birth_stats: { ...fullBirth, luck: NaN } })).toBe(false);
    expect(hasUsableBirthStats({ birth_stats: { ...fullBirth, dmg: Infinity } })).toBe(false);
    expect(hasUsableBirthStats({ birth_stats: { ...fullBirth, speed: '50' } })).toBe(false);
  });

  it('false when hero itself is not an object', () => {
    expect(hasUsableBirthStats(null)).toBe(false);
    expect(hasUsableBirthStats('hero')).toBe(false);
  });
});
