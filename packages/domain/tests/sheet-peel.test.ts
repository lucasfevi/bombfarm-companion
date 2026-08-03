/**
 * BSPW4-02 (AC-09…AC-18) — the game's four tooltip lines per sheet key.
 *
 * Shares the same test-local point-solver approach as `birth-sheet.test.ts` (see that
 * file's header) — a small, non-exported inversion of the linear algebra, used only to
 * recover a real spent-point vector for the sum-identity check (AC-10).
 */
import { describe, expect, it } from 'vitest';
import { composeSheetFromBirth, nakedFromBirth } from '@bombfarm/domain/birth-sheet';
import { peelSheetSources, type SourceLines } from '@bombfarm/domain/sheet-peel';
import type { TreeSheetTotals } from '@bombfarm/domain/birth-sheet';
import { attackPointGain, POINT_GAIN } from '@bombfarm/domain/model';
import { starsMult, sumGearBonuses } from '@bombfarm/domain/gear';
import { SHEET_KEYS, type SheetKey } from '@bombfarm/domain/planner-constants';
import type { SaveHeroSheet } from './helpers/sheet-math-fixtures';
import { extractHero, loadFixtureJson, treeTotalsFromSave } from './helpers/sheet-math-fixtures';

function poolFactor(percent: number): number {
  return 1 + Math.max(0, percent);
}

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
  const raw: Record<SheetKey, number> = {
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

function sumLines(lines: SourceLines): number {
  return lines.hero + lines.gear + lines.ability + lines.skillTree;
}

describe('peelSheetSources — AC-09, AC-10: shape and sum identity over 21 hero-instances', () => {
  it('AC-09: returns hero/gear/ability/skillTree for every SHEET_KEYS entry', () => {
    const raw = loadFixtureJson('save-20260801-crit-dmg-tree.json');
    const tree = treeTotalsFromSave((raw.skills as { totals: Record<string, unknown> }).totals);
    const hero = extractHero(raw, 'Bellatrix', 62);
    const pts = solveSpentPoints(hero, tree);
    const lines = peelSheetSources({
      birth: hero.birth!,
      level: hero.level,
      stars: hero.stars,
      sheetOther: hero.sheetOther,
      loadout: hero.loadout,
      pts,
      tree,
    });
    for (const key of SHEET_KEYS) {
      expect(lines[key]).toHaveProperty('hero');
      expect(lines[key]).toHaveProperty('gear');
      expect(lines[key]).toHaveProperty('ability');
      expect(lines[key]).toHaveProperty('skillTree');
    }
  });

  for (const { file, names } of FIXTURES) {
    const raw = loadFixtureJson(file);
    const tree = treeTotalsFromSave((raw.skills as { totals: Record<string, unknown> }).totals);

    for (const [name, level] of names) {
      it(`AC-10: ${file} :: ${name} L${level} — four lines sum to composeSheetFromBirth within 1e-9`, () => {
        const hero = extractHero(raw, name, level);
        const pts = solveSpentPoints(hero, tree);
        const input = {
          birth: hero.birth!,
          level: hero.level,
          stars: hero.stars,
          sheetOther: hero.sheetOther,
          loadout: hero.loadout,
          pts,
          tree,
        };
        const composed = composeSheetFromBirth(input);
        const lines = peelSheetSources(input);
        for (const key of SHEET_KEYS) {
          const sum = sumLines(lines[key]);
          expect(Math.abs(sum - composed[key]), `${name}.${key}`).toBeLessThanOrEqual(1e-9);
        }
      });
    }
  }
});

describe('peelSheetSources — AC-11, AC-12, AC-13, AC-14: per-key shapes', () => {
  const raw = loadFixtureJson('save-20260801-crit-dmg-tree.json');
  const tree = treeTotalsFromSave((raw.skills as { totals: Record<string, unknown> }).totals);
  const hero = extractHero(raw, 'Bellatrix', 62);
  const pts = solveSpentPoints(hero, tree);
  const input = {
    birth: hero.birth!,
    level: hero.level,
    stars: hero.stars,
    sheetOther: hero.sheetOther,
    loadout: hero.loadout,
    pts,
    tree,
  };
  const lines = peelSheetSources(input);

  it('AC-11: attack skillTree === (hero+gear+ability) × (dmg_static - 1)', () => {
    const attack = lines.attack;
    expect(attack.skillTree).toBeCloseTo((attack.hero + attack.gear + attack.ability) * (tree.danoStatic - 1), 6);
    expect(attack.hero + attack.gear + attack.ability + attack.skillTree).toBeCloseTo(
      (attack.hero + attack.gear + attack.ability) * tree.danoStatic,
      6,
    );
  });

  it('AC-12: energy skillTree === (hero+gear) × energia_add; ability === 0', () => {
    const energy = lines.energy;
    expect(energy.ability).toBe(0);
    expect(energy.skillTree).toBeCloseTo((energy.hero + energy.gear) * (tree.energyPct / 100), 6);
  });

  it('AC-13: luck skillTree === luck_add × 100 exactly, independent of roll/gear/points', () => {
    expect(lines.luck.skillTree).toBe(tree.luckFlatPct);
    const otherHero = extractHero(raw, 'Korin', 50);
    const otherPts = solveSpentPoints(otherHero, tree);
    const otherLines = peelSheetSources({
      birth: otherHero.birth!,
      level: otherHero.level,
      stars: otherHero.stars,
      sheetOther: otherHero.sheetOther,
      loadout: otherHero.loadout,
      pts: otherPts,
      tree,
    });
    expect(otherLines.luck.skillTree).toBe(tree.luckFlatPct);
    expect(otherLines.luck.hero).not.toBeCloseTo(lines.luck.hero, 2);
  });

  it('AC-14: penetration and cdr skillTree are exactly 0 (toBe, not toBeCloseTo)', () => {
    expect(lines.penetration.skillTree).toBe(0);
    expect(lines.cdr.skillTree).toBe(0);
  });
});

describe('peelSheetSources — AC-15, AC-16: the Bellatrix / Korin crit-damage tooltips', () => {
  const raw = loadFixtureJson('save-20260801-crit-dmg-tree.json');
  const tree = treeTotalsFromSave((raw.skills as { totals: Record<string, unknown> }).totals);

  it('AC-15: Bellatrix crit-damage tooltip reproduces line-for-line', () => {
    const hero = extractHero(raw, 'Bellatrix', 62);
    const pts = solveSpentPoints(hero, tree);
    const lines = peelSheetSources({
      birth: hero.birth!,
      level: hero.level,
      stars: hero.stars,
      sheetOther: hero.sheetOther,
      loadout: hero.loadout,
      pts,
      tree,
    });
    expect(lines.critDmg.hero).toBeCloseTo(554.9184, 4);
    expect(lines.critDmg.gear).toBe(0);
    expect(lines.critDmg.ability).toBeCloseTo(0, 4);
    expect(lines.critDmg.skillTree).toBeCloseTo(26.4198, 4);
    expect(sumLines(lines.critDmg)).toBeCloseTo(581.3382, 4);
  });

  it('AC-16: Korin ability !== 0 and === base × 0.04 × 20 (golpe_brutal rank 20)', () => {
    const hero = extractHero(raw, 'Korin', 50);
    expect(hero.abilities.golpe_brutal).toBe(20);
    const pts = solveSpentPoints(hero, tree);
    const naked = nakedFromBirth(hero.birth!, hero.level, hero.stars, hero.sheetOther);
    const baseCritDmg = naked.critDmg / poolFactor(hero.sheetOther.critDmg);
    const lines = peelSheetSources({
      birth: hero.birth!,
      level: hero.level,
      stars: hero.stars,
      sheetOther: hero.sheetOther,
      loadout: hero.loadout,
      pts,
      tree,
    });
    expect(lines.critDmg.ability).not.toBe(0);
    expect(lines.critDmg.ability).toBeCloseTo(baseCritDmg * 0.04 * 20, 6);
  });
});

describe('peelSheetSources — AC-17: the Bellatrix attack tooltip', () => {
  it('reproduces Hero 2429.98 / Gear 1295.80 / Ability 0 / Skill tree 2918.20 -> 6643.98', () => {
    const raw = loadFixtureJson('save-20260801-crit-dmg-tree.json');
    const tree = treeTotalsFromSave((raw.skills as { totals: Record<string, unknown> }).totals);
    const hero = extractHero(raw, 'Bellatrix', 62);
    const pts = solveSpentPoints(hero, tree);
    const lines = peelSheetSources({
      birth: hero.birth!,
      level: hero.level,
      stars: hero.stars,
      sheetOther: hero.sheetOther,
      loadout: hero.loadout,
      pts,
      tree,
    });
    expect(lines.attack.hero).toBeCloseTo(2429.98, 2);
    expect(lines.attack.gear).toBeCloseTo(1295.8, 2);
    expect(lines.attack.ability).toBe(0);
    expect(lines.attack.skillTree).toBeCloseTo(2918.2, 2);
    const sum = sumLines(lines.attack);
    expect(sum).toBeCloseTo(6643.98, 2);
    expect(Math.abs(sum - 6643.97915510094)).toBeLessThanOrEqual(0.01);
  });
});

describe('peelSheetSources — AC-18: crit_dmg_add === 0 fixtures peel cleanly (E-02 regression guard)', () => {
  it('bellatrix-02-pts-each-1.json has crit_dmg_add 0, so critDmg skillTree is exactly 0', () => {
    const raw = loadFixtureJson('bellatrix-02-pts-each-1.json');
    const tree = treeTotalsFromSave((raw.skills as { totals: Record<string, unknown> }).totals);
    expect(tree.critDmgPct).toBe(0);
    const hero = extractHero(raw, 'Bellatrix', 59);
    const pts = solveSpentPoints(hero, tree);
    const lines = peelSheetSources({
      birth: hero.birth!,
      level: hero.level,
      stars: hero.stars,
      sheetOther: hero.sheetOther,
      loadout: hero.loadout,
      pts,
      tree,
    });
    expect(lines.critDmg.skillTree).toBe(0);
  });
});

describe('peelSheetSources — gear-free hero: every gear line is exactly 0', () => {
  it('Vera (bellatrix-02-pts-each-1.json, 8 empty slots) has gear === 0 for every key', () => {
    const raw = loadFixtureJson('bellatrix-02-pts-each-1.json');
    const tree = treeTotalsFromSave((raw.skills as { totals: Record<string, unknown> }).totals);
    const hero = extractHero(raw, 'Vera', 17);
    expect(Object.values(hero.loadout).every((slot) => slot == null)).toBe(true);
    const pts = solveSpentPoints(hero, tree);
    const lines = peelSheetSources({
      birth: hero.birth!,
      level: hero.level,
      stars: hero.stars,
      sheetOther: hero.sheetOther,
      loadout: hero.loadout,
      pts,
      tree,
    });
    for (const key of SHEET_KEYS) {
      expect(lines[key].gear, key).toBe(0);
    }
  });
});
