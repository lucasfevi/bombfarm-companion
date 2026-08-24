/**
 * The skill tree's `crit_dmg_add` is a FLAT percentage-point addend, not percent-of-base.
 *
 * It was modelled percent-of-base on the strength of `AD-BSP-22`'s reading alone: every capture
 * in the corpus carried `crit_dmg_add: 0`, so nothing could tell the two shapes apart and both
 * `applySkillTree` and `point-inference` said so in comments. `save-20260822-15heroes-tree-crit-dmg.json`
 * was the first capture with a nonzero value (`0.081730769`) and separated them outright; this
 * file now reads the 2026-08-23 capture, which carries the same tree value and is the only one
 * whose crit-CHANCE shape the current model reproduces.
 *
 * This is the THIRD crit-damage term to be caught reading percent-of-base when the game applies
 * it flat — the stat point was the reference case (`POINT_GAIN.critDmgFlat`) and Golpe Brutal the
 * second (`abilities.ts`, the `critDmgFlat` kind). Every crit-damage term the game has is flat;
 * the file that proves it should stay next to the two that record the others.
 */
import { describe, expect, it } from 'vitest';
import { applySkillTree, nakedFromBirth } from '@bombfarm/domain/birth-sheet';
import { emptySheetOther, starsMult } from '@bombfarm/domain/gear';
import { inferSpentPoints } from '@bombfarm/domain/point-inference';
import { SHEET_KEYS } from '@bombfarm/domain/planner-constants';
import { extractHero, loadFixtureJson, treeTotalsFromSave } from '@/tests/helpers/sheet-math-fixtures';

const CAPTURE = 'save-20260823-13heroes-crit-points.json';

const raw = loadFixtureJson(CAPTURE);
const heroesRaw = raw.heroes as Record<string, unknown>[];
const tree = treeTotalsFromSave(
  (raw.skills as Record<string, unknown>).totals as Record<string, unknown>,
);
const HEROES = heroesRaw.map((h) => extractHero(raw, String(h.name), Number(h.level)));

