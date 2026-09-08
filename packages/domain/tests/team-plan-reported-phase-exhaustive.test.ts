/**
 * The Team Plan's REPORTED phase is swept exhaustively, not screened.
 *
 * `bestFarmPhase` screens world-openers then refines around the winner. An opener's own score
 * does not bound its world's peak, so the screen can settle a world or two away from the true
 * argmax. That is the right trade inside the search — thousands of evaluations, and a miss only
 * costs a slightly worse path — and the wrong trade for the handful whose numbers reach the
 * player, because the reported phase IS the advice.
 *
 * Nothing here is regime-bound: every claim is about which phase a sweep returns, which is
 * arithmetic over the capture and holds whatever the game has since patched.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildFarmObjective,
  evaluateFarmObjective,
  exhaustiveFarmObjective,
  isSquadScope,
} from '@bombfarm/domain/team-plan/farm-objective';
import { buildHeroPlanContexts } from '@bombfarm/domain/team-plan/hero-context';
import { loadoutForScoring } from '@bombfarm/domain/team-plan/evaluate';
import { createScoreMemo } from '@bombfarm/domain/team-plan/score';
import { REOPT_KEYS } from '@bombfarm/domain/points-reopt-core';
import type { Loadout, PointAlloc } from '@bombfarm/domain/gear/types';
import { loadTeamPlanFarmFixture } from './helpers/team-plan-farm-fixtures';

/** The witness below was found by scanning randomized point vectors on this capture; it is the
 *  7-hero one the other target-phase tests use. */
const CAPTURE = 'save-20260819-11882-7heroes.json';

/** A ceiling two phases past a world opener, which is where the screen has an opener to prefer
 *  and a mid-world peak to miss. */
const MAX_PHASE = 52;

/** Regenerated rather than pasted: the vector is 7 heroes x 7 keys, and the seed reproduces it in
 *  three lines. Trial 7 of this sequence is the disagreement. */
function witnessPoints(squad: readonly { heroId: string; pts: PointAlloc }[]): Record<string, PointAlloc> {
  let seed = 12345;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  let vector: Record<string, PointAlloc> = {};
  for (let trial = 0; trial <= 7; trial++) {
    vector = {};
    for (const ctx of squad) {
      const alloc = { ...ctx.pts };
      const total = REOPT_KEYS.reduce((sum, key) => sum + alloc[key], 0);
      const weights = REOPT_KEYS.map(() => rnd());
      const norm = weights.reduce((a, b) => a + b, 0) || 1;
      REOPT_KEYS.forEach((key, index) => {
        alloc[key] = Math.floor((total * weights[index]) / norm);
      });
      vector[ctx.heroId] = alloc;
    }
  }
  return vector;
}

function objectiveAtCeiling() {
  const fixture = loadTeamPlanFarmFixture(CAPTURE);
  const account = { ...fixture.teamPlanInput.account, maxPhase: MAX_PHASE };
  const built = buildHeroPlanContexts(
    fixture.teamPlanInput.heroes,
    account,
    fixture.teamPlanInput.scopeByHeroId,
  );
  if (built.blocked) throw new Error('expected contexts');
  const squad = built.contexts.filter((ctx) => isSquadScope(ctx.scope));
  const loadouts: Record<string, Loadout> = {};
  for (const hero of fixture.teamPlanInput.heroes) {
    loadouts[hero.heroId] = loadoutForScoring(hero.loadout, 0);
  }
  return { objective: buildFarmObjective(squad, account, loadouts), squad, loadouts };
}

describe('the screen really can miss, and the exhaustive wrapper really sweeps', () => {
  it('names a different phase, and never a worse one', () => {
    const { objective, squad, loadouts } = objectiveAtCeiling();
    const pts = witnessPoints(squad);

    const screened = evaluateFarmObjective(objective, loadouts, pts, createScoreMemo());
    const exhaustive = evaluateFarmObjective(
      exhaustiveFarmObjective(objective),
      loadouts,
      pts,
      createScoreMemo(),
    );

    // The witness: the screen prefers the opener of the last reachable world and misses a peak
    // two worlds down. Asserted as a disagreement rather than as the two phase numbers, so a
    // rebalance moves it without falsifying the claim.
    expect(screened.phase).not.toBe(exhaustive.phase);
    expect(exhaustive.objective).toBeGreaterThan(screened.objective);
    // A sweep is a superset of a screen, so it can never come back worse — on ANY state.
    expect(exhaustive.objective).toBeGreaterThanOrEqual(screened.objective);
  });

  it('is a no-op when the phase is pinned, because there is no argmax to sweep', () => {
    const { objective } = objectiveAtCeiling();
    const pinned = { ...objective, phaseOptions: { ...objective.phaseOptions, pinnedPhase: 21 } };
    expect(exhaustiveFarmObjective(pinned).phaseOptions.pinnedPhase).toBe(21);
  });
});

/**
 * The wiring, read off the source: the search may screen, the waterfall may not. Asserted this way
 * because both paths return the same phase on almost every state — the behavioural difference is
 * the ~2% the test above pins, and a plan whose reported phase happens to agree cannot tell the
 * two call sites apart.
 */
describe('the solver hands the waterfall the exhaustive objective', () => {
  const source = readFileSync(
    join(__dirname, '../src/team-plan/solver.ts'),
    'utf8',
  );

  it('builds a reported objective and passes it to buildWaterfall', () => {
    expect(source).toMatch(/const reportedObjective = farmObjective \? exhaustiveFarmObjective\(farmObjective\)/);
    expect(source).toMatch(/buildWaterfall\(\{[\s\S]*?farmObjective: reportedObjective,[\s\S]*?\}\)/);
  });

  it('reports the scored phase off that same objective, not the screened one', () => {
    expect(source).toMatch(/scoredPhaseReport\(input, reportedObjective, waterfall\.finalEvaluation\)/);
    expect(source).not.toMatch(/scoredPhaseReport\(input, farmObjective,/);
  });
});
