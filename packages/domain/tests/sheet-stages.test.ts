/**
 * Sheet stage peel — Birth + Δ columns sum to Total (= composeSheetFromBirth).
 */
import { describe, expect, it } from 'vitest';
import { composeSheetFromBirth, type TreeSheetTotals } from '@bombfarm/domain/birth-sheet';
import { peelSheetStages } from '@bombfarm/domain/sheet-stages';
import { SHEET_KEYS } from '@bombfarm/domain/planner-constants';
import type { SaveHeroSheet } from './helpers/sheet-math-fixtures';
import { extractHero, loadFixtureJson, treeTotalsFromSave } from './helpers/sheet-math-fixtures';
import { nakedFromBirth } from '@bombfarm/domain/birth-sheet';
import { attackPointGain, POINT_GAIN } from '@bombfarm/domain/model';
import { starsMult, sumGearBonuses } from '@bombfarm/domain/gear';
import type { SheetKey } from '@bombfarm/domain/planner-constants';

const SUM_TOL = 1e-6;

function poolFactor(percent: number): number {
  return 1 + Math.max(0, percent);
}

/** Same local solver as sheet-peel.test.ts — recover pts for sum checks. */
function solveSpentPoints(hero: SaveHeroSheet, tree: TreeSheetTotals): Record<SheetKey, number> {
  const birth = hero.birth;
  if (!birth) throw new Error(`${hero.name} has no birth_stats`);
  const naked = nakedFromBirth(birth, hero.level, hero.stars, hero.sheetOther);
  const baseSpeed = naked.speed / poolFactor(hero.sheetOther.speed);
  const baseCritChance = naked.critChance / poolFactor(hero.sheetOther.critChance);
  const baseCritDmg = naked.critDmg / poolFactor(hero.sheetOther.critDmg);
  const observed = hero.sheet;
  const pool = {
    speed: baseSpeed > 1e-12 ? (observed.speed - naked.speed) / baseSpeed : 0,
    critChance: baseCritChance > 1e-12 ? (observed.critChance - naked.critChance) / baseCritChance : 0,
    critDmg: baseCritDmg > 1e-12 ? (observed.critDmg - naked.critDmg) / baseCritDmg : 0,
    penetration:
      naked.penetration /
        poolFactor(hero.sheetOther.penetration) >
      1e-12
        ? (observed.penetration - naked.penetration) /
          (naked.penetration / poolFactor(hero.sheetOther.penetration))
        : 0,
    cdr:
      naked.cdr / poolFactor(hero.sheetOther.cdr) > 1e-12
        ? (observed.cdr - naked.cdr) / (naked.cdr / poolFactor(hero.sheetOther.cdr))
        : 0,
  };
  const bonuses = sumGearBonuses(hero.loadout);
  const star = starsMult(hero.stars);
  const atkPt = attackPointGain(hero.level) * star;
  const attackPreTree = (observed.attack / tree.danoStatic - bonuses.dmgFlat - naked.attack) / atkPt;
  const energyGem = 1 + bonuses.energyPct;
  const energyPts =
    (observed.energy / (1 + tree.energyPct / 100) - naked.energy * energyGem) /
    (POINT_GAIN.energyNative * energyGem * star);

  return {
    attack: Math.max(0, Math.round(attackPreTree)),
    energy: Math.max(0, Math.round(energyPts)),
    speed: Math.max(0, Math.round((pool.speed - bonuses.speedPct - tree.speedPct / 100) / POINT_GAIN.speedPctOfBase)),
    critChance: Math.max(
      0,
      Math.round((pool.critChance - bonuses.critPct - tree.critChancePct / 100) / POINT_GAIN.critChancePctOfBase),
    ),
    critDmg: Math.max(0, Math.round((pool.critDmg - tree.critDmgPct / 100) / POINT_GAIN.critDmgPctOfBase)),
    penetration: Math.max(
      0,
      Math.round((pool.penetration - bonuses.penPct) / POINT_GAIN.penetrationPctOfBase),
    ),
    cdr: Math.max(0, Math.round((pool.cdr - bonuses.cdrPct) / POINT_GAIN.cdrPctOfBase)),
    luck: Math.max(
      0,
      Math.round(
        (observed.luck - tree.luckFlatPct - naked.luck * (1 + bonuses.luckPct)) /
          (naked.luck * POINT_GAIN.luckPctOfBase),
      ),
    ),
  };
}

describe('peelSheetStages — Birth + Δs sum to Total', () => {
  const file = 'bellatrix-01-points-reset.json';
  const data = loadFixtureJson(file);

  it(`${file} :: every birth-capable hero — stages sum to composeSheetFromBirth`, () => {
    const heroes = (data as { heroes: Array<{ name: string }> }).heroes;
    for (const raw of heroes) {
      const hero = extractHero(data, raw.name);
      if (!hero.birth) continue;
      const tree = treeTotalsFromSave(data);
      const pts = solveSpentPoints(hero, tree);
      const input = {
        birth: hero.birth,
        level: hero.level,
        stars: hero.stars,
        sheetOther: hero.sheetOther,
        loadout: hero.loadout,
        pts,
        tree,
      };
      const stages = peelSheetStages(input);
      const composed = composeSheetFromBirth(input);
      for (const key of SHEET_KEYS) {
        const row = stages[key];
        const sum =
          row.birth +
          row.deltaLevel +
          row.deltaStars +
          row.deltaAbility +
          row.deltaGear +
          row.deltaPoints +
          row.deltaTree;
        expect(sum, `${hero.name} ${key} stages sum`).toBeCloseTo(row.total, 6);
        expect(row.total, `${hero.name} ${key} total`).toBeCloseTo(composed[key], 6);
        expect(Math.abs(sum - composed[key]), `${hero.name} ${key}`).toBeLessThanOrEqual(SUM_TOL);
      }
    }
  });

  it('speed has zero Δ level and Δ stars (AD-BSP-19)', () => {
    const hero = extractHero(data, 'Bellatrix');
    if (!hero.birth) throw new Error('Bellatrix missing birth');
    const tree = treeTotalsFromSave(data);
    const pts = solveSpentPoints(hero, tree);
    const row = peelSheetStages({
      birth: hero.birth,
      level: hero.level,
      stars: hero.stars,
      sheetOther: hero.sheetOther,
      loadout: hero.loadout,
      pts,
      tree,
    }).speed;
    expect(row.deltaLevel).toBe(0);
    expect(row.deltaStars).toBe(0);
  });
});
