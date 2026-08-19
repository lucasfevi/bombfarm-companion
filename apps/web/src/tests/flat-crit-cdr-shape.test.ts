/**
 * The SHAPE discriminator for crit chance and cooldown reduction: are they percentages of the
 * hero's birth roll, or flat addends?
 *
 * This file used to pin the OPPOSITE answer — crit chance and cooldown were flat addends from
 * the 2026-08-15 patch (commit 0418a82 / PR #102) until the 2026-08-18 patch put both back to
 * percent-of-base, three days later. That patch also rescaled the item catalog's `crit` /
 * `cooldown` bases by the same factor `olho_clinico` moved by (see `rarity-constants.ts`'s
 * `POINT_GAIN` comment and `gear/catalog.ts`'s `sumGearBonuses` comment), so a rescale-only
 * reading is exactly as plausible here as it was for the original flat-shape question — this
 * file exists so the shape claim rests on something the numbers alone cannot forge.
 *
 * Two claims, in increasing strength — inverted from the flat-shape version this replaces:
 *
 * 1. **Reconstruction (fit).** Each hero's sheet value is `birth × (1 + gear + ability + tree)`
 *    — a percentage of the roll — to floating-point precision.
 * 2. **Model-free rejection of FLAT.** A flat model has the form `Δ = f(gear, ability, tree)`
 *    with NO base-roll factor, so two heroes sharing identical gear/ability/tree inputs would
 *    have to show the SAME delta regardless of how far apart their birth rolls are. This capture
 *    carries two such groups — four crit-chance witnesses with no gear and no ability (so their
 *    only shared input is the tree term) and a CDR pair with byte-identical gear — and in both
 *    groups the deltas are NOT equal; they scale with birth instead. No flat model of any
 *    coefficient can fit either group. That argument needs no guess at what a flat coefficient
 *    would have been, which is why it is the one worth pinning.
 *
 * Without claim 2 this file would pin the shipped model against itself and stay green under
 * precisely the regression it exists to catch.
 */
import { describe, expect, it } from 'vitest';
import { sumGearBonuses } from '@bombfarm/domain/gear';
import { inferSpentPoints } from '@bombfarm/domain/point-inference';
import { SHEET_KEYS } from '@bombfarm/domain/planner-constants';
import { extractHero, loadFixtureJson, treeTotalsFromSave } from '@/tests/helpers/sheet-math-fixtures';

const FILE = 'save-20260818-12heroes.json';
const RESPEC_FILE = 'save-20260819-respec-crit-cdr.json';

/** `olho_clinico`, in percent-of-base per rank (`ABILITIES`, measured post-revert). */
const OLHO_PCT_PER_RANK = 4.285714285714286;

const data = loadFixtureJson(FILE);
// `treeTotalsFromSave` takes `skills.totals`, NOT the whole document — handing it the document
// returns the identity defaults (every term 0) and quietly deletes the tree from the comparison.
const skills = data.skills as Record<string, unknown>;
const tree = treeTotalsFromSave(skills.totals as Record<string, unknown>);
const HERO_NAMES = ['Minato', 'Jon', 'Manco #1', 'Doran', 'Bellatrix', 'Sora', 'Joric', 'Aric', 'Eryn'] as const;
/** No items, no crit ability — the tree term is their only non-birth crit-chance source. */
const TREE_ONLY_WITNESSES = ['Sora', 'Joric', 'Aric', 'Eryn'] as const;

function termsFor(name: string) {
  const hero = extractHero(data, name);
  if (!hero.birth) throw new Error(`${name} has no birth_stats`);
  const bonuses = sumGearBonuses(hero.loadout);
  const rank = hero.abilities.olho_clinico ?? 0;
  return {
    stars: hero.stars,
    birthCrit: hero.birth.critChance,
    birthCdr: hero.birth.cdr,
    sheetCrit: hero.sheet.critChance,
    sheetCdr: hero.sheet.cdr,
    // Every hero on this capture is ★0, so birth × starsMult(0) === birth and the star factor
    // drops out of both models alike — it cannot bias the comparison either way.
    deltaCrit: hero.sheet.critChance - hero.birth.critChance,
    deltaCdr: hero.sheet.cdr - hero.birth.cdr,
    gearCrit: bonuses.critPct,
    gearCdr: bonuses.cdrPct,
    abilityCrit: (rank * OLHO_PCT_PER_RANK) / 100,
  };
}

/** Symmetric spread: how far apart two rolls are, larger over smaller, minus one. */
function spread(a: number, b: number): number {
  return Math.max(a, b) / Math.min(a, b) - 1;
}

