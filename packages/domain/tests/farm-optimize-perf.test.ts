/**
 * The performance guard — pipeline-call count and evaluation budget.
 *
 * `energySwitchPointCallCount` is module-global mutable state (`advisor-pipeline.ts:41`), so
 * this file owns every case that reads it, exactly like `farm-rate-perf-guard.test.ts` does for
 * the estimator. A parallel file calling the solver would corrupt the count. 1:1 to `FRAD-13`,
 * `FRAD-14`.
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

describe('FRAD-13 — pipeline calls equal the enabled-hero count, regardless of candidates evaluated', () => {
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

describe('FRAD-14 — the evaluation budget binds, and a truncated search still returns a valid incumbent', () => {
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
