/**
 * BSPW4-01 (AC-01…AC-08) — the AD-BSP-19 formula block as code.
 *
 * The 21-hero-instance round-trip (AC-06) needs a real spent-point vector per hero, which
 * this wave's own `inferSpentPoints` (T3) does not exist to provide yet (T1 depends only on
 * T1 per tasks.md's diagram note). This file therefore carries a small, test-local point
 * solver (`solveSpentPoints`) that inverts the same linear algebra `composeSheetFromBirth`
 * implements — it exists only to prove the forward composer round-trips a real, independently
 * recoverable vector, not to duplicate T3's production behaviour (rounding/issues/clamping).
 */
import { describe, expect, it } from 'vitest';
import {
  applySkillTree,
  composeSheetFromBirth,
  nakedFromBirth,
  type BirthStats,
  type TreeSheetTotals,
} from '@bombfarm/domain/birth-sheet';
import { attackPointGain, POINT_GAIN } from '@bombfarm/domain/model';
import { emptyLoadout, emptySheetOther, starsMult, sumGearBonuses, type SheetOtherPct } from '@bombfarm/domain/gear';
import { SHEET_KEYS, ZERO_PTS, type SheetKey } from '@bombfarm/domain/planner-constants';
import type { SaveHeroSheet } from './helpers/sheet-math-fixtures';
import {
  birthFromSaveUnits,
  extractHero,
  loadFixtureJson,
  treeTotalsFromSave,
} from './helpers/sheet-math-fixtures';

const WAVE0_ZERO_TREE: TreeSheetTotals = {
  danoStatic: 1,
  energyPct: 0,
  speedPct: 0,
  critChancePct: 0,
  critDmgPct: 0,
  luckFlatPct: 0,
  critDmgMult: 1,
};

function poolFactor(percent: number): number {
  return 1 + Math.max(0, percent);
}

/** Test-local inversion of `composeSheetFromBirth` — see file header. Never rounds. */
function solveSpentPoints(hero: SaveHeroSheet, tree: TreeSheetTotals): Record<SheetKey, number> {
  const birth = hero.birth;
  if (!birth) throw new Error(`${hero.name} has no birth_stats`);
  const naked = nakedFromBirth(birth, hero.level, hero.stars, hero.sheetOther);
  const baseSpeed = naked.speed / poolFactor(hero.sheetOther.speed);
  const baseCritChance = naked.critChance / poolFactor(hero.sheetOther.critChance);
  const baseCritDmg = naked.critDmg / poolFactor(hero.sheetOther.critDmg);
  const observed = hero.sheet;
  const pool = {
    attack: observed.attack / tree.danoStatic,
    energy: observed.energy / (1 + tree.energyPct / 100),
    speed: observed.speed - baseSpeed * (tree.speedPct / 100),
    critChance: observed.critChance - baseCritChance * (tree.critChancePct / 100),
    critDmg: observed.critDmg - baseCritDmg * (tree.critDmgPct / 100),
    penetration: observed.penetration,
    cdr: observed.cdr,
    luck: observed.luck - tree.luckFlatPct,
  };
  const bonuses = sumGearBonuses(hero.loadout);
  const gem = 1 + bonuses.energyPct;
  const star = starsMult(hero.stars);
  const atkPt = attackPointGain(hero.level) * star;
  const solveShared = (poolVal: number, nakedVal: number, gearPct: number, otherPct: number, rate: number) => {
    const other = Math.max(0, otherPct);
    const ptsPct = (poolVal * (1 + other)) / nakedVal - (1 + other) - gearPct;
    return ptsPct / rate;
  };
  return {
    attack: (pool.attack - naked.attack - bonuses.dmgFlat) / atkPt,
    energy: (pool.energy / gem - naked.energy) / (POINT_GAIN.energyNative * star),
    speed: solveShared(pool.speed, naked.speed, bonuses.speedPct, hero.sheetOther.speed, POINT_GAIN.speedPctOfBase),
    critChance: solveShared(
      pool.critChance,
      naked.critChance,
      bonuses.critPct,
      hero.sheetOther.critChance,
      POINT_GAIN.critChancePctOfBase,
    ),
    critDmg: solveShared(pool.critDmg, naked.critDmg, 0, hero.sheetOther.critDmg, POINT_GAIN.critDmgPctOfBase),
    penetration: solveShared(
      pool.penetration,
      naked.penetration,
      bonuses.penPct,
      hero.sheetOther.penetration,
      POINT_GAIN.penetrationPctOfBase,
    ),
    cdr: solveShared(pool.cdr, naked.cdr, bonuses.cdrPct, hero.sheetOther.cdr, POINT_GAIN.cdrPctOfBase),
    luck: solveShared(pool.luck, naked.luck, bonuses.luckPct, 0, POINT_GAIN.luckPctOfBase),
  };
}

