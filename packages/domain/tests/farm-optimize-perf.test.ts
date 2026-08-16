/**
 * The performance guard — pipeline-call count and evaluation budget.
 *
 * `energySwitchPointCallCount` is module-global mutable state (`advisor-pipeline.ts:41`), so
 * this file owns every case that reads it, exactly like `farm-rate-perf-guard.test.ts` does for
 * the estimator. A parallel file calling the solver would corrupt the count.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { solveFarmRespec, FARM_OPT_FULL_MAX_EVALUATIONS } from '@bombfarm/domain/farm-optimize';
import { runFarmSearch } from '@bombfarm/domain/farm-optimize-search';
import { computeHeroFarmBases } from '@bombfarm/domain/farm-rate';
import { resolveFarmObjective } from '@bombfarm/domain/farm-optimize-objective';
import { reoptBudget } from '@bombfarm/domain/points-reopt-core';
import {
  energySwitchPointCallCount,
  resetEnergySwitchPointCallCount,
} from '@bombfarm/domain/advisor-pipeline';
import { loadFarmRateFixture } from './helpers/farm-rate-fixtures';

const { heroes, account, maxPhase } = loadFarmRateFixture();

beforeEach(() => {
  resetEnergySwitchPointCallCount();
});

describe('pipeline calls equal the enabled-hero count, regardless of candidates evaluated', () => {
  it('a full Tier 2 solve on the 5-hero fixture bumps the counter exactly 5 times', () => {
    solveFarmRespec({ heroes, account, maxPhase });
    expect(energySwitchPointCallCount).toBe(5);
  });

  it('a 2-hero pool bumps the counter exactly 2 times', () => {
    const twoIds = heroes.slice(0, 2).map((h) => h.id);
    solveFarmRespec({ heroes, account, maxPhase, enabledHeroIds: twoIds });
    expect(energySwitchPointCallCount).toBe(2);
  });

  it('a 1-hero pool bumps the counter exactly 1 time', () => {
    const oneId = heroes.slice(0, 1).map((h) => h.id);
    solveFarmRespec({ heroes, account, maxPhase, enabledHeroIds: oneId });
    expect(energySwitchPointCallCount).toBe(1);
  });
});

describe('the evaluation budget binds, and a truncated search still returns a valid incumbent', () => {
  it('evaluations <= FARM_OPT_FULL_MAX_EVALUATIONS on the fixture, and budgetExhausted is false', () => {
    const result = solveFarmRespec({ heroes, account, maxPhase });
    expect(result.evaluations).toBeLessThanOrEqual(FARM_OPT_FULL_MAX_EVALUATIONS);
    expect(result.budgetExhausted).toBe(false);
    // Record the actual count (not asserted as a literal — design.md §0.1).
    expect(result.evaluations).toBeGreaterThan(0);
  });

  it('a lowered internal budget sets budgetExhausted: true, never overruns it, and still returns a valid incumbent', () => {
    const bases = computeHeroFarmBases({ heroes, account });
    const budgetById = new Map(bases.map((b) => [b.heroId, reoptBudget(b.pts, b.level)] as const));
    const searchableIds = bases.map((b) => b.heroId);
    const objective = resolveFarmObjective({ kind: 'gold' });
    const scales = { goldScale: 1, chestScale: 1 };
    const tinyBudget = 3;

    const search = runFarmSearch(bases, searchableIds, budgetById, account, objective, scales, { maxPhase }, tinyBudget);

    expect(search.budgetExhausted).toBe(true);
    expect(search.evaluations).toBeLessThanOrEqual(tinyBudget);
    // The incumbent is always a valid, evaluated assignment — not a crash, not a partial object.
    expect(search.winner).toBeDefined();
    expect(search.winner.assignment).toBeInstanceOf(Map);
    expect(Number.isNaN(search.winner.value)).toBe(false);
  });
});

// ---------------------------------------------------------------------------------------------
// Wall time.
// ---------------------------------------------------------------------------------------------
/**
 * The evaluation-count budget above is structurally incapable of catching a regression that
 * leaves the COUNT unchanged and makes each evaluation more expensive — which is exactly the
 * shape the hop-distribution change had: same candidate count, costlier per-candidate cadence
 * math. Cost per evaluation needs its own assertion, and only wall time measures it.
 *
 * This is not academic. The web planner's respec solve races a 700ms debounced autosave; a solve
 * that grows past that window starts losing the race on loaded CI runners, and the losing side is
 * silent (the proposal is judged stale and the board reverts with no error).
 *
 * MEASURED BASELINE (developer machine, Windows, Node 24, 8 consecutive solves on the committed
 * 5-hero fixture): 220-241 ms, median ~224 ms. Best-of-3 is asserted rather than a single sample,
 * so one GC pause or scheduler hiccup cannot fail the suite.
 *
 * The ceiling is FARM_SOLVE_MAX_MS below — roughly 10x the local baseline, and still ~4x the
 * headroom left on a CI runner three times slower than this machine. That is deliberate: this
 * guard exists to catch a 5-10x regression, not to police a 20% one. A 5x regression trips it
 * even on a 3x-slow runner (5 x 670 ms > the ceiling); anything tighter would flake.
 */
const FARM_SOLVE_MAX_MS = 2_500;
const FARM_SOLVE_SAMPLES = 3;

describe('a full Tier 2 solve stays inside its wall-time ceiling', () => {
  it(`the fastest of ${FARM_SOLVE_SAMPLES} full solves on the fixture is under ${FARM_SOLVE_MAX_MS}ms`, () => {
    let fastestMs = Number.POSITIVE_INFINITY;
    for (let sample = 0; sample < FARM_SOLVE_SAMPLES; sample++) {
      const startedAt = performance.now();
      const result = solveFarmRespec({ heroes, account, maxPhase });
      fastestMs = Math.min(fastestMs, performance.now() - startedAt);
      // The solve must have actually run — a degenerate no-op would pass any time bound.
      expect(result.evaluations).toBeGreaterThan(0);
      expect(result.budgetExhausted).toBe(false);
    }
    expect(
      fastestMs,
      `full solve took ${fastestMs.toFixed(0)}ms (baseline ~224ms, ceiling ${FARM_SOLVE_MAX_MS}ms)`,
    ).toBeLessThan(FARM_SOLVE_MAX_MS);
  });
});
