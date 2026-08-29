/**
 * The Respec Advisor may never propose a build the game will not sell.
 *
 * `farm-optimize-core.test.ts` already asserts `budgetOf(proposedPts) <= reoptBudget(...)` across
 * the committed fixture — but it held by ACCIDENT, not by enforcement, and passed for months
 * while the code had no such guarantee:
 *
 * - five of the six seeds build `attack + energy` FROM the budget, so they satisfy it by
 *   construction;
 * - the sixth, `'current'`, seeded straight from `basis.pts` with no clamp;
 * - and every one of the 260 local-search moves is a TRANSFER, so the total never changes again.
 *
 * An over-spent hero therefore carried its excess through the whole search and out into the
 * recommendation — but only if a `'current'`-derived candidate won, and on the committed corpus a
 * budget-built seed happened to win instead. Changing the objective (the FIFO field queue) moved
 * the winner and the violation appeared with no change to the budget code at all.
 *
 * So this file constructs the over-spent hero ITSELF rather than relying on a capture to contain
 * one. That is the whole point: the corpus is being cleaned up, the fixture that happened to
 * expose this is going away, and the invariant has to outlive both.
 */
import { describe, expect, it } from 'vitest';
import { solveFarmRespec, gateFarmRespec } from '@bombfarm/domain/farm-optimize';
import { computeHeroFarmBases } from '@bombfarm/domain/farm-rate';
import { runFarmSearch } from '@bombfarm/domain/farm-optimize-search';
import { resolveFarmObjective } from '@bombfarm/domain/farm-optimize-objective';
import { budgetOf, reoptBudget, clampPtsToBudget, REOPT_KEYS } from '@bombfarm/domain/points-reopt-core';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import { loadFarmRateFixture } from './helpers/farm-rate-fixtures';
import { holdSuiteUntilInRegime } from './helpers/capture-regime';

/** A capture with no over-spent hero, so the anomaly below is the one this file introduces. */
const CLEAN_FIXTURE = 'save-20260823-13heroes-crit-points.json';

holdSuiteUntilInRegime(`sheet-math/${CLEAN_FIXTURE}`, 'sheet');

const { heroes, account, maxPhase } = loadFarmRateFixture(CLEAN_FIXTURE);

/** `hero` with `extra` points piled onto attack — a state the game cannot produce (one point per
 *  level, and a level never goes down), reachable only through malformed input. */
function overSpend(hero: HeroRecord, extra: number): HeroRecord {
  return { ...hero, pts: { ...hero.pts, attack: hero.pts.attack + extra } };
}

describe('the corpus this runs on is clean, so the anomaly is the one under test', () => {
  it('no fixture hero starts over-spent', () => {
    for (const hero of heroes) {
      expect(budgetOf(hero.pts), `${hero.name} spends more than level ${hero.level}`).toBeLessThanOrEqual(hero.level);
    }
  });
});

describe('no proposal exceeds the hero own reoptBudget, even from an over-spent start', () => {
  function expectWithinBudget(result: { heroes: readonly { heroName: string; currentPts: Record<string, number>; proposedPts: Record<string, number>; level: number }[] }): void {
    for (const hero of result.heroes) {
      const budget = reoptBudget(hero.currentPts as never, hero.level);
      expect(
        budgetOf(hero.proposedPts as never),
        `${hero.heroName} proposed ${budgetOf(hero.proposedPts as never)} against a budget of ${budget}`,
      ).toBeLessThanOrEqual(budget);
    }
  }

  // ONE full solve — 8,000 evaluations, ~5s. The gate cases below are 64 each and carry the
  // parameter sweep, so the file stays under a second beyond this.
  it('the full solve, with every hero over-spent at once', () => {
    const roster = heroes.map((hero) => overSpend(hero, 5));
    expect(budgetOf(roster[0].pts)).toBeGreaterThan(reoptBudget(roster[0].pts, roster[0].level));
    expectWithinBudget(solveFarmRespec({ heroes: roster, account, maxPhase }));
  });

  /**
   * THE DISCRIMINATING CASE, and the reason the rest of this file is not enough on its own.
   *
   * Whether an over-spent build reaches the output depends on whether a `'current'`-derived
   * candidate WINS, and on a healthy roster it usually does not — a budget-built seed out-scores
   * it and the violation stays hidden. That is precisely how this shipped: the invariant was
   * asserted, and passed, for months.
   *
   * An evaluation budget of 1 removes the luck. `'current'` is the first of the six seeds, so one
   * evaluation buys exactly that seed and nothing else; it wins by being the only candidate, and
   * the search returns it unimproved. Whatever the seed carries is what comes out.
   */
  it('the current-build seed itself is clamped — forced to win with an evaluation budget of 1', () => {
    const roster = heroes.map((hero, index) => (index === 0 ? overSpend(hero, 12) : hero));
    const bases = computeHeroFarmBases({ heroes: roster, account });
    const budgetById = new Map(bases.map((b) => [b.heroId, reoptBudget(b.pts, b.level)] as const));
    const overSpentId = bases[0].heroId;
    expect(budgetOf(bases[0].pts)).toBeGreaterThan(budgetById.get(overSpentId)!);

    const search = runFarmSearch(
      bases,
      bases.map((b) => b.heroId),
      budgetById,
      account,
      resolveFarmObjective({ kind: 'gold' }),
      { goldScale: 1, chestScale: 1 },
      { maxPhase },
      1,
    );

    for (const basis of bases) {
      const pts = search.winner.assignment.get(basis.heroId) ?? basis.pts;
      expect(
        budgetOf(pts),
        `${basis.heroName} seeded at ${budgetOf(pts)} against a budget of ${budgetById.get(basis.heroId)}`,
      ).toBeLessThanOrEqual(budgetById.get(basis.heroId)!);
    }
  });

  for (const extra of [1, 6, 40]) {
    it(`the gate, one hero over-spent by ${extra} points`, () => {
      const roster = heroes.map((hero, index) => (index === 0 ? overSpend(hero, extra) : hero));
      expect(budgetOf(roster[0].pts)).toBeGreaterThan(reoptBudget(roster[0].pts, roster[0].level));
      expectWithinBudget(gateFarmRespec({ heroes: roster, account, maxPhase }));
    });
  }
});

describe('clampPtsToBudget', () => {
  const pts = { attack: 10, energy: 8, speed: 3, critChance: 2, critDmg: 1, penetration: 4, cdr: 6, luck: 7 };

  it('is identity when the spend already fits', () => {
    expect(clampPtsToBudget(pts, budgetOf(pts))).toBe(pts);
    expect(clampPtsToBudget(pts, budgetOf(pts) + 100)).toBe(pts);
  });

  it('sheds exactly the excess and never goes negative', () => {
    for (const budget of [0, 1, 5, 20, 33]) {
      const out = clampPtsToBudget(pts, budget);
      expect(budgetOf(out)).toBe(Math.min(budgetOf(pts), budget));
      for (const key of REOPT_KEYS) expect(out[key]).toBeGreaterThanOrEqual(0);
    }
  });

  it('leaves Luck alone — it is outside the reallocatable budget', () => {
    expect(clampPtsToBudget(pts, 0).luck).toBe(pts.luck);
  });

  it('is deterministic', () => {
    expect(clampPtsToBudget(pts, 12)).toEqual(clampPtsToBudget(pts, 12));
  });
});