describe('skill tree crit_dmg_add is flat, not percent-of-base', () => {
  it('the capture carries a nonzero crit_dmg_add — the whole reason it is committed', () => {
    expect(tree.critDmgPct).toBeCloseTo(8.1730769, 7);
    expect(HEROES).toHaveLength(13);
  });

  /**
   * The witness. Every hero's `stats.crit_dmg − birth_stats.crit_dmg` is the SAME number, and it
   * is `crit_dmg_add` — across birth rolls spanning 47.51 … 73.13 crit-damage percentage points
   * and levels 2 … 106, one of them (Buff S #1) also carrying Golpe Brutal's flat +80. Items never
   * roll crit damage and no hero here holds a crit-damage point, so the tree is the only term in
   * the gap.
   *
   * Percent-of-base cannot produce a constant gap from a varying base: it would have spread the
   * same total over 3.88 … 5.98 points, hero by hero. That spread is asserted below, so this pair
   * of tests fails in BOTH directions rather than merely agreeing with the current code.
   */
  it('every hero gains exactly crit_dmg_add, independent of its birth roll', () => {
    const gains = HEROES.map((h) => ({
      name: h.name,
      birth: h.birth!.critDmg,
      // Golpe Brutal's own flat addend peels off first — Buff S #1 carries it at 20/20 (+80).
      gain: h.sheet.critDmg - h.birth!.critDmg - Math.max(0, h.sheetOther.critDmgFlat),
    }));
    expect(
      HEROES.filter((h) => h.sheetOther.critDmgFlat > 0).map((h) => h.sheetOther.critDmgFlat),
      'the roster must include a Golpe Brutal hero, so the two flat terms are proven to stack',
    ).toEqual([80]);
    for (const { name, gain } of gains) {
      expect(gain, `${name}: crit-damage gain over birth`).toBeCloseTo(tree.critDmgPct, 6);
    }
    // Non-vacuity: the bases really do vary, so a constant gain is information.
    const bases = gains.map((g) => g.birth);
    expect(Math.max(...bases) - Math.min(...bases)).toBeGreaterThan(25);
  });

  it('the percent-of-base shape this replaces would have varied hero by hero', () => {
    const wouldHaveBeen = HEROES.map((h) => h.birth!.critDmg * (tree.critDmgPct / 100));
    expect(Math.min(...wouldHaveBeen)).toBeCloseTo(3.88, 1);
    expect(Math.max(...wouldHaveBeen)).toBeCloseTo(5.98, 1);
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
   * ★ SCALING IS UNOBSERVED, AND THIS PINS THE CHOICE MADE IN ITS ABSENCE.
   *
   * The replaced percent-of-base shape read `birth.critDmg × star` as its base, so it scaled
   * with stars; a flat addend does not. Every hero in this capture — and in the whole corpus —
   * is ★0, so no capture can say which the game does. Flat-and-unscaled is the choice, for
   * consistency with every other flat term: the crit-damage stat point, Golpe Brutal, and
   * `luck_add` are all ★-independent, and `rescaleNakedForStars` already holds `critDmgFlat`
   * out of the ★ ratio deliberately.
   *
   * Asserted rather than left implicit so the choice cannot drift silently. If a capture ever
   * shows a ★>0 hero gaining `star × crit_dmg_add`, THIS is the test that should be rewritten,
   * with the capture cited — not `applySkillTree` quietly patched. Until then, a ★>0 hero on a
   * tree that does scale would be under-credited, land a non-integer `critDmg` solve, and trip
   * the over-budget warning (`pointsExceedLevel`) rather than silently inventing points.
   */
  it('the tree term does not scale with stars — the unobserved half of the shape, pinned', () => {
    const birth = HEROES[0].birth!;
    const other = emptySheetOther();
    const gains = [0, 1, 2, 4].map((stars) => {
      const naked = nakedFromBirth(birth, 50, stars, other);
      return applySkillTree(naked, naked, other, tree).critDmg - naked.critDmg;
    });
    for (const gain of gains) expect(gain).toBeCloseTo(tree.critDmgPct, 9);
    // Non-vacuity: the ★ multiplier really is moving the base these gains sit on, so a constant
    // gain is a claim about the tree term and not an artifact of nothing changing.
    const nakedAt0 = nakedFromBirth(birth, 50, 0, other).critDmg;
    const nakedAt4 = nakedFromBirth(birth, 50, 4, other).critDmg;
    expect(nakedAt0).toBeCloseTo(birth.critDmg, 9);
    expect(nakedAt4 / nakedAt0).toBeCloseTo(starsMult(4), 9);
    // Only that the ★ factor really moves the base — the magnitude itself is pinned in
    // gear.test.ts, so this stays a bound and does not restate `STAR_MULT_PER_STAR`.
    expect(starsMult(4)).toBeGreaterThan(1.5);
  });

  /**
   * The bug as the player met it: a level-97 Bellatrix whose point-reset panel offered 98 points
   * to re-place, one of them a crit-damage point never spent. Under percent-of-base the tree was
   * credited `67.73 × 0.0817 = 5.54` of the 8.17 it actually gave, and inference charged the
   * `2.64` residual to points — `2.64 / 5 = 0.53`, which rounds to 1.
   */
  it('every hero solves exactly on its level, with no crit-damage point and no issue at all', () => {
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
      // Every hero here has `stat_points_available: 0`, so the budget IS the level and the
      // solve lands on it exactly. Asserting equality rather than `<= level`: a `budgetMismatch`
      // that happens to round to whole numbers on every key would slip past the weaker bound,
      // and that is precisely the shape of the bug this file exists for.
      const spent = SHEET_KEYS.reduce((sum, key) => sum + pts[key], 0);
      expect(hero.statPointsAvailable, `${label}: fixture precondition`).toBe(0);
      expect(spent, `${label}: total spent`).toBe(hero.level);
      expect(
        issues,
        `${label}: any issue at all means a sheet contribution is still mis-attributed`,
      ).toEqual([]);
    }
  });
});
