/**
 * The Team Plan's stat-point pass under the farm objective.
 *
 * Regime split, same rule as `team-plan-farm-objective.test.ts`: a claim about the SHAPE of the
 * pass — which heroes it may move, that Luck is frozen, that it is reproducible, that it stops at
 * its budget — is arithmetic over the capture and holds whatever the game has since patched, so it
 * runs on the whole corpus. A claim that the pass EARNS gold is a statement about the game on the
 * capture's date, so it runs only at or past the 2026-08-28 damage boundary.
 *
 * Every gain below is measured through the ordinary estimator path — `computeHeroFarmBases` ->
 * `squadFactsFromBases` -> `bestFarmPhase` — never through the bridge that chose the points. A
 * pass scored by its own chooser would agree with itself no matter what it did.
 */
import { describe, expect, it } from 'vitest';
import { computeHeroFarmBases, squadFactsFromBases } from '@bombfarm/domain/farm-rate';
import {
  bestFarmPhase,
  resolveFarmObjective,
  type FarmObjectiveScales,
} from '@bombfarm/domain/farm-optimize-objective';
import { runTeamPlan } from '@bombfarm/domain/team-plan';
import { buildFarmObjective, isSquadScope } from '@bombfarm/domain/team-plan/farm-objective';
import { farmPointsPass, FARM_POINTS_PASS_MAX_EVALUATIONS } from '@bombfarm/domain/team-plan/farm-points';
import { loadoutForScoring } from '@bombfarm/domain/team-plan/evaluate';
import { buildHeroPlanContexts } from '@bombfarm/domain/team-plan/hero-context';
import { createScoreMemo } from '@bombfarm/domain/team-plan/score';
import { REOPT_KEYS } from '@bombfarm/domain/points-reopt-core';
import type { Loadout, PointAlloc } from '@bombfarm/domain/gear/types';
import { assertInRegime } from './helpers/capture-regime';
import { loadTeamPlanFarmFixture, type TeamPlanFarmFixture } from './helpers/team-plan-farm-fixtures';

const GOLD = resolveFarmObjective({ kind: 'gold' });
const UNUSED_SCALES: FarmObjectiveScales = { goldScale: 1, chestScale: 1 };

const CAPTURES = [
  'save-20260818-12heroes.json',
  'save-20260819-11882-7heroes.json',
  'save-20260822-15heroes-tree-crit-dmg.json',
  'save-20260823-13heroes-crit-points.json',
  'save-20260828-4heroes-postpatch.json',
  'save-20260831-13heroes-soulbound.json',
];

/** At or past the damage boundary — the only captures a gain may be measured on. */
const GAIN_CAPTURES = ['save-20260828-4heroes-postpatch.json', 'save-20260831-13heroes-soulbound.json'];
for (const file of GAIN_CAPTURES) assertInRegime(`sheet-math/${file}`, 'sheet');

function goldPerHour(
  fixture: TeamPlanFarmFixture,
  loadoutByHeroId: Readonly<Record<string, Loadout>> = {},
  ptsByHeroId: Readonly<Record<string, PointAlloc>> = {},
): number {
  const squadIds = new Set(fixture.enabledHeroIds);
  const heroes = fixture.heroes
    .filter((hero) => squadIds.has(hero.id))
    .map((hero) => ({
      ...hero,
      loadout: loadoutByHeroId[hero.id] ?? hero.loadout,
      pts: (ptsByHeroId[hero.id] as typeof hero.pts) ?? hero.pts,
    }));
  const bases = computeHeroFarmBases({ heroes, account: fixture.account, enabledHeroIds: fixture.enabledHeroIds });
  const squad = squadFactsFromBases(bases, null, fixture.account);
  const pick = bestFarmPhase(squad, GOLD, UNUSED_SCALES, {
    maxPhase: fixture.account.maxPhase,
    exhaustive: true,
  });
  return pick ? pick.row.goldPerHour : 0;
}

function farmPlan(fixture: TeamPlanFarmFixture, maxEvaluations?: number) {
  const result = runTeamPlan({ ...fixture.teamPlanInput, objective: 'farm' }, maxEvaluations ? { maxEvaluations } : undefined);
  if (result.blocked) throw new Error('expected a plan');
  return result.plan;
}

function resetsByHeroId(plan: ReturnType<typeof farmPlan>): Record<string, PointAlloc> {
  const out: Record<string, PointAlloc> = {};
  for (const reset of plan.pointResets) out[reset.heroId] = reset.pts as PointAlloc;
  return out;
}

