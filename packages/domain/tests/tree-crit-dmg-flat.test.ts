/**
 * The skill tree's `crit_dmg_add` is a FLAT percentage-point addend, not percent-of-base.
 *
 * It was modelled percent-of-base on the strength of an earlier reading of the skills.totals
 * shapes alone: every capture in the corpus carried `crit_dmg_add: 0`, so nothing could tell the
 * two shapes apart. The first nonzero tree value separated them outright; this file now reads the
 * second account's 2026-09-14 export, whose tree carries `0.523076922` and whose nine heroes hold
 * no crit-damage point at all — the only post-boundary roster where that is true, which is what
 * the single-difference witness below needs.
 *
 * This is the THIRD crit-damage term to be caught reading percent-of-base when the game applies
 * it flat — the stat point was the reference case (`POINT_GAIN.critDmgFlat`) and Golpe Brutal the
 * second (`abilities.ts`, the `critDmgFlat` kind). Every crit-damage term the game has is flat;
 * the file that proves it should stay next to the two that record the others.
 */
import { describe, expect, it } from 'vitest';
import { holdSuiteUntilInRegime } from './helpers/capture-regime';
import { applySkillTree, nakedFromBirth } from '@bombfarm/domain/birth-sheet';
import { emptySheetOther, starsMult } from '@bombfarm/domain/gear';
import { inferSpentPoints } from '@bombfarm/domain/point-inference';
import { SHEET_KEYS } from '@bombfarm/domain/planner-constants';
import { extractHero, loadFixtureJson, treeTotalsFromSave } from './helpers/sheet-math-fixtures';

const CAPTURE = 'save-20260914-9heroes-second-account.json';

holdSuiteUntilInRegime(`sheet-math/${CAPTURE}`, 'sheet');

const raw = loadFixtureJson(CAPTURE);
const heroesRaw = raw.heroes as Record<string, unknown>[];
const tree = treeTotalsFromSave(
  (raw.skills as Record<string, unknown>).totals as Record<string, unknown>,
);
const HEROES = heroesRaw.map((h) => extractHero(raw, String(h.name), Number(h.level)));
const UNSTARRED = HEROES.filter((h) => h.stars === 0);
const STARRED = HEROES.filter((h) => h.stars > 0);

