/**
 * The SHAPE discriminator for crit chance and cooldown reduction: are they flat addends, or
 * percentages of the hero's birth roll?
 *
 * This file exists because the numbers alone did not settle it. The 2026-08-15 patch divided
 * every crit and cooldown value on the wiki by ~55x and ~190x, which reads as a straight rescale
 * — and a rescale is entirely compatible with the OLD multiplicative model. Re-syncing the
 * values while keeping the shape would have left the planner quietly wrong about two stats on
 * every hero, with no test going red.
 *
 * The reasonable objection this answers: *items now roll crit chance and cooldown, so surely
 * those rolls are still shares of the roll*. They are not — and the capture read here separates
 * the two hypotheses rather than merely fitting one.
 *
 * Two claims, in increasing strength:
 *
 * 1. **Reconstruction (fit).** Each hero's whole sheet-minus-birth move is `tree + gear + ability`
 *    with no base-roll factor anywhere, to floating-point zero.
 * 2. **Matched pairs (rejection).** This is the load-bearing half, and it is MODEL-FREE. Any
 *    percent-of-base model whatsoever has the form `Δ = birthRoll × f(gear, ability, tree)`. Two
 *    heroes with identical gear, identical ability rank and the same account tree therefore share
 *    an `f`, so such a model *forces* `Δa / Δb === birthA / birthB`. This capture carries two such
 *    pairs whose birth rolls are 74% and 55% apart and whose deltas are equal to every digit the
 *    export prints. No percent-of-base model of any coefficient can fit both members of either
 *    pair. That argument needs no guess at what the rejected coefficients would have been, which
 *    is exactly why it is the one worth pinning.
 *
 * Without claim 2 this file would pin the shipped model against itself and stay green under
 * precisely the regression it exists to catch.
 */
import { describe, expect, it } from 'vitest';
import { sumGearBonuses } from '@bombfarm/domain/gear';
import { extractHero, loadFixtureJson, treeTotalsFromSave } from './helpers/sheet-math-fixtures';

const FILE = 'save-20260816-5heroes-gear-cdr-crit.json';

/** `olho_clinico`, in planner percentage points per rank (`ABILITIES`, measured post-patch). */
const OLHO_PP_PER_RANK = 0.04574;

const data = loadFixtureJson(FILE);
// `treeTotalsFromSave` takes `skills.totals`, NOT the whole document — handing it the document
// returns the identity defaults (every term 0) and quietly deletes the tree from the comparison.
const skills = data.skills as Record<string, unknown>;
const tree = treeTotalsFromSave(skills.totals as Record<string, unknown>);
const HERO_NAMES = ['Bellatrix', 'Jon', 'Minato', 'Doran', 'Bram'] as const;

function termsFor(name: string) {
  const hero = extractHero(data, name);
  if (!hero.birth) throw new Error(`${name} has no birth_stats`);
  const bonuses = sumGearBonuses(hero.loadout);
  const rank = hero.abilities.olho_clinico ?? 0;
  return {
    stars: hero.stars,
    birthCrit: hero.birth.critChance,
    birthCdr: hero.birth.cdr,
    // Every hero on this capture is ★0, so birth x starsMult(0) === birth and the star factor
    // drops out of both models alike — it cannot bias the comparison either way.
    deltaCrit: hero.sheet.critChance - hero.birth.critChance,
    deltaCdr: hero.sheet.cdr - hero.birth.cdr,
    gearCrit: bonuses.critFlatPct,
    gearCdr: bonuses.cdrFlatPct,
    abilityCrit: rank * OLHO_PP_PER_RANK,
  };
}

/** Symmetric spread: how far apart two rolls are, larger over smaller, minus one. */
function spread(a: number, b: number): number {
  return Math.max(a, b) / Math.min(a, b) - 1;
}