describe('the farm point pass earns gold the gear alone does not', () => {
  for (const file of GAIN_CAPTURES) {
    it(`${file}: the proposed points beat the same plan's gear on its own`, () => {
      const fixture = loadTeamPlanFarmFixture(file);
      const plan = farmPlan(fixture);
      const gearOnly = goldPerHour(fixture, plan.proposedLoadouts);
      const gearAndPoints = goldPerHour(fixture, plan.proposedLoadouts, resetsByHeroId(plan));

      // Non-vacuity: a pass that proposed nothing would pass a `>=` here for the wrong reason.
      expect(plan.pointResets.length).toBeGreaterThan(0);
      expect(gearAndPoints).toBeGreaterThan(gearOnly);
    }, 600_000);
  }
});

/**
 * Driven at `farmPointsPass` rather than through a plan, deliberately. The waterfall filters
 * `pointResets` to optimize scope on its way out, so a pass that moved a left-alone hero would
 * never appear there — it would instead poison the objective, which would then be maximising a
 * squad the player cannot field. Mutation-checked: granting every hero a budget leaves the
 * plan-level assertions entirely green.
 */
describe('the pass moves only what the plan is allowed to move', () => {
  for (const file of CAPTURES) {
    it(`${file}: a left-alone hero keeps its points, and Luck never moves`, () => {
      const fixture = loadTeamPlanFarmFixture(file, { scopeByIndex: { 1: 'leaveAlone', 2: 'leaveAlone' } });
      const contexts = buildHeroPlanContexts(
        fixture.teamPlanInput.heroes,
        fixture.teamPlanInput.account,
        fixture.teamPlanInput.scopeByHeroId,
      );
      if (contexts.blocked) throw new Error('expected contexts');
      const squad = contexts.contexts.filter((ctx) => isSquadScope(ctx.scope));
      const loadoutByHeroId: Record<string, Loadout> = {};
      const ptsByHeroId: Record<string, PointAlloc> = {};
      for (const hero of fixture.teamPlanInput.heroes) {
        loadoutByHeroId[hero.heroId] = loadoutForScoring(hero.loadout, 0);
      }
      for (const ctx of squad) {
        ptsByHeroId[ctx.heroId] = ctx.pts;
      }

      const objective = buildFarmObjective(squad, fixture.teamPlanInput.account, loadoutByHeroId);
      const result = farmPointsPass({
        objective,
        loadoutByHeroId,
        ptsByHeroId,
        memo: createScoreMemo(),
        evaluationBudget: FARM_POINTS_PASS_MAX_EVALUATIONS,
      });

      const nonOptimize = squad.filter((ctx) => ctx.scope !== 'optimize');
      expect(nonOptimize.length, 'the fixture must actually carry a left-alone hero').toBeGreaterThan(0);
      for (const ctx of nonOptimize) {
        expect(result.ptsByHeroId[ctx.heroId], `${ctx.heroId} was moved despite being left alone`).toEqual(ctx.pts);
      }
      for (const ctx of squad) {
        expect(result.ptsByHeroId[ctx.heroId]?.luck).toBe(ctx.pts.luck);
      }
    }, 600_000);
  }
});

describe('a reset is only written when it actually changes the build', () => {
  for (const file of GAIN_CAPTURES) {
    it(`${file}: every reported reset differs from the hero's current points`, () => {
      const fixture = loadTeamPlanFarmFixture(file);
      const plan = farmPlan(fixture);
      for (const reset of plan.pointResets) {
        const changed = REOPT_KEYS.some((key) => reset.pts[key] !== reset.ptsBefore[key]);
        expect(changed, `${reset.heroId} reported an unchanged reset`).toBe(true);
      }
    }, 600_000);
  }
});

describe('the pass is bounded by the plan budget, not its own appetite', () => {
  it('a tiny budget stops the plan and is never overspent', () => {
    const fixture = loadTeamPlanFarmFixture('save-20260823-13heroes-crit-points.json');
    const plan = farmPlan(fixture, 400);
    expect(plan.run.evaluations).toBeLessThanOrEqual(400);
    expect(plan.run.budgetExhausted).toBe(true);
  }, 600_000);

  it('the default budget is not exhausted, so the bound above is the one being tested', () => {
    const fixture = loadTeamPlanFarmFixture('save-20260831-13heroes-soulbound.json');
    const plan = farmPlan(fixture);
    expect(plan.run.budgetExhausted).toBe(false);
  }, 600_000);
});

describe('the pass is reproducible', () => {
  for (const file of ['save-20260831-13heroes-soulbound.json', 'save-20260823-13heroes-crit-points.json']) {
    it(`${file}: two runs propose the same points`, () => {
      const fixture = loadTeamPlanFarmFixture(file);
      const first = farmPlan(fixture);
      const second = farmPlan(loadTeamPlanFarmFixture(file));
      expect(second.pointResets).toEqual(first.pointResets);
    }, 900_000);
  }
});