function roundPts(raw: Record<SheetKey, number>): Record<SheetKey, number> {
  const out = {} as Record<SheetKey, number>;
  for (const key of SHEET_KEYS) out[key] = Math.round(raw[key]);
  return out;
}

const FIXTURES = [
  { file: 'bellatrix-02-pts-each-1.json', names: [
    ['Bram', 49], ['Bellatrix', 59], ['Torin', 45], ['Rowan', 24], ['Zane', 30], ['Vera', 17],
    ['Korin', 21], ['Korin', 2], ['Nyx', 4], ['Mira', 1], ['Finn', 1],
  ] as const },
  { file: 'save-20260801-crit-dmg-tree.json', names: [
    ['Bram', 54], ['Bellatrix', 62], ['Torin', 51], ['Rowan', 32], ['Zane', 43], ['Vera', 27],
    ['Korin', 50], ['Orin', 23], ['Kira', 5], ['Maeve', 6],
  ] as const },
];

describe('nakedFromBirth (AC-01, AC-02, AC-03)', () => {
  const birth: BirthStats = {
    attack: 100, energy: 200, speed: 50, critChance: 8, critDmg: 60, penetration: 3, cdr: 2, luck: 5,
  };

  it('AC-02: level 1, stars 0, empty sheetOther returns the birth rolls bit-identically', () => {
    const naked = nakedFromBirth(birth, 1, 0, emptySheetOther());
    for (const key of SHEET_KEYS) {
      expect(naked[key], key).toBe(birth[key]);
    }
  });

  it('AC-01: attack scales by levelPowerMult × starsMult; energy/luck by starsMult only', () => {
    const naked = nakedFromBirth(birth, 26, 2, emptySheetOther());
    const P = 1 + 0.04 * 25;
    const S = 1 + 0.5 * 2;
    expect(naked.attack).toBeCloseTo(birth.attack * P * S, 9);
    expect(naked.energy).toBeCloseTo(birth.energy * S, 9);
    expect(naked.luck).toBeCloseTo(birth.luck * S, 9);
  });

  it('AC-01: speed is NOT star-scaled', () => {
    const naked = nakedFromBirth(birth, 1, 3, emptySheetOther());
    expect(naked.speed).toBe(birth.speed);
  });

  it('AC-01: pooled keys (critChance, critDmg, penetration, cdr) scale by starsMult × (1+sheetOther)', () => {
    const sheetOther: SheetOtherPct = { speed: 0, critChance: 0.1, critDmg: 0.2, penetration: 0.3, cdr: 0 };
    const naked = nakedFromBirth(birth, 1, 1, sheetOther);
    const S = 1.5;
    expect(naked.critChance).toBeCloseTo(birth.critChance * 1.1 * S, 9);
    expect(naked.critDmg).toBeCloseTo(birth.critDmg * 1.2 * S, 9);
    expect(naked.penetration).toBeCloseTo(birth.penetration * 1.3 * S, 9);
    expect(naked.cdr).toBeCloseTo(birth.cdr * S, 9);
  });

  it('AC-03: each on-sheet ability raises exactly its own key, asserted key-by-key', () => {
    const olho: SheetOtherPct = { speed: 0, critChance: 0.0075, critDmg: 0, penetration: 0, cdr: 0 };
    const ponta: SheetOtherPct = { speed: 0, critChance: 0, critDmg: 0, penetration: 1.0, cdr: 0 };
    const golpe: SheetOtherPct = { speed: 0, critChance: 0, critDmg: 0.04, penetration: 0, cdr: 0 };
    const base = nakedFromBirth(birth, 1, 0, emptySheetOther());
    const withOlho = nakedFromBirth(birth, 1, 0, olho);
    const withPonta = nakedFromBirth(birth, 1, 0, ponta);
    const withGolpe = nakedFromBirth(birth, 1, 0, golpe);

    for (const key of SHEET_KEYS) {
      if (key === 'critChance') expect(withOlho[key]).not.toBeCloseTo(base[key], 6);
      else expect(withOlho[key], `olho should not move ${key}`).toBe(base[key]);
    }
    for (const key of SHEET_KEYS) {
      if (key === 'penetration') expect(withPonta[key]).not.toBeCloseTo(base[key], 6);
      else expect(withPonta[key], `ponta should not move ${key}`).toBe(base[key]);
    }
    for (const key of SHEET_KEYS) {
      if (key === 'critDmg') expect(withGolpe[key]).not.toBeCloseTo(base[key], 6);
      else expect(withGolpe[key], `golpe should not move ${key}`).toBe(base[key]);
    }
  });
});