describe('skill tree crit_dmg_add is flat, not percent-of-base', () => {
  it('the capture carries a nonzero crit_dmg_add — the whole reason it is committed', () => {
    expect(tree.critDmgPct).toBeCloseTo(52.3076922, 7);
    expect(HEROES).toHaveLength(9);
    expect(UNSTARRED.map((h) => h.name)).toEqual(['Sora', 'Lyra', 'Devin', 'Dara', 'Quill', 'Nyx', 'Isolde']);
    expect(STARRED.map((h) => [h.name, h.stars])).toEqual([
      ['Kira', 1],
      ['Nolan', 1],
    ]);
  });

  /**
   * The witness, on the ★0 heroes — chosen by their star count, an exported field, so nothing in
   * the model selects the subset. Every one's `stats.crit_dmg − birth_stats.crit_dmg` is the SAME
   * number, and it is `crit_dmg_add` — across birth rolls spanning 48.74 … 72.87 crit-damage
   * percentage points and levels 41 … 88, one of them (Sora) also carrying Golpe Brutal's flat
   * +80 and one (Isolde) holding every point unspent. Items never roll crit damage and no hero
   * here holds a crit-damage point, so the tree is the only term in the gap.
   *
   * Percent-of-base cannot produce a constant gap from a varying base: it would have spread the
   * same total over 25.5 … 44.6 points, hero by hero. That spread is asserted below, so this pair
   * of tests fails in BOTH directions rather than merely agreeing with the current code.
   */
  it('every ★0 hero gains exactly crit_dmg_add over its birth roll, independent of the roll', () => {
    const gains = UNSTARRED.map((h) => ({
      name: h.name,
      birth: h.birth!.critDmg,
      // Golpe Brutal's own flat addend peels off first — Sora carries it at 20/20 (+80).
      gain: h.sheet.critDmg - h.birth!.critDmg - Math.max(0, h.sheetOther.critDmgFlat),
    }));
    expect(
      UNSTARRED.filter((h) => h.sheetOther.critDmgFlat > 0).map((h) => h.sheetOther.critDmgFlat),
      'the roster must include a Golpe Brutal hero, so the two flat terms are proven to stack',
    ).toEqual([80]);
    for (const { name, gain } of gains) {
      expect(gain, `${name}: crit-damage gain over birth`).toBeCloseTo(tree.critDmgPct, 6);
    }
    // Non-vacuity: the bases really do vary, so a constant gain is information.
    const bases = gains.map((g) => g.birth);
    expect(Math.max(...bases) - Math.min(...bases)).toBeGreaterThan(20);
  });

  it('the percent-of-base shape this replaces would have varied hero by hero', () => {
    const wouldHaveBeen = HEROES.map((h) => h.birth!.critDmg * (tree.critDmgPct / 100));
    expect(Math.min(...wouldHaveBeen)).toBeCloseTo(25.49, 1);
    expect(Math.max(...wouldHaveBeen)).toBeCloseTo(44.59, 1);
  });

  it('applySkillTree reproduces each hero`s exported crit damage from its birth roll', () => {
    for (const hero of HEROES) {
      const naked = nakedFromBirth(hero.birth!, hero.level, hero.stars, hero.sheetOther);
      // Gear contributes nothing to crit damage and no hero here holds a crit-damage point, so
      // naked → tree is the whole chain for this stat.
      const withTree = applySkillTree(naked, naked, hero.sheetOther, tree);
      expect(withTree.critDmg, `${hero.name} L${hero.level}`).toBeCloseTo(hero.sheet.critDmg, 6);
    }
  });

  /**
   * ★ SCALING, OBSERVED. The replaced percent-of-base shape read `birth.critDmg × star` as its
   * base, so it scaled with stars; a flat addend does not. Kira and Nolan are ★1: their exported
   * crit damage sits exactly `crit_dmg_add` above the star-scaled roll, not `star × crit_dmg_add`
   * — so the tree term is flat AND star-independent, like every other flat term (the stat point,
   * Golpe Brutal, `luck_add`), and `rescaleNakedForStars` is right to hold it out of the ★ ratio.
   * ★2 and above remain unobserved on a points-free hero; the model extends the same rule there.
   */
  it('the tree term does not scale with stars — Kira and Nolan (★1) gain crit_dmg_add, not star × crit_dmg_add', () => {
    for (const hero of STARRED) {
      const scaledRoll = hero.birth!.critDmg * starsMult(hero.stars);
      const gain = hero.sheet.critDmg - scaledRoll;
      expect(gain, `${hero.name} ★${hero.stars}`).toBeCloseTo(tree.critDmgPct, 6);
      expect(Math.abs(gain - tree.critDmgPct * starsMult(hero.stars)), `${hero.name}: a scaled term would read this far off`).toBeGreaterThan(10);
      expect(scaledRoll - hero.birth!.critDmg, `${hero.name}: the ★ factor really moves the base`).toBeGreaterThan(10);
    }
    const birth = HEROES[0].birth!;
    const other = emptySheetOther();
    for (const stars of [2, 4]) {
      const naked = nakedFromBirth(birth, 50, stars, other);
      expect(applySkillTree(naked, naked, other, tree).critDmg - naked.critDmg, `★${stars}, unobserved`).toBeCloseTo(tree.critDmgPct, 9);
    }
  });

  /**
   * The bug as the player met it: a level-97 hero whose point-reset panel offered 98 points to
   * re-place, one of them a crit-damage point never spent. Under percent-of-base the tree was
   * credited `67.73 × 0.0817 = 5.54` of the 8.17 it actually gave, and inference charged the
   * `2.64` residual to points — `2.64 / 5 = 0.53`, which rounds to 1.
   */
  it('every hero solves exactly on its budget, with no crit-damage point and no issue at all', () => {
    for (const hero of HEROES) {
      const { pts, issues } = inferSpentPoints({
        birth: hero.birth!,
        level: hero.level,
        stars: hero.stars,
        sheetOther: hero.sheetOther,
        loadout: hero.loadout,
        tree,
        sheet: hero.sheet,
        statPointsAvailable: hero.statPointsAvailable,
      });
      const label = `${hero.name} L${hero.level}`;
      expect(pts.critDmg, `${label}: crit-damage points`).toBe(0);
      // The budget is `level − stat_points_available` and the solve lands on it exactly.
      // Asserting equality rather than `<= budget`: a `budgetMismatch` that happens to round to
      // whole numbers on every key would slip past the weaker bound, and that is precisely the
      // shape of the bug this file exists for.
      const spent = SHEET_KEYS.reduce((sum, key) => sum + pts[key], 0);
      expect(spent, `${label}: total spent`).toBe(hero.level - hero.statPointsAvailable);
      expect(
        issues,
        `${label}: any issue at all means a sheet contribution is still mis-attributed`,
      ).toEqual([]);
    }
    expect(
      HEROES.filter((h) => h.statPointsAvailable > 0).map((h) => [h.name, h.statPointsAvailable]),
      'Isolde alone banks points — all 67 of them, so her solve is the zero vector',
    ).toEqual([['Isolde', 67]]);
  });
});
