import { describe, expect, it } from 'vitest';
import { FARM_OPT_FULL_MAX_EVALUATIONS, FARM_OPT_JOINT_BUDGET_SHARE } from '@bombfarm/domain/farm-optimize';
import { evaluateAssignment, runFarmSearch, runPlayerFarmSearch } from '@bombfarm/domain/farm-optimize-search';
import { resolveFarmObjective } from '@bombfarm/domain/farm-optimize-objective';
import { computeHeroFarmBases } from '@bombfarm/domain/farm-rate';
import { RESPEC_KEYS, reoptBudget } from '@bombfarm/domain/points-reopt-core';
import { POINTS_TRIM_MAX_LOSS_PCT } from '@bombfarm/domain/points-trim';
import { loadFarmRateFixture } from './helpers/farm-rate-fixtures';

const { heroes, account, maxPhase } = loadFarmRateFixture();
const bases = computeHeroFarmBases({ heroes, account });
const budgetById = new Map(bases.map((b) => [b.heroId, reoptBudget(b.level)] as const));
const objective = resolveFarmObjective({ kind: 'gold' });
const scales = { goldScale: 1, chestScale: 1 };
const args = [
  bases,
  bases.map((b) => b.heroId),
  budgetById,
  account,
  objective,
  scales,
  { maxPhase },
  Math.floor(FARM_OPT_FULL_MAX_EVALUATIONS * FARM_OPT_JOINT_BUDGET_SHARE),
] as const;

function pointsMoved(assignment: ReadonlyMap<string, Record<string, number>>): number {
  let moved = 0;
  for (const basis of bases) {
    const pts = assignment.get(basis.heroId) ?? basis.pts;
    for (const key of RESPEC_KEYS) moved += Math.abs(pts[key] - basis.pts[key]);
  }
  return moved;
}

describe('runPlayerFarmSearch', () => {
  const searched = runFarmSearch(...args);
  const shown = runPlayerFarmSearch(...args);
  const currentValue = evaluateAssignment(bases, null, account, objective, scales, { maxPhase }).value;

  it('the search proposes a change on this roster, so the comparisons below are not vacuous', () => {
    expect(searched.winningSeedName).not.toBe('current');
  });

  it('gives up at most POINTS_TRIM_MAX_LOSS_PCT of what the search found', () => {
    expect(shown.winner.value).toBeGreaterThanOrEqual(searched.winner.value * (1 - POINTS_TRIM_MAX_LOSS_PCT / 100));
  });

  it('never proposes less than the current builds farm', () => {
    expect(shown.winner.value).toBeGreaterThanOrEqual(currentValue);
  });

  it('asks for no more points moved than the search did', () => {
    expect(pointsMoved(shown.winner.assignment)).toBeLessThanOrEqual(pointsMoved(searched.winner.assignment));
  });

  it('reports the value of the assignment it hands back', () => {
    const repriced = evaluateAssignment(bases, shown.winner.assignment, account, objective, scales, { maxPhase });
    expect(shown.winner.value).toBe(repriced.value);
  });
});
