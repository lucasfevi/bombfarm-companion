/**
 * The Team Plan under the set-farming objective.
 *
 * Every claim is a property of the plan — where its phase lies, that it is the best phase of the
 * band for the build it proposes, how much Luck it buys, that it reads the set and not the
 * player's phase, how it reports a set it cannot reach — and none pins a figure, so none is gated
 * on a capture's regime. The squads are realistic shapes only.
 *
 * Each figure the plan reports is re-derived through the ordinary estimator path
 * (`computeHeroFarmBases` → `squadFactsFromBases`), never through the bridge that chose it.
 */
import { describe, expect, it } from 'vitest';
import { computeFarmRateRow, computeHeroFarmBases, squadFactsFromBases } from '@bombfarm/domain/farm-rate';
import {
  bestFarmPhase,
  farmObjectiveValue,
  resolveFarmObjective,
  type FarmObjectiveScales,
} from '@bombfarm/domain/farm-optimize-objective';
import { reoptBudget } from '@bombfarm/domain/points-reopt-core';
import { runTeamPlan, SET_FARM_SETS, setFarmBand, type TeamPlan } from '@bombfarm/domain/team-plan';
import type { Loadout, PointAlloc } from '@bombfarm/domain/gear/types';
import { loadTeamPlanFarmFixture, type TeamPlanFarmFixture } from './helpers/team-plan-farm-fixtures';

const UNIT_SCALES: FarmObjectiveScales = { goldScale: 1, chestScale: 1 };

/** Clears its low phases in ~17 s and its highest reached in minutes. */
const FAST = 'save-20260914-9heroes-second-account.json';
/** Never clears a map in much under 20 s, even with the points spent for it. */
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

});

describe('a squad that clears slowly still farms the set — slow is not unfarmable', () => {
  it('ember on the slow squad: a finite, positive rate at an unlocked band phase', () => {
    const fixture = loadTeamPlanFarmFixture(SLOW);
    const plan = setPlan(fixture, 'ember', { allowedChanges: 'points' });
    const band = setFarmBand('ember')!;
    expect(plan.scoredPhaseInfeasible).toBe(false);
    expect(plan.scoredPhase).toBeGreaterThanOrEqual(band.minPhase);
    expect(plan.scoredPhase).toBeLessThanOrEqual(band.maxPhase);
    expect(Number.isFinite(plan.planDps) && plan.planDps > 0).toBe(true);
    expect(plan.scoredPhaseClearSecs).toBeGreaterThan(0);
  }, 60_000);

  it('every set the slow squad has reached is farmable, however slow the clear', () => {
    const fixture = loadTeamPlanFarmFixture(SLOW);
    const maxPhase = fixture.teamPlanInput.account.maxPhase!;
    const reached = SET_FARM_SETS.filter((id) => setFarmBand(id)!.minPhase <= maxPhase);
    expect(reached.length, 'non-vacuity').toBeGreaterThanOrEqual(3);
    let slowest = 0;
    for (const farmSet of reached) {
      const plan = setPlan(fixture, farmSet, { allowedChanges: 'points' });
      expect(plan.scoredPhaseInfeasible, farmSet).toBe(false);
      expect(plan.planDps, farmSet).toBeGreaterThan(0);
      slowest = Math.max(slowest, plan.scoredPhaseClearSecs ?? 0);
    }
    // Non-vacuity: at least one of those is a clear a fixed cap would have thrown away.
    expect(slowest).toBeGreaterThan(60);
  }, 120_000);
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
  };
}

function setObjective(farmSet: string) {
  return resolveFarmObjective({ kind: 'setChests', itemLevel: setFarmBand(farmSet)!.itemLevel });
}

