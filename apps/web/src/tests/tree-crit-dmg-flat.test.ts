/**
 * The skill tree's `crit_dmg_add` is a FLAT percentage-point addend, not percent-of-base.
 *
 * It was modelled percent-of-base on the strength of `AD-BSP-22`'s reading alone: every capture
 * in the corpus carried `crit_dmg_add: 0`, so nothing could tell the two shapes apart and both
 * `applySkillTree` and `point-inference` said so in comments. `save-20260822-15heroes-tree-crit-dmg.json`
 * is the first capture with a nonzero value (`0.081730769`) and it separates them outright.
 *
 * This is the SECOND crit-damage term to be caught reading percent-of-base when the game applies
 * it flat — Golpe Brutal was the first (`abilities.ts`, the `critDmgFlat` kind), and the stat
 * point itself the reference case (`POINT_GAIN.critDmgFlat`). Every crit-damage term the game
 * has is flat; the file that proves it should stay next to the two that record the others.
 */
import { describe, expect, it } from 'vitest';
import { applySkillTree, nakedFromBirth } from '@bombfarm/domain/birth-sheet';
import { inferSpentPoints } from '@bombfarm/domain/point-inference';
import { SHEET_KEYS } from '@bombfarm/domain/planner-constants';
import { extractHero, loadFixtureJson, treeTotalsFromSave } from '@/tests/helpers/sheet-math-fixtures';

const CAPTURE = 'save-20260822-15heroes-tree-crit-dmg.json';

const raw = loadFixtureJson(CAPTURE);
const heroesRaw = raw.heroes as Record<string, unknown>[];
const tree = treeTotalsFromSave(
  (raw.skills as Record<string, unknown>).totals as Record<string, unknown>,
);
const HEROES = heroesRaw.map((h) => extractHero(raw, String(h.name), Number(h.level)));

describe('skill tree crit_dmg_add is flat, not percent-of-base', () => {
  it('the capture carries a nonzero crit_dmg_add — the whole reason it is committed', () => {
    expect(tree.critDmgPct).toBeCloseTo(8.1730769, 7);
    expect(HEROES).toHaveLength(15);
  });

  /**
   * The witness. Every hero's `stats.crit_dmg − birth_stats.crit_dmg` is the SAME number, and it
   * is `crit_dmg_add` — across birth rolls spanning 45.03 … 73.13 crit-damage percentage points
   * and levels 1 … 97, one of them (Buff S #1) also carrying Golpe Brutal's flat +80. Items never
   * roll crit damage and no hero here holds a crit-damage point, so the tree is the only term in
   * the gap.
   *
   * Percent-of-base cannot produce a constant gap from a varying base: it would have spread the
   * same total over 3.68 … 5.98 points, hero by hero. That spread is asserted below, so this pair
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
    expect(Math.min(...wouldHaveBeen)).toBeCloseTo(3.68, 1);
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
   * The bug as the player met it: a level-97 Bellatrix whose point-reset panel offered 98 points
   * to re-place, one of them a crit-damage point never spent. Under percent-of-base the tree was
   * credited `67.73 × 0.0817 = 5.54` of the 8.17 it actually gave, and inference charged the
   * `2.64` residual to points — `2.64 / 5 = 0.53`, which rounds to 1.
   */
  it('no hero recovers a crit-damage point, and none exceeds its level', () => {
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
      const spent = SHEET_KEYS.reduce((sum, key) => sum + pts[key], 0);
      expect(spent, `${label}: total spent`).toBeLessThanOrEqual(hero.level);
      expect(
        issues.filter((i) => i.kind === 'nonIntegerPoints'),
        `${label}: a non-integer solve means a sheet contribution is still mis-attributed`,
      ).toEqual([]);
    }
  });
});
