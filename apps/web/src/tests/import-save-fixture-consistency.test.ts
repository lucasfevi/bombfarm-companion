import { describe, expect, it } from 'vitest';
import { composeSheetFromBirth } from '@bombfarm/domain/birth-sheet';
import { treeTotalsFromSave } from '@bombfarm/domain/save-units';
import { SHEET_KEYS, ZERO_PTS } from '@bombfarm/domain/planner-constants';
import { extractHero } from '@/tests/helpers/sheet-math-fixtures';
import { baseSave } from '@/tests/helpers/base-save-fixture';

/** The account tree, computed the same way `parseSaveFile` computes it. */
function saveTree(save: { skills?: { totals?: Record<string, unknown> } }) {
  return treeTotalsFromSave(save.skills?.totals ?? {});
}

/**
 * The FORWARD direction of the claim `baseSave()`'s three annotated heroes make: each one's
 * authored `stats` block is reproducible from its own authored birth, level, stars, items and
 * account tree, at the spent-point vector the comment states.
 *
 * Nothing used to assert it. Every sheet assertion in `import-save.test.ts` derives its expected
 * side from the import result — `expectedGearedOverride(rawCora, ..., cora.record.loadout, tree)`
 * compared against `cora.record.gearedOverride` reads `cora.record.loadout` on BOTH sides, so it
 * is `f(x) === f(x)` for whatever `x` the import produced. That pins `parseSaveFile` against
 * `composeSheetFromBirth`, which is worth having, and is structurally incapable of noticing the
 * fixture's authored `stats` drifting away from its authored `items`. It drifted: Lorne and
 * Brenna were both stale when this landed, and Brenna far enough that the importer refused her
 * — see their blocks in `helpers/base-save-fixture.ts`.
 *
 * The expected side here is the fixture's own authored `stats`, read straight off the literal
 * (`extractHero`'s `sheet` is `saveSheetUnits` of exactly that block), so a hero whose `stats`
 * stop matching its inputs fails, whichever side moved.
 */
const SELF_CONSISTENT_HEROES = [
  { name: 'Cora', pts: { ...ZERO_PTS(), attack: 2, critChance: 1 } },
  { name: 'Lorne', pts: ZERO_PTS() },
  { name: 'Brenna', pts: ZERO_PTS() },
] as const;

/**
 * Absolute, per key, in planner units. The composition is not bit-reproducible — the authored
 * literals are the round trip through save units — so `toEqual` is the wrong instrument. The
 * measured residual across all three heroes is at most 1.5e-14 (Cora's `critDmg`), so 1e-9 is
 * still four orders of magnitude tighter than any drift this guard is for: the smallest real one
 * it caught was Brenna's `cooldown_reduction`, off by 3.9e-2.
 */
const SELF_CONSISTENCY_TOL = 1e-9;

describe('baseSave() is self-consistent — authored stats vs authored inputs', () => {
  it.each(SELF_CONSISTENT_HEROES)('$name reproduces its own authored stats', ({ name, pts }) => {
    const save = baseSave();
    const hero = extractHero(save, name);
    if (!hero.birth) throw new Error(`${name} must carry birth_stats`);
    const composed = composeSheetFromBirth({
      birth: hero.birth,
      level: hero.level,
      stars: hero.stars,
      sheetOther: hero.sheetOther,
      loadout: hero.loadout,
      pts,
      tree: saveTree(save),
    });
    for (const key of SHEET_KEYS) {
      expect(
        Math.abs(hero.sheet[key] - composed[key]),
        `${name} ${key}: authored ${hero.sheet[key]}, composed ${composed[key]}`,
      ).toBeLessThanOrEqual(SELF_CONSISTENCY_TOL);
    }
  });

  /**
   * The loadout is the half the sheet check cannot see on its own, so it is stated separately.
   *
   * SWAPPING THE DEF IS NOT A USABLE MUTATION, and finding that out is why this assertion exists.
   * Every amuleto in the catalog rolls the same six stats with `valores` exactly proportional to
   * its native level, and `scaledValores` divides that back out — so `gold_amuleto` →
   * `forest_amuleto` at a fixed item level is stat-neutral to the last bit and the sheet check
   * above stays green through it. That is the same cancellation the 2026-08-15 `steel_` →
   * `gold_` note in Cora's block records (`helpers/base-save-fixture.ts`). The sheet check IS live against everything that moves
   * gear — item level 20 → 40 on this amulet takes Cora's attack 807.38 → 943.82 and turns it
   * red — but the def id itself needs pinning here, or it can be swapped for free.
   */
  it('the two geared heroes wear the items the fixture equips on them', () => {
    const save = baseSave();
    expect(extractHero(save, 'Cora').loadout.amuleto).toEqual({
      defId: 'gold_amuleto',
      rarityIdx: 2,
      level: 20,
      upgrade: 10,
    });
    expect(extractHero(save, 'Brenna').loadout.anel).toEqual({
      defId: 'gold_anel',
      rarityIdx: 2,
      level: 20,
      upgrade: 5,
    });
  });

  /** A hero the fixture does NOT claim is self-consistent, so the guard above is not universal. */
  it('Weird is deliberately inconsistent, and stays that way', () => {
    const save = baseSave();
    const hero = extractHero(save, 'Weird');
    const composed = composeSheetFromBirth({
      birth: hero.birth!,
      level: hero.level,
      stars: hero.stars,
      sheetOther: hero.sheetOther,
      loadout: hero.loadout,
      pts: ZERO_PTS(),
      tree: saveTree(save),
    });
    const drifted = SHEET_KEYS.filter((key) => Math.abs(hero.sheet[key] - composed[key]) > SELF_CONSISTENCY_TOL);
    expect(drifted.length, 'Weird exists to fail inversion; a clean Weird makes the NaN-safety and non-finite-luck-coercion checks vacuous').toBeGreaterThan(0);
  });
});
