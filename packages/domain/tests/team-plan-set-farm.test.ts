/**
 * The Team Plan under the set-farming objective.
 *
 * Every claim is a property of the plan — where its phase lies, that the clear stays quick, that
 * it reads the set and not the player's phase, how it reports a set it cannot farm — and none
 * pins a figure, so none is gated on a capture's regime. The squads are realistic shapes only.
 *
 * Each figure the plan reports is re-derived through the ordinary estimator path
 * (`computeHeroFarmBases` → `squadFactsFromBases`), never through the bridge that chose it.
 */
import { describe, expect, it } from 'vitest';
import { computeFarmRateRow, computeHeroFarmBases, squadFactsFromBases } from '@bombfarm/domain/farm-rate';
import {
  bestFarmPhase,
  fastestClearPhase,
  resolveFarmObjective,
  type FarmObjectiveScales,
} from '@bombfarm/domain/farm-optimize-objective';
import { reoptBudget, RESPEC_KEYS } from '@bombfarm/domain/points-reopt-core';
import {
  runTeamPlan,
  SET_FARM_MAX_CLEAR_SECS,
  SET_FARM_SETS,
  setFarmBand,
  type TeamPlan,
} from '@bombfarm/domain/team-plan';
import { buildFarmObjective, evaluateFarmObjective, isSquadScope } from '@bombfarm/domain/team-plan/farm-objective';
import { farmPointsPass, FARM_POINTS_PASS_MAX_EVALUATIONS } from '@bombfarm/domain/team-plan/farm-points';
import { loadoutForScoring } from '@bombfarm/domain/team-plan/evaluate';
import { buildHeroPlanContexts } from '@bombfarm/domain/team-plan/hero-context';
import { createScoreMemo } from '@bombfarm/domain/team-plan/score';
import type { Loadout, PointAlloc } from '@bombfarm/domain/gear/types';
import { loadTeamPlanFarmFixture, type TeamPlanFarmFixture } from './helpers/team-plan-farm-fixtures';

const UNIT_SCALES: FarmObjectiveScales = { goldScale: 1, chestScale: 1 };

/** Clears its low phases in ~17 s, so some sets are farmable inside the cap and some are not. */
const FAST = 'save-20260914-9heroes-second-account.json';
/** Never clears any map faster than ~22 s, so no set is farmable inside the cap. */
const SLOW = 'save-20260831-13heroes-soulbound.json';

function setPlan(fixture: TeamPlanFarmFixture, farmSet: string | null, extra: object = {}): TeamPlan {
  const result = runTeamPlan({ ...fixture.teamPlanInput, objective: 'setFarm', farmSet, ...extra });
  if (result.blocked) throw new Error('expected a plan');
  return result.plan;
}

function resetsByHeroId(plan: TeamPlan): Record<string, PointAlloc> {
  const out: Record<string, PointAlloc> = {};
  for (const reset of plan.pointResets) out[reset.heroId] = reset.pts as PointAlloc;
  return out;
}

/** The squad facts of a build, through the estimator's own entry rather than the plan's bridge. */
function estimatorSquad(
  fixture: TeamPlanFarmFixture,
  loadoutByHeroId: Readonly<Record<string, Loadout>> = {},
  ptsByHeroId: Readonly<Record<string, PointAlloc>> = {},
) {
  const squadIds = new Set(fixture.enabledHeroIds);
  const heroes = fixture.heroes
    .filter((hero) => squadIds.has(hero.id))
    .map((hero) => ({
      ...hero,
      loadout: loadoutByHeroId[hero.id] ?? hero.loadout,
      pts: (ptsByHeroId[hero.id] as typeof hero.pts) ?? hero.pts,
    }));
  const bases = computeHeroFarmBases({ heroes, account: fixture.account, enabledHeroIds: fixture.enabledHeroIds });
  return squadFactsFromBases(bases, null, fixture.account);
}

function totalLuck(fixture: TeamPlanFarmFixture, ptsByHeroId: Readonly<Record<string, PointAlloc>>): number {
  return fixture.teamPlanInput.heroes.reduce((sum, hero) => sum + (ptsByHeroId[hero.heroId] ?? hero.pts).luck, 0);
}