describe('applySkillTree (AC-04, AC-05)', () => {
  const birth: BirthStats = {
    attack: 100, energy: 200, speed: 50, critChance: 8, critDmg: 60, penetration: 3, cdr: 2, luck: 5,
  };
  const sheetOther = emptySheetOther();
  const naked = nakedFromBirth(birth, 1, 0, sheetOther);
  const pooled = naked; // no gear/points for this isolated test — sheet === naked here

  it('AC-04: applies exactly the four AD-BSP-22 shapes; pen and cdr get exactly 0', () => {
    const tree: TreeSheetTotals = {
      danoStatic: 1.5,
      energyPct: 10,
      speedPct: 4,
      critChancePct: 6,
      critDmgPct: 8,
      luckFlatPct: 2,
      critDmgMult: 1,
    };
    const result = applySkillTree(pooled, naked, sheetOther, tree);
    expect(result.attack).toBeCloseTo(pooled.attack * 1.5, 9);
    expect(result.energy).toBeCloseTo(pooled.energy * 1.1, 9);
    expect(result.speed).toBeCloseTo(pooled.speed + naked.speed * 0.04, 9);
    expect(result.critChance).toBeCloseTo(pooled.critChance + naked.critChance * 0.06, 9);
    expect(result.critDmg).toBeCloseTo(pooled.critDmg + naked.critDmg * 0.08, 9);
    expect(result.penetration).toBe(pooled.penetration);
    expect(result.cdr).toBe(pooled.cdr);
    expect(result.luck).toBeCloseTo(pooled.luck + 2, 9);
  });

  it('AC-05: luck_add is flat, not proportional — the two forms differ by a stated amount', () => {
    const tree: TreeSheetTotals = { ...WAVE0_ZERO_TREE, luckFlatPct: 3 };
    const flatResult = applySkillTree(pooled, naked, sheetOther, tree).luck;
    const proportionalForm = pooled.luck * (1 + tree.luckFlatPct / 100);
    expect(flatResult).toBeCloseTo(pooled.luck + 3, 9);
    expect(flatResult).not.toBeCloseTo(proportionalForm, 6);
    expect(Math.abs(flatResult - proportionalForm)).toBeGreaterThan(0.01);
  });

  it('AC-04: penetration and cdr receive exactly 0 from the tree even with a large treePct-shaped input', () => {
    const tree: TreeSheetTotals = { ...WAVE0_ZERO_TREE, danoStatic: 2, energyPct: 50 };
    const result = applySkillTree(pooled, naked, sheetOther, tree);
    expect(result.penetration).toBe(pooled.penetration);
    expect(result.cdr).toBe(pooled.cdr);
  });
});