describe('a farmable set: the plan farms the best phase of its band for the build it proposes', () => {
  for (const farmSet of ['ember', 'gold', 'coal']) {
    it(`${farmSet}: the scored phase is in the band, unlocked, and the brute-force best there`, () => {
      const fixture = loadTeamPlanFarmFixture(FAST);
      const plan = fastPointsPlan(farmSet);
      const band = setFarmBand(farmSet)!;
      expect(plan.scoredPhaseSource).toBe('searched');
      expect(plan.scoredPhaseInfeasible).toBe(false);
      expect(plan.scoredPhase).toBeGreaterThanOrEqual(band.minPhase);
      expect(plan.scoredPhase).toBeLessThanOrEqual(Math.min(band.maxPhase, fixture.teamPlanInput.account.maxPhase!));
      expect(plan.planDps).toBeGreaterThan(0);

      const squad = estimatorSquad(fixture, plan.proposedLoadouts, resetsByHeroId(plan));
      const maxPhase = fixture.teamPlanInput.account.maxPhase!;
      let best: { phase: number; value: number } | null = null;
      for (let phase = band.minPhase; phase <= Math.min(band.maxPhase, maxPhase); phase++) {
        const row = computeFarmRateRow(phase, squad, { maxPhase })!;
        if (row.infeasible) continue;
        const value = farmObjectiveValue(row, setObjective(farmSet), UNIT_SCALES);
        if (best === null || value > best.value) best = { phase, value };
      }
      expect(plan.scoredPhase).toBe(best!.phase);
    }, 60_000);

    it(`${farmSet}: the reported clear time is the scored phase's own`, () => {
      const fixture = loadTeamPlanFarmFixture(FAST);
      const plan = fastPointsPlan(farmSet);
      const squad = estimatorSquad(fixture, plan.proposedLoadouts, resetsByHeroId(plan));
      const row = computeFarmRateRow(plan.scoredPhase!, squad, { maxPhase: fixture.teamPlanInput.account.maxPhase })!;
      expect(plan.scoredPhaseClearSecs).toBeCloseTo(row.clearSecs, 6);
    }, 60_000);
  }

  it('the plan is free to farm a slow clear: coal settles on one over 20 s on this squad', () => {
    expect(fastPointsPlan('coal').scoredPhaseClearSecs).toBeGreaterThan(20);
  }, 60_000);

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

/**
 * Luck multiplies every chest, and every point in it is a point out of attack, which slows the
 * clear and so drops fewer chests. The search weighs one against the other; these pin the shape
 * of that balance loosely — measured on this squad, Luck took 20–31% of the budget across ember,
 * gold and coal, and handing it all back to attack kept 95–97% of the rate.
 */
describe('Luck is a destination, balanced against clear speed', () => {
  function lucklessOf(planned: Record<string, PointAlloc>): Record<string, PointAlloc> {
    const out: Record<string, PointAlloc> = {};
    for (const [heroId, pts] of Object.entries(planned)) out[heroId] = { ...pts, attack: pts.attack + pts.luck, luck: 0 };
    return out;
  }

  function bandValue(fixture: TeamPlanFarmFixture, plan: TeamPlan, farmSet: string, pts: Record<string, PointAlloc>) {
    const squad = estimatorSquad(fixture, plan.proposedLoadouts, pts);
    return bestFarmPhase(squad, setObjective(farmSet), UNIT_SCALES, bandOptions(fixture, farmSet))?.value ?? 0;
  }

  it('the plan buys Luck the build does not hold today, and it pays in set chests', () => {
    const fixture = loadTeamPlanFarmFixture(FAST);
    const plan = fastPointsPlan('ember');
    const planned = resetsByHeroId(plan);
    expect(totalLuck(fixture, planned)).toBeGreaterThan(totalLuck(fixture, {}));
    expect(bandValue(fixture, plan, 'ember', planned)).toBeGreaterThan(bandValue(fixture, plan, 'ember', lucklessOf(planned)));
  }, 60_000);

  for (const farmSet of ['ember', 'gold', 'coal']) {
    it(`${farmSet}: Luck stays a minority of the budget, and the rate leans on it only modestly`, () => {
      const fixture = loadTeamPlanFarmFixture(FAST);
      const plan = fastPointsPlan(farmSet);
      const planned = resetsByHeroId(plan);
      const budget = fixture.teamPlanInput.heroes.reduce((sum, hero) => sum + reoptBudget(hero.level), 0);
      expect(totalLuck(fixture, planned) / budget).toBeLessThan(0.5);
      const withLuck = bandValue(fixture, plan, farmSet, planned);
      expect(bandValue(fixture, plan, farmSet, lucklessOf(planned)) / withLuck).toBeGreaterThan(0.85);
    }, 60_000);
  }
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