describe('the set must be named, and the account must say how far it reaches', () => {
  const fixture = loadTeamPlanFarmFixture(FAST);

  for (const farmSet of [null, 'not-a-set']) {
    it(`farmSet ${JSON.stringify(farmSet)} throws, naming the known sets`, () => {
      expect(() => setPlan(fixture, farmSet)).toThrow(/farmSet.*Known sets: ember/s);
    });
  }

  it('an absent account.maxPhase throws', () => {
    const noMax = { ...fixture.teamPlanInput, account: { ...fixture.teamPlanInput.account, maxPhase: null } };
    expect(() => runTeamPlan({ ...noMax, objective: 'setFarm', farmSet: 'ember' })).toThrow(/maxPhase/);
  });
});

describe('a set the account cannot reach is reported, not thrown', () => {
  it('a band wholly above maxPhase: infeasible, named by its first phase, nothing proposed', () => {
    const fixture = loadTeamPlanFarmFixture(FAST);
    const maxPhase = fixture.teamPlanInput.account.maxPhase!;
    const above = SET_FARM_SETS.find((id) => setFarmBand(id)!.minPhase > maxPhase)!;
    const plan = setPlan(fixture, above);
    expect(plan.scoredPhase).toBe(setFarmBand(above)!.minPhase);
    expect(plan.scoredPhaseSource).toBe('searched');
    expect(plan.scoredPhaseInfeasible).toBe(true);
    expect(plan.planDps).toBe(0);
    expect(plan.pointResets).toEqual([]);
  }, 60_000);

  it('a squad too slow for the cap anywhere: infeasible, named by the band phase it clears fastest', () => {
    const fixture = loadTeamPlanFarmFixture(SLOW);
    const plan = setPlan(fixture, 'ember', { allowedChanges: 'points' });
    const band = setFarmBand('ember')!;
    expect(plan.scoredPhaseInfeasible).toBe(true);
    expect(plan.scoredPhaseSource).toBe('searched');
    expect(plan.planDps).toBe(0);
    const squad = estimatorSquad(fixture, plan.proposedLoadouts, resetsByHeroId(plan));
    const options = {
      maxPhase: fixture.teamPlanInput.account.maxPhase,
      phaseRange: { min: band.minPhase, max: band.maxPhase },
    };
    expect(plan.scoredPhase).toBe(fastestClearPhase(squad, options));
    // Non-vacuity: the named phase really is over the cap, on the estimator's own reading.
    expect(computeFarmRateRow(plan.scoredPhase!, squad, options)!.clearSecs).toBeGreaterThan(SET_FARM_MAX_CLEAR_SECS);
  }, 60_000);
});

/**
 * Points only: the gear search would add a minute per plan without touching any claim below, all
 * of which are about where the plan farms and how it spends points.
 */
const fastPlans = new Map<string, TeamPlan>();
function fastPointsPlan(farmSet: string): TeamPlan {
  let plan = fastPlans.get(farmSet);
  if (!plan) {
    plan = setPlan(loadTeamPlanFarmFixture(FAST), farmSet, { allowedChanges: 'points' });
    fastPlans.set(farmSet, plan);
  }
  return plan;
}

function bandOptions(fixture: TeamPlanFarmFixture, farmSet: string) {
  const band = setFarmBand(farmSet)!;
  return {
    maxPhase: fixture.teamPlanInput.account.maxPhase,
    phaseRange: { min: band.minPhase, max: band.maxPhase },
    maxClearSecs: SET_FARM_MAX_CLEAR_SECS,
  };
}