describe('birthFromSaveUnits (AC-08 — the single AD-BSP-19a conversion site)', () => {
  it('converts crit_dmg as (x - 1) * 100 and penetration as 1:1', () => {
    const converted = birthFromSaveUnits({
      dmg: 100, energia: 200, speed: 50, penetration: 12.34,
      crit_chance: 0.08, cooldown_reduction: 0.02, crit_dmg: 1.5, luck: 0.05,
    });
    expect(converted.critDmg).toBeCloseTo(50, 9); // (1.5 - 1) * 100
    expect(converted.penetration).toBe(12.34);
    expect(converted.critChance).toBeCloseTo(8, 9);
    expect(converted.cdr).toBeCloseTo(2, 9);
    expect(converted.luck).toBeCloseTo(5, 9);
    expect(converted.attack).toBe(100);
    expect(converted.energy).toBe(200);
    expect(converted.speed).toBe(50);
  });
});

describe('composeSheetFromBirth — AC-06, AC-07: 21 hero-instances × 8 keys', () => {
  let worstResidual = 0;
  let worstDescription = '';
  let bellatrixStarsAsserted = false;

  for (const { file, names } of FIXTURES) {
    const raw = loadFixtureJson(file);
    const treeRaw = (raw.skills as { totals: Record<string, unknown> }).totals;
    const tree = treeTotalsFromSave(treeRaw);

    for (const [name, level] of names) {
      it(`${file} :: ${name} L${level} composes within 1e-6 on all 8 keys`, () => {
        const hero = extractHero(raw, name, level);
        expect(hero.birth, `${name} must carry birth_stats`).toBeDefined();
        if (name === 'Bellatrix' && file === 'save-20260801-crit-dmg-tree.json') {
          // AC-07: exercise starsMult above ★1 for the first time (E-01).
          expect(hero.stars).toBe(2);
          bellatrixStarsAsserted = true;
        }

        const solvedRaw = solveSpentPoints(hero, tree);
        const pts = roundPts(solvedRaw);

        const composed = composeSheetFromBirth({
          birth: hero.birth!,
          level: hero.level,
          stars: hero.stars,
          sheetOther: hero.sheetOther,
          loadout: hero.loadout,
          pts,
          tree,
        });

        for (const key of SHEET_KEYS) {
          const residual = Math.abs(composed[key] - hero.sheet[key]);
          expect(residual, `${name}.${key}: got ${composed[key]} want ${hero.sheet[key]}`).toBeLessThanOrEqual(1e-6);
          if (residual > worstResidual) {
            worstResidual = residual;
            worstDescription = `${file}:${name}.${key}`;
          }
        }
      });
    }
  }

  it('the worst observed residual across every hero-instance is below 1e-9', () => {
    expect(worstResidual, worstDescription).toBeLessThan(1e-9);
  });

  it('AC-07 was actually exercised (guards against a silently-skipped Bellatrix case)', () => {
    expect(bellatrixStarsAsserted).toBe(true);
  });
});

describe('composeSheetFromBirth — treeless account is a pure pass-through', () => {
  it('a hero with no gear and no points composes to the birth roll at level 1 stars 0', () => {
    const birth: BirthStats = {
      attack: 55, energy: 100, speed: 48, critChance: 5, critDmg: 50, penetration: 0.75, cdr: 1, luck: 2.5,
    };
    const composed = composeSheetFromBirth({
      birth,
      level: 1,
      stars: 0,
      sheetOther: emptySheetOther(),
      loadout: emptyLoadout(),
      pts: ZERO_PTS(),
      tree: WAVE0_ZERO_TREE,
    });
    for (const key of SHEET_KEYS) {
      expect(composed[key], key).toBeCloseTo(birth[key], 9);
    }
  });
});
