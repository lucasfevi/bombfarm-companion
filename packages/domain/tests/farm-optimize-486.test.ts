/**
 * The account-486 characterization and discrimination suite — proof the optimizer does real
 * work, not a hardcoded "dump everything into one stat" that would coincidentally pass every
 * other test. Every literal here is a MEASUREMENT against the committed fixture
 * (`sheet-math/save-20260813-5heroes.json`), re-derived from `design.md` §2.3, never a literal
 * carried over from the PRD's uncommitted capture (design.md §0.1 — those numbers do not
 * reproduce on this corpus and are deliberately absent from this file).
 *
 * Covers: the solver beating both naive builds, the recommended-phase band, and the chest
 * objective reporting a higher chest rate at a different phase than the gold objective.
 */
import { describe, expect, it } from 'vitest';
import { solveFarmRespec } from '@bombfarm/domain/farm-optimize';
import { resolveFarmObjective, bestFarmPhase, type FarmObjectiveScales } from '@bombfarm/domain/farm-optimize-objective';
import { computeHeroFarmBases, heroFactsFromBasis, squadFactsFromBases, type HeroFarmBasis } from '@bombfarm/domain/farm-rate';
import { reoptBudget, REOPT_KEYS } from '@bombfarm/domain/points-reopt-core';
import type { SheetKey } from '@bombfarm/domain/planner-constants';
import { loadFarmRateFixture } from './helpers/farm-rate-fixtures';

const { heroes, account, maxPhase } = loadFarmRateFixture();
const dummyScales: FarmObjectiveScales = { goldScale: 1, chestScale: 1 };
const goldObjective = resolveFarmObjective({ kind: 'gold' });

/**
 * The two naive comparison builds, built LOCALLY (never through the solver): every searchable
 * hero (non-degenerate, positive `reoptBudget`) dumps its whole budget into one stat; every
 * other reallocatable key is 0; luck is untouched. Non-searchable heroes keep their current
 * vector, exactly as the solver itself would pin them.
 */
function buildNaiveAssignment(
  bases: readonly HeroFarmBasis[],
  budgetById: ReadonlyMap<string, number>,
  factsById: ReadonlyMap<string, ReturnType<typeof heroFactsFromBasis>>,
  key: 'attack' | 'energy',
): Map<string, Record<SheetKey, number>> {
  const assignment = new Map<string, Record<SheetKey, number>>();
  for (const basis of bases) {
    const facts = factsById.get(basis.heroId)!;
    const budget = budgetById.get(basis.heroId) ?? 0;
    if (facts.degenerate || budget <= 0) continue;
    const vector: Record<SheetKey, number> = { ...basis.pts };
    for (const reoptKey of REOPT_KEYS) vector[reoptKey] = 0;
    vector[key] = budget;
    assignment.set(basis.heroId, vector);
  }
  return assignment;
}

function bestOverPhases(bases: readonly HeroFarmBasis[], assignment: Map<string, Record<SheetKey, number>> | null): number {
  const squad = squadFactsFromBases(bases, assignment, account);
  const pick = bestFarmPhase(squad, goldObjective, dummyScales, { maxPhase });
  return pick ? pick.value : 0;
}

const bases = computeHeroFarmBases({ heroes, account });
const budgetById = new Map(bases.map((b) => [b.heroId, reoptBudget(b.pts, b.level)] as const));
const factsById = new Map(bases.map((b) => [b.heroId, heroFactsFromBasis(b, b.pts)] as const));

const allAttackBest = bestOverPhases(bases, buildNaiveAssignment(bases, budgetById, factsById, 'attack'));
const allEnergyBest = bestOverPhases(bases, buildNaiveAssignment(bases, budgetById, factsById, 'energy'));
const currentBest = bestOverPhases(bases, null);
const solved = solveFarmRespec({ heroes, account, maxPhase });

describe('the solver strictly beats the all-attack build', () => {
  it(`proposedObjective (${solved.proposedObjective.toFixed(0)}) > all-attack's best-over-phases (${allAttackBest.toFixed(0)})`, () => {
    expect(solved.proposedObjective).toBeGreaterThan(allAttackBest);
  });
});

describe('the solver strictly beats the all-energy build', () => {
  it(`proposedObjective (${solved.proposedObjective.toFixed(0)}) > all-energy's best-over-phases (${allEnergyBest.toFixed(0)})`, () => {
    expect(solved.proposedObjective).toBeGreaterThan(allEnergyBest);
  });
});

describe('the inverted-intuition finding: all-attack scores BELOW the current build', () => {
  it(`all-attack (${allAttackBest.toFixed(0)}) < current (${currentBest.toFixed(0)}) — measured 212,284 < 264,997 on the committed corpus`, () => {
    expect(allAttackBest).toBeLessThan(currentBest);
  });

  it('all-attack is the worst of {all-attack, all-energy, current, proposed}', () => {
    const values = [allAttackBest, allEnergyBest, currentBest, solved.proposedObjective];
    expect(allAttackBest).toBe(Math.min(...values));
  });
});

describe('the recommended phase reproduces the measured band', () => {
  it('the recommended phase is in 26–28', () => {
    expect(solved.recommendedPhase).toBeGreaterThanOrEqual(26);
    expect(solved.recommendedPhase).toBeLessThanOrEqual(28);
  });

  it('gainPct exceeds FARM_RESPEC_MIN_GAIN_PCT and sits inside the recorded band [4, 9] — measured ~6.19%', () => {
    // RE-MEASURED for issue #132: ~12.79% → ~6.19%. Two independent changes both pull gainPct
    // down together — crit chance/CDR moving back to percent-of-base (so a well-rolled hero's
    // crit/cdr points are worth less relative to its now-larger baseline DPS than the flat model
    // implied), and `reoptBudget` (`points-reopt-core.ts`) now clamping to `level` no matter
    // what, which removes the phantom search headroom an over-budget `pts` used to hand the
    // solver. Both are real, deliberate changes to this PR, not a regression.
    expect(solved.gainPct).toBeGreaterThan(1); // FARM_RESPEC_MIN_GAIN_PCT
    expect(solved.gainPct).toBeGreaterThanOrEqual(4);
    expect(solved.gainPct).toBeLessThanOrEqual(9);
  });

  it('the winning vector holds at least one Speed point — an attack/energy-only search would miss this gain', () => {
    const totalSpeed = solved.heroes.reduce((sum, hero) => sum + hero.proposedPts.speed, 0);
    expect(totalSpeed).toBeGreaterThan(0);
  });
});

describe('the chest objective reports a strictly higher chest rate and a different phase', () => {
  const chestSolve = solveFarmRespec({ heroes, account, objective: { kind: 'chests' }, maxPhase });

  it('the chest solve reports a strictly higher chestsPerHour than the gold solve', () => {
    expect(chestSolve.proposedChestsPerHour).toBeGreaterThan(solved.proposedChestsPerHour);
  });

  it('the chest solve\'s recommended phase differs from the gold solve\'s', () => {
    expect(chestSolve.recommendedPhase).not.toBe(solved.recommendedPhase);
  });

  it('the chest ratio (current build\'s own chest ceiling vs the chest-optimal build\'s) is ~1.40x, not the PRD\'s 4x', () => {
    const ratio = chestSolve.proposedChestsPerHour / chestSolve.currentChestsPerHour;
    expect(ratio).toBeGreaterThan(1.3);
    expect(ratio).toBeLessThan(1.5);
    expect(ratio).not.toBeGreaterThan(2); // rules out the PRD's uncommitted-capture 4x figure.
  });
});