describe(`crit chance and CDR are FLAT addends, not shares of the roll (${FILE})`, () => {
  it('every hero on this capture is ★0, so the star factor cannot bias the comparison', () => {
    for (const name of HERO_NAMES) expect(termsFor(name).stars, name).toBe(0);
  });

  describe('claim 1 — reconstruction: tree + gear + ability, with no base-roll factor', () => {
    it.each(HERO_NAMES)('%s — crit chance', (name) => {
      const t = termsFor(name);
      const flat = tree.critChancePct + t.gearCrit + t.abilityCrit;
      expect(Math.abs(t.deltaCrit - flat), `${name} flat residual`).toBeLessThan(1e-12);
    });

    it.each(HERO_NAMES)('%s — CDR is exactly the sum of its item rolls', (name) => {
      const t = termsFor(name);
      // CDR has no ability and no tree node, so gear is its only non-birth source.
      expect(Math.abs(t.deltaCdr - t.gearCdr), `${name} flat residual`).toBeLessThan(1e-12);
    });
  });

  describe('claim 2 — matched pairs reject EVERY percent-of-base model, without naming one', () => {
    // Each pair: identical gear term, identical ability rank, same account tree — so any model
    // `Δ = birthRoll × f(...)` gives both members the same `f`, and forces the delta ratio to
    // equal the birth ratio. `minSpread` is how far the birth ratio is from 1; the observed delta
    // ratio is pinned at 1 to 12 decimals. The two cannot both hold.
    it.each([
      ['crit', 'Bellatrix', 'Jon', 0.7],
      ['crit', 'Minato', 'Doran', 0.5],
    ])('%s — %s vs %s', (_stat, a, b, minSpread) => {
      const x = termsFor(a);
      const y = termsFor(b);

      // Premise: every multiplicative input is identical across the pair.
      expect(x.gearCrit, 'gear term must match for the argument to bind').toBeCloseTo(y.gearCrit, 12);
      expect(x.abilityCrit, 'ability term must match').toBeCloseTo(y.abilityCrit, 12);

      // The rolls really are far apart...
      const birthSpread = spread(x.birthCrit, y.birthCrit);
      expect(birthSpread, `birth rolls ${x.birthCrit} vs ${y.birthCrit}`).toBeGreaterThan(
        Number(minSpread),
      );

      // ...yet the deltas are identical. Percent-of-base would require them to be `birthSpread`
      // apart; flat requires them to be equal. Observed: equal.
      expect(spread(x.deltaCrit, y.deltaCrit), 'observed delta spread').toBeLessThan(1e-12);
    });

    it('CDR — Jon vs Minato: same three cooldown rolls, rolls 95% apart, identical delta', () => {
      const x = termsFor('Jon');
      const y = termsFor('Minato');
      expect(x.gearCdr).toBeCloseTo(y.gearCdr, 12);
      expect(spread(x.birthCdr, y.birthCdr), 'birth CDR spread').toBeGreaterThan(0.9);
      expect(spread(x.deltaCdr, y.deltaCdr), 'observed delta spread').toBeLessThan(1e-12);
    });
  });

  it('non-vacuity: the capture really does carry crit AND cooldown item rolls, and one item-free hero', () => {
    const withCritGear = HERO_NAMES.filter((n) => termsFor(n).gearCrit > 0);
    const withCdrGear = HERO_NAMES.filter((n) => termsFor(n).gearCdr > 0);
    const itemFree = HERO_NAMES.filter((n) => {
      const t = termsFor(n);
      return t.gearCrit === 0 && t.gearCdr === 0;
    });
    expect(withCritGear.length, `heroes wearing crit rolls: ${withCritGear.join(', ')}`).toBeGreaterThanOrEqual(4);
    expect(withCdrGear.length, `heroes wearing cooldown rolls: ${withCdrGear.join(', ')}`).toBeGreaterThanOrEqual(4);
    expect(itemFree, 'the tree-only witness').toEqual(['Bram']);
    // And the tree term is genuinely nonzero, or claim 1 would be reconstructing from nothing.
    expect(tree.critChancePct).toBeGreaterThan(0);
  });

  it('Bram is the tree-only witness: no items, no crit ability, so his whole delta IS the tree term', () => {
    const t = termsFor('Bram');
    expect(t.gearCrit).toBe(0);
    expect(t.abilityCrit).toBe(0);
    expect(t.deltaCrit).toBeCloseTo(tree.critChancePct, 12);
    // And his CDR does not move at all — the only source he could have is gear, and he has none.
    expect(t.deltaCdr).toBe(0);
  });
});
