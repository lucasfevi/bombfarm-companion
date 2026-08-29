/**
 * Web-side mirror of `packages/domain/tests/postpatch-damage-model.test.ts` — the 2026-08-28
 * damage patch, read through the planner's own helpers.
 *
 * The planner is the surface the weapon ×5 is visible on: a hero's Attack column is naked plus
 * `sumGearBonuses().dmgFlat`, so a catalog that still carried the pre-patch weapon value would
 * under-report every armed hero here and nowhere else in the test tree would notice.
 */
import { describe, expect, it } from 'vitest';
import catalog from '@bombfarm/domain/data/catalog.json';
import { composeSheetFromBirth } from '@bombfarm/domain/birth-sheet';
import { sumGearBonuses } from '@bombfarm/domain/gear';
import { inferSpentPoints } from '@bombfarm/domain/point-inference';
import { SHEET_KEYS } from '@bombfarm/domain/planner-constants';
import { extractHero, loadFixtureJson, treeTotalsFromSave } from './helpers/sheet-math-fixtures';

const FILE = 'save-20260828-4heroes-postpatch.json';
const data = loadFixtureJson(FILE);
const tree = treeTotalsFromSave((data as { skills: { totals: Record<string, unknown> } }).skills.totals);

const GEARED = ['Jon', 'Bellatrix'] as const;

describe('the 2026-08-28 damage patch, through the planner', () => {
  it.each(GEARED)('%s carries the armed weapon value in dmgFlat, not the pre-patch one', (name) => {
    const hero = extractHero(data, name);
    expect(hero.loadout.arma?.defId, `${name} must be armed or this is vacuous`).toBe('ember_arma');
    const bonuses = sumGearBonuses(hero.loadout);
    const armedLadder =
      catalog.statBase.dmg * (catalog.dmgNivelMult as Record<string, number>)['10'] * catalog.armaDmgMult;
    expect(bonuses.dmgFlat, `${name} gear Dano`).toBeGreaterThanOrEqual(armedLadder);
  });

  it.each(GEARED)('%s recomposes to the Attack the game exported', (name) => {
    const hero = extractHero(data, name);
    const input = {
      birth: hero.birth!,
      level: hero.level,
      stars: hero.stars,
      sheetOther: hero.sheetOther,
      loadout: hero.loadout,
      tree,
    };
    const inferred = inferSpentPoints({
      ...input,
      sheet: hero.sheet,
      statPointsAvailable: hero.statPointsAvailable,
    });
    expect(inferred.issues, `${name} inversion issues`).toEqual([]);
    const composed = composeSheetFromBirth({ ...input, pts: inferred.pts });
    for (const key of SHEET_KEYS) {
      expect(Math.abs(hero.sheet[key] - composed[key]), `${name} ${key}`).toBeLessThanOrEqual(1e-6);
    }
  });
});
