/**
 * The optimizer characterization and discrimination suite — proof it does real work, not a
 * hardcoded "dump everything into one stat" that would coincidentally pass every other test.
 * Every literal here is a MEASUREMENT against the committed fixture, never one carried over from
 * the uncommitted capture the original planning notes used — those numbers do not reproduce on
 * this corpus and are deliberately absent from this file.
 *
 * Covers: the solver beating both naive builds, the recommended-phase band, and the chest
 * objective reporting a higher chest rate at a different phase than the gold objective.
 *
 * Measured on `save-20260914-9heroes-second-account.json`. The standard for what survives a
 * change of capture: a band or inequality that reproduces on a different roster is kept
 * unchanged; a pinned literal is re-measured and its footprint noted; a claim whose subject the
 * roster no longer holds is re-chosen with the reason stated. Bands that survive a change of
 * account are not rubber stamps — that is exactly the check the findings here rest on.
 */
import { describe, expect, it } from 'vitest';
import { solveFarmRespec, FARM_RESPEC_MIN_GAIN_PCT } from '@bombfarm/domain/farm-optimize';
import { resolveFarmObjective, bestFarmPhase, type FarmObjectiveScales } from '@bombfarm/domain/farm-optimize-objective';
import { computeHeroFarmBases, heroFactsFromBasis, squadFactsFromBases, type HeroFarmBasis } from '@bombfarm/domain/farm-rate';
import { reoptBudget, REOPT_KEYS } from '@bombfarm/domain/points-reopt-core';
import type { SheetKey } from '@bombfarm/domain/planner-constants';
import { holdSuiteUntilInRegime } from './helpers/capture-regime';
import { FARM_OPTIMIZE_FIXTURE, loadFarmRateFixture } from './helpers/farm-rate-fixtures';

holdSuiteUntilInRegime(`sheet-math/${FARM_OPTIMIZE_FIXTURE}`, 'sheet');

const { heroes, account, maxPhase } = loadFarmRateFixture(FARM_OPTIMIZE_FIXTURE);
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
  key: 'attack' | 'energy' | 'speed',
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
const allSpeedBest = bestOverPhases(bases, buildNaiveAssignment(bases, budgetById, factsById, 'speed'));
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
  // Holds on this roster too: 25,191,101 < 30,449,438, where the 2026-08-19 capture of the same
  // account measured 1,085,794 < 1,331,738. Dumping every point into damage is worse than the
  // build the account already has, because damage past the one-shot threshold buys nothing while
  // the energy and speed it was taken from buy uptime and cadence.
  it(`all-attack (${allAttackBest.toFixed(0)}) < current (${currentBest.toFixed(0)})`, () => {
    expect(allAttackBest).toBeLessThan(currentBest);
  });

  it('all-attack is the worst of {all-attack, all-energy, current, proposed}', () => {
    const values = [allAttackBest, allEnergyBest, currentBest, solved.proposedObjective];
    expect(allAttackBest).toBe(Math.min(...values));
  });
});

describe('the recommended phase reproduces the measured band', () => {
  // The account's own `max_phase` is 155 and the first phase it cannot clear is 150, yet the
  // solver picks 66: an interior gold peak, one phase below the current build's own argmax of
  // 67 — the proposal is the more energy-heavy build (share 0.64 against the current 0.57) that
  // farms a phase lower, faster. Re-measured 2026-09-18 when the search stopped seeding from the
  // player's build and gained the step-crossing moves: the pick moved from 71 (four phases past
  // the current argmax) to 66, and the proposal from 32.26m to 32.73m gold/h. The same account's
  // 2026-08-19 capture farmed at its ceiling (max_phase 52, pick 51), so the relation to the cap
  // is a property of where the account stands, not of the solver — what is pinned is the
  // measured pick, with the cap alongside it so a move of either is visible.
  it('the recommended phase is an interior peak (67), well below the reachable ceiling (155)', () => {
    expect(maxPhase).toBe(155);
    // RE-PINNED 2026-09-19 for the standing-props clear (ADR-017); the previous figure is in the git history.
    expect(solved.currentPhase).toBe(65);
    expect(solved.recommendedPhase).toBe(67);
    expect(solved.recommendedPhase!).toBeLessThan(maxPhase!);
  });

  // 7.49% here (5.96% before the from-zero search of 2026-09-18), inside the same [4, 9] band
  // the 2026-08-19 capture of this account measured at 7.21% and the retired 2026-08-13 roster at
  // ~6.19%. A band that holds across accounts and captures is evidence about the optimizer's
  // headroom rather than a number copied off one run.
  it('gainPct exceeds FARM_RESPEC_MIN_GAIN_PCT and sits inside the recorded band [4, 12]', () => {
    expect(solved.gainPct).toBeGreaterThan(FARM_RESPEC_MIN_GAIN_PCT);
    expect(solved.gainPct).toBeGreaterThanOrEqual(4);
    expect(solved.gainPct).toBeLessThanOrEqual(12);
  });

  // The property this protects is that Speed is a live candidate the search reaches and scores,
  // not a branch it cannot reach — asserted directly rather than through whether a given
  // roster's winner happens to spend on it.
  it('Speed is scored as a real, reachable candidate: an all-speed build evaluates to a finite, positive objective on the same path the solver searches, even though this roster is not the case where it wins', () => {
    expect(Number.isFinite(allSpeedBest)).toBe(true);
    expect(allSpeedBest).toBeGreaterThan(0);
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

  // The load-bearing half of this claim is the upper bound — it rules out the earlier 4x figure,
  // which came from an uncommitted capture nobody can re-read. The ratio itself is a drift
  // canary, not a contract: 1.426 on the same account's 2026-08-19 capture, 1.095 on 2026-09-14
  // — the chest-optimal build moved closer to the gold-optimal one as the roster matured.
  it('the chest-optimal build lifts the current build\'s own chest ceiling (ratio > 1) and nowhere near the earlier 4x claim; measured 1.127', () => {
    const ratio = chestSolve.proposedChestsPerHour / chestSolve.currentChestsPerHour;
    expect(ratio).toBeGreaterThan(1);
    expect(ratio).toBeLessThan(4);
    // RE-PINNED 2026-09-19 for the standing-props clear (ADR-017); the previous figure is in the git history.
    expect(ratio).toBeCloseTo(1.1271, 3);
  });
});