describe('a farmable set: the plan farms inside its band and keeps the clear quick', () => {
  for (const farmSet of ['ember', 'gold', 'coal']) {
    it(`${farmSet}: the scored phase is in the band, unlocked, and clears inside the cap`, () => {
      const fixture = loadTeamPlanFarmFixture(FAST);
      const plan = fastPointsPlan(farmSet);
      const band = setFarmBand(farmSet)!;
      expect(plan.scoredPhaseSource).toBe('searched');
      expect(plan.scoredPhaseInfeasible).toBe(false);
      expect(plan.scoredPhase).toBeGreaterThanOrEqual(band.minPhase);
      expect(plan.scoredPhase).toBeLessThanOrEqual(Math.min(band.maxPhase, fixture.teamPlanInput.account.maxPhase!));
      expect(plan.planDps).toBeGreaterThan(0);

      const squad = estimatorSquad(fixture, plan.proposedLoadouts, resetsByHeroId(plan));
      const row = computeFarmRateRow(plan.scoredPhase!, squad, { maxPhase: fixture.teamPlanInput.account.maxPhase })!;
      expect(row.infeasible).toBe(false);
      expect(row.clearSecs).toBeLessThanOrEqual(SET_FARM_MAX_CLEAR_SECS);
    }, 60_000);
  }

  it('a band split with its neighbours at both ends is farmed where it drops alone', () => {
    // 'gold' drops on 21–50 and shares 21–30 and 41–50; this squad's chests/hr are flat enough
    // across the band (see the objective-layer suite) that the halved share decides.
    const plan = fastPointsPlan('gold');
    expect(plan.scoredPhase).toBeGreaterThanOrEqual(31);
    expect(plan.scoredPhase).toBeLessThanOrEqual(40);
  }, 60_000);

  it('the plan never lands below today, and is the set’s chests per hour', () => {
    const plan = fastPointsPlan('ember');
    const [today, , planned] = plan.steps.map((step) => step.objective);
    expect(planned).toBeGreaterThanOrEqual(today);
    // A gold figure on this account is in the tens of millions; a chest rate is in the tens.
    expect(planned).toBeLessThan(1_000);
  }, 60_000);
});

describe('Luck is a destination, and the clear cap bounds how much of it the plan buys', () => {
  it('the plan buys Luck the build does not hold today, and it pays in set chests', () => {
    const fixture = loadTeamPlanFarmFixture(FAST);
    const plan = fastPointsPlan('ember');
    const planned = resetsByHeroId(plan);
    expect(totalLuck(fixture, planned)).toBeGreaterThan(totalLuck(fixture, {}));

    // Same points with the Luck handed back to attack: the plan's Luck must be what earns.
    const luckless: Record<string, PointAlloc> = {};
    for (const [heroId, pts] of Object.entries(planned)) luckless[heroId] = { ...pts, attack: pts.attack + pts.luck, luck: 0 };
    const objective = resolveFarmObjective({ kind: 'setChests', itemLevel: setFarmBand('ember')!.itemLevel });
    const value = (pts: Record<string, PointAlloc>) =>
      bestFarmPhase(estimatorSquad(fixture, plan.proposedLoadouts, pts), objective, UNIT_SCALES, bandOptions(fixture, 'ember'))
        ?.value ?? 0;
    expect(value(planned)).toBeGreaterThan(value(luckless));
  }, 60_000);

  it('all-in on Luck clears no band phase in time, so the plan stopped short of it', () => {
    const fixture = loadTeamPlanFarmFixture(FAST);
    const plan = fastPointsPlan('ember');
    const allLuck: Record<string, PointAlloc> = {};
    for (const hero of fixture.teamPlanInput.heroes) {
      const zeroed = Object.fromEntries(RESPEC_KEYS.map((key) => [key, 0]));
      allLuck[hero.heroId] = { ...hero.pts, ...zeroed, luck: reoptBudget(hero.level) } as PointAlloc;
    }
    const objective = resolveFarmObjective({ kind: 'setChests', itemLevel: setFarmBand('ember')!.itemLevel });
    const allLuckPick = bestFarmPhase(
      estimatorSquad(fixture, plan.proposedLoadouts, allLuck),
      objective,
      UNIT_SCALES,
      bandOptions(fixture, 'ember'),
    );
    expect(allLuckPick).toBeNull();
    expect(totalLuck(fixture, resetsByHeroId(plan))).toBeLessThan(totalLuck(fixture, allLuck));
    expect(plan.scoredPhaseInfeasible).toBe(false);
  }, 60_000);
});