describe(`crit chance and CDR are percentages of the base roll (${FILE})`, () => {
  it('every hero on this capture is ★0, so the star factor cannot bias the comparison', () => {
    for (const name of HERO_NAMES) expect(termsFor(name).stars, name).toBe(0);
  });

  describe('claim 1 — reconstruction: birth × (1 + gear + ability + tree)', () => {
    it.each(HERO_NAMES)('%s — crit chance', (name) => {
      const t = termsFor(name);
      const predicted = t.birthCrit * (1 + t.gearCrit + t.abilityCrit + tree.critChancePct / 100);
      expect(Math.abs(t.sheetCrit - predicted), `${name} percent-of-base residual`).toBeLessThan(1e-8);
    });

    it.each(HERO_NAMES)('%s — CDR (no ability, no tree node — gear only)', (name) => {
      const t = termsFor(name);
      const predicted = t.birthCdr * (1 + t.gearCdr);
      expect(Math.abs(t.sheetCdr - predicted), `${name} percent-of-base residual`).toBeLessThan(1e-8);
    });
  });

  describe('claim 2 — matched groups reject EVERY flat model, without naming one', () => {
    it('crit — four tree-only witnesses share gear=0, ability=0, yet their deltas are NOT equal', () => {
      const terms = TREE_ONLY_WITNESSES.map((name) => ({ name, ...termsFor(name) }));
      for (const t of terms) {
        expect(t.gearCrit, `${t.name} must carry no crit gear for the argument to bind`).toBe(0);
        expect(t.abilityCrit, `${t.name} must carry no crit ability`).toBe(0);
      }
      // The birth rolls really are far apart...
      const rolls = terms.map((t) => t.birthCrit);
      expect(Math.max(...rolls) / Math.min(...rolls) - 1, 'birth roll spread').toBeGreaterThan(2.8);
      // ...and so are the deltas — a flat model (Δ = f(tree) alone, no birth factor) would force
      // them to be EQUAL, since every other input is identical. They are not: the delta spread
      // tracks the birth spread instead.
      const deltas = terms.map((t) => t.deltaCrit);
      expect(Math.max(...deltas) / Math.min(...deltas) - 1, 'delta spread').toBeGreaterThan(2.8);
      // Positive result: each delta/birth ratio lands on the SAME tree fraction, which is what a
      // percentage of the roll predicts and a flat addend cannot produce for four different rolls.
      for (const t of terms) {
        expect(t.deltaCrit / t.birthCrit, `${t.name} delta/birth ratio`).toBeCloseTo(tree.critChancePct / 100, 9);
      }
    });

    it('CDR — Jon vs Doran: byte-identical gear roll, birth rolls 133% apart, deltas are NOT equal', () => {
      const jon = termsFor('Jon');
      const doran = termsFor('Doran');
      expect(jon.gearCdr, 'gear term must match for the argument to bind').toBeCloseTo(doran.gearCdr, 12);
      expect(spread(jon.birthCdr, doran.birthCdr), 'birth CDR spread').toBeGreaterThan(1.3);
      // A flat model (Δ = f(gear) alone — CDR has no ability and no tree node) would force the
      // two deltas to be equal, since the only input either model can see is identical. Observed:
      // the delta spread tracks the birth spread instead.
      expect(spread(jon.deltaCdr, doran.deltaCdr), 'observed delta spread').toBeGreaterThan(1.3);
      expect(jon.deltaCdr / jon.birthCdr).toBeCloseTo(jon.gearCdr, 9);
      expect(doran.deltaCdr / doran.birthCdr).toBeCloseTo(doran.gearCdr, 9);
    });
  });

  it('non-vacuity: the capture really does carry crit AND cooldown item rolls, and tree-only witnesses', () => {
    const withCritGear = HERO_NAMES.filter((n) => termsFor(n).gearCrit > 0);
    const withCdrGear = HERO_NAMES.filter((n) => termsFor(n).gearCdr > 0);
    const itemFree = HERO_NAMES.filter((n) => {
      const t = termsFor(n);
      return t.gearCrit === 0 && t.gearCdr === 0;
    });
    expect(withCritGear.length, `heroes wearing crit rolls: ${withCritGear.join(', ')}`).toBeGreaterThanOrEqual(4);
    expect(withCdrGear.length, `heroes wearing cooldown rolls: ${withCdrGear.join(', ')}`).toBeGreaterThanOrEqual(4);
    expect(itemFree.sort(), 'the tree-only witnesses').toEqual([...TREE_ONLY_WITNESSES].sort());
    // And the tree term is genuinely nonzero, or claim 1 would be reconstructing from nothing.
    expect(tree.critChancePct).toBeGreaterThan(0);
  });

  it('the three olho_clinico rank-20 witnesses each leave a residual of exactly 6/7 after tree + gear', () => {
    // `olho_clinico`'s ability term alone, isolated by subtracting the measured tree fraction and
    // gear fraction from the observed multiplier — exactly `20 × 0.04285714285714286 = 6/7`, the
    // measurement `abilities.ts` records for this ability's rank-20 value.
    for (const name of ['Minato', 'Jon', 'Manco #1'] as const) {
      const t = termsFor(name);
      const multiplier = t.sheetCrit / t.birthCrit;
      const residual = multiplier - 1 - t.gearCrit - tree.critChancePct / 100;
      expect(residual, `${name} olho_clinico residual`).toBeCloseTo(20 * (OLHO_PCT_PER_RANK / 100), 6);
      expect(residual, `${name} olho_clinico residual (6/7)`).toBeCloseTo(6 / 7, 6);
    }
  });

  it(`the point-rate witness (${RESPEC_FILE}) — Sora's 10-point respec solves to exactly 5 crit chance + 5 cooldown, both at 0.02/point`, () => {
    // Sora owns no items and no crit/cooldown ability on either capture, so her whole sheet move
    // between the two exports is the stat-point term alone. Every other stat must solve to
    // exactly zero for the "10 points are all crit chance + cooldown" premise to hold.
    const before = loadFixtureJson(FILE);
    const after = loadFixtureJson(RESPEC_FILE);
    const beforeTree = treeTotalsFromSave((before.skills as Record<string, unknown>).totals as Record<string, unknown>);
    const afterTree = treeTotalsFromSave((after.skills as Record<string, unknown>).totals as Record<string, unknown>);

    const soraBefore = extractHero(before, 'Sora');
    const soraAfter = extractHero(after, 'Sora');
    if (!soraBefore.birth || !soraAfter.birth) throw new Error('Sora has no birth_stats on one of the captures');

    const inferredBefore = inferSpentPoints({
      birth: soraBefore.birth,
      level: soraBefore.level,
      stars: soraBefore.stars,
      sheetOther: soraBefore.sheetOther,
      loadout: soraBefore.loadout,
      tree: beforeTree,
      sheet: soraBefore.sheet,
      statPointsAvailable: soraBefore.statPointsAvailable,
    });
    const inferredAfter = inferSpentPoints({
      birth: soraAfter.birth,
      level: soraAfter.level,
      stars: soraAfter.stars,
      sheetOther: soraAfter.sheetOther,
      loadout: soraAfter.loadout,
      tree: afterTree,
      sheet: soraAfter.sheet,
      statPointsAvailable: soraAfter.statPointsAvailable,
    });
    expect(inferredBefore.issues).toEqual([]);
    expect(inferredAfter.issues).toEqual([]);

    // All 10 points in attack, before the respec.
    expect(inferredBefore.pts.attack).toBe(10);
    for (const key of SHEET_KEYS) {
      if (key === 'attack') continue;
      expect(inferredBefore.pts[key], `before: ${key}`).toBe(0);
    }

    // Exactly 5 + 5 after, every other key back to zero.
    expect(inferredAfter.pts.critChance).toBe(5);
    expect(inferredAfter.pts.cdr).toBe(5);
    for (const key of SHEET_KEYS) {
      if (key === 'critChance' || key === 'cdr') continue;
      expect(inferredAfter.pts[key], `after: ${key}`).toBe(0);
    }

    // The rate each point bought, read straight off the multiplier move: +0.1 on each stat for
    // 5 points is 0.02/point, with no base-roll factor and no level scaling.
    const critMultiplierBefore = soraBefore.sheet.critChance / soraBefore.birth.critChance;
    const critMultiplierAfter = soraAfter.sheet.critChance / soraAfter.birth.critChance;
    const cdrMultiplierBefore = soraBefore.sheet.cdr / soraBefore.birth.cdr;
    const cdrMultiplierAfter = soraAfter.sheet.cdr / soraAfter.birth.cdr;
    expect(critMultiplierAfter - critMultiplierBefore).toBeCloseTo(0.1, 9);
    expect(cdrMultiplierAfter - cdrMultiplierBefore).toBeCloseTo(0.1, 9);
  });
});
