/**
 * The farm search must PLACE a hero's unspent points, not merely reshuffle the spent ones.
 *
 * This is the floor under the ceiling `farm-optimize-budget-ceiling.test.ts` asserts. That file
 * proves no proposal spends MORE than `reoptBudget`; nothing proved a proposal spends the budget
 * at all — and it did not:
 *
 * - every move in `generateMoves()` is a transfer, so a vector's total never changes;
 * - five of the six seeds ARE built from the budget, but each is a squad-wide assignment at one
 *   energy share, so it wins or loses for the whole searchable set at once;
 * - the sixth, `'current'`, carries each hero's own total.
 *
 * So the only thing that could ever place a banked point was a squad-wide re-split good enough
 * to beat the incumbent on every OTHER hero's account too. A big enough pool tips that vote and
 * gets placed by luck; a small one never does. On a roster settled at its own optimum — which is
 * every roster the player has already acted on — nothing was placed at all, and the proposal
 * never said the banked points existed.
 *
 * THE SETTLED ROSTER IS THE WHOLE POINT of the construction below, and a fresh fixture roster is
 * not a substitute: run these same cases straight off the capture and banks of 8 and 20 both come
 * back placed, because the fixture's own splits are loose enough that a re-split wins anyway. It
 * is the second solve, on a roster the first one already tuned, that isolates the neighbourhood.
 */
import { describe, expect, it } from 'vitest';
import { solveFarmRespec, type FarmRespecResult } from '@bombfarm/domain/farm-optimize';
import { budgetOf, reoptBudget } from '@bombfarm/domain/points-reopt-core';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import { loadFarmRateFixture } from './helpers/farm-rate-fixtures';
import { holdSuiteUntilInRegime } from './helpers/capture-regime';

/** In regime for `sheet`, thirteen heroes at max_phase 61 — thick enough that one hero's banked
 *  pool cannot carry a squad-wide re-split on its own, which is the situation under test. */
const FIXTURE = 'save-20260831-13heroes-soulbound.json';

holdSuiteUntilInRegime(`sheet-math/${FIXTURE}`, 'sheet');

const { heroes, account, maxPhase } = loadFarmRateFixture(FIXTURE);

function entryFor(result: FarmRespecResult, heroName: string) {
  const entry = result.heroes.find((hero) => hero.heroName === heroName);
  if (!entry) throw new Error(`${heroName} is absent from the result`);
  return entry;
}

/** The roster after taking the optimizer's own advice — every hero on the vector the solver
 *  proposed for it, so a second solve starts where the first one stopped. */
function settledRoster(): HeroRecord[] {
  const first = solveFarmRespec({ heroes, account, maxPhase });
  return heroes.map((hero) => {
    const proposal = first.heroes.find((entry) => entry.heroName === hero.name);
    return proposal ? { ...hero, pts: { ...proposal.proposedPts } } : hero;
  });
}

const SETTLED = settledRoster();

/** Highest level in the roster, so even the largest bank below leaves it points it has spent. */
const TARGET = [...SETTLED].sort((left, right) => right.level - left.level)[0];

/**
 * `SETTLED` with `banked` of the target's attack points taken back off and left unplaced — the
 * hero levelled up and nobody has spent it yet. Unlike the ceiling suite's over-spend this state
 * is entirely ordinary: the game grants a point per level and obliges nobody to place it.
 */
function rosterBanking(banked: number): HeroRecord[] {
  if (TARGET.pts.attack < banked) throw new Error(`${TARGET.name} has only ${TARGET.pts.attack} attack points to bank`);
  return SETTLED.map((hero) =>
    hero.name === TARGET.name ? { ...hero, pts: { ...hero.pts, attack: hero.pts.attack - banked } } : hero,
  );
}

describe('the settled roster this runs on banks nothing, so the pool is the one under test', () => {
  it('every settled hero spends its whole budget', () => {
    for (const hero of SETTLED) {
      expect(budgetOf(hero.pts), `${hero.name} banks points before this file takes any away`).toBe(
        reoptBudget(hero.pts, hero.level),
      );
    }
  });
});

describe('an unspent pool is placed, not left banked', () => {
  // 1 to 12 were dropped in full before the per-hero neighbourhood could place points; 20 was
  // large enough to tip a squad-wide re-split and got placed by luck. Both bands stay covered.
  for (const banked of [1, 2, 4, 8, 12, 20]) {
    it(`a hero banking ${banked} point(s) is offered all of them`, () => {
      const roster = rosterBanking(banked);
      const target = roster.find((hero) => hero.name === TARGET.name)!;
      const budget = reoptBudget(target.pts, target.level);
      expect(budgetOf(target.pts)).toBe(budget - banked);

      const entry = entryFor(solveFarmRespec({ heroes: roster, account, maxPhase }), TARGET.name);
      expect(
        budgetOf(entry.proposedPts),
        `${entry.heroName} was offered ${budgetOf(entry.proposedPts)} of a ${budget}-point budget`,
      ).toBe(budget);
    });
  }

  it('the ceiling still holds — placing a pool never overshoots the level', () => {
    const result = solveFarmRespec({ heroes: rosterBanking(12), account, maxPhase });
    for (const entry of result.heroes) {
      expect(
        budgetOf(entry.proposedPts),
        `${entry.heroName} proposed ${budgetOf(entry.proposedPts)} against level ${entry.level}`,
      ).toBeLessThanOrEqual(reoptBudget(entry.currentPts, entry.level));
    }
  });

  it('no hero is asked to hand back points it had already placed', () => {
    const result = solveFarmRespec({ heroes: rosterBanking(12), account, maxPhase });
    for (const entry of result.heroes) {
      expect(
        budgetOf(entry.proposedPts),
        `${entry.heroName} proposed ${budgetOf(entry.proposedPts)} having spent ${budgetOf(entry.currentPts)}`,
      ).toBeGreaterThanOrEqual(budgetOf(entry.currentPts));
    }
  });
});