describe('the clear cap acts on the search, not only on the report', () => {
  it('coal: on the plan’s own build the uncapped best phase is too slow, yet the plan clears in time', () => {
    // Non-vacuity first: if nothing past the cap paid more, a plan that ignored the cap would
    // pass the in-band check above for free.
    const fixture = loadTeamPlanFarmFixture(FAST);
    const plan = fastPointsPlan('coal');
    const squad = estimatorSquad(fixture, plan.proposedLoadouts, resetsByHeroId(plan));
    const objective = resolveFarmObjective({ kind: 'setChests', itemLevel: setFarmBand('coal')!.itemLevel });
    const uncapped = bestFarmPhase(squad, objective, UNIT_SCALES, { ...bandOptions(fixture, 'coal'), maxClearSecs: null });
    expect(uncapped!.row.clearSecs).toBeGreaterThan(SET_FARM_MAX_CLEAR_SECS);
    const scored = computeFarmRateRow(plan.scoredPhase!, squad, { maxPhase: fixture.teamPlanInput.account.maxPhase })!;
    expect(scored.clearSecs).toBeLessThanOrEqual(SET_FARM_MAX_CLEAR_SECS);
    expect(totalLuck(fixture, resetsByHeroId(plan))).toBeGreaterThan(totalLuck(fixture, {}));
  }, 60_000);
});

describe('the point pass itself honours the cap', () => {
  it('coal: points searched under the cap out-earn points searched blind to it, inside the cap', () => {
    const fixture = loadTeamPlanFarmFixture(FAST);
    const input = fixture.teamPlanInput;
    const built = buildHeroPlanContexts(input.heroes, input.account, input.scopeByHeroId);
    if (built.blocked) throw new Error('expected contexts');
    const squad = built.contexts.filter((ctx) => isSquadScope(ctx.scope));
    const loadouts: Record<string, Loadout> = {};
    const today: Record<string, PointAlloc> = {};
    for (const hero of input.heroes) {
      loadouts[hero.heroId] = loadoutForScoring(hero.loadout, 0);
      today[hero.heroId] = hero.pts;
    }
    const capped = buildFarmObjective(squad, input.account, loadouts, null, false, undefined, setFarmBand('coal'));
    const blind = { ...capped, phaseOptions: { ...capped.phaseOptions, maxClearSecs: null } };
    const searched = (objective: typeof capped) =>
      farmPointsPass({
        objective,
        loadoutByHeroId: loadouts,
        ptsByHeroId: today,
        memo: createScoreMemo(),
        evaluationBudget: FARM_POINTS_PASS_MAX_EVALUATIONS,
      }).ptsByHeroId;
    const inCap = (pts: Record<string, PointAlloc>) =>
      evaluateFarmObjective(capped, loadouts, pts, createScoreMemo()).objective;

    expect(inCap(searched(capped))).toBeGreaterThan(inCap(searched(blind)));
    expect(inCap(searched(capped))).toBeGreaterThanOrEqual(inCap(today));
  }, 60_000);
});

describe('the set, not the player’s phase, decides where the plan farms', () => {
  it('a targetPhase outside the band is ignored', () => {
    const fixture = loadTeamPlanFarmFixture(FAST);
    const plan = setPlan(fixture, 'gold', { allowedChanges: 'points', targetPhase: 120 });
    expect(plan.scoredPhaseSource).toBe('searched');
    expect(plan.scoredPhase).toBe(fastPointsPlan('gold').scoredPhase);
  }, 60_000);

  it('a farmSet is not read outside the set objective: the gold plan is unchanged by one', () => {
    const fixture = loadTeamPlanFarmFixture(FAST);
    const run = (extra: object) => {
      const result = runTeamPlan({ ...fixture.teamPlanInput, objective: 'farm', allowedChanges: 'points', ...extra });
      if (result.blocked) throw new Error('expected a plan');
      return { ...result.plan, run: { ...result.plan.run, elapsedMs: 0 } };
    };
    expect(run({ farmSet: 'ember' })).toEqual(run({}));
  }, 60_000);
});
