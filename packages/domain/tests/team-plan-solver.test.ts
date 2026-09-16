import { describe, expect, it, vi } from 'vitest';
import * as advisorPipeline from '@bombfarm/domain/advisor-pipeline';
import { TEAM_PLAN_MAX_EVALUATIONS, MAX_ROUNDS, runTeamPlan } from '@bombfarm/domain/team-plan/solver';
import { TEAM_PLAN_FIXTURE, holdTeamPlanSuiteUntilInRegime, teamPlanInputFromFixture } from './helpers/team-plan-fixtures';

holdTeamPlanSuiteUntilInRegime();

function assertOk(result: ReturnType<typeof runTeamPlan>): asserts result is { blocked: false; plan: NonNullable<import('@bombfarm/domain/team-plan/types').TeamPlan> } {
  expect(result.blocked).toBe(false);
  if (result.blocked) throw new Error('expected plan');
}

describe('runTeamPlan', () => {
  it('returns blocked when an in-scope hero lacks birth', () => {
    const input = teamPlanInputFromFixture(TEAM_PLAN_FIXTURE);
    input.heroes[0] = { ...input.heroes[0]!, birth: undefined };
    const result = runTeamPlan(input);
    expect(result.blocked).toBe(true);
    if (result.blocked) {
      expect(result.heroNames.length).toBeGreaterThan(0);
    }
  });

  it('does not call computeAdvisorPipeline during a full run', () => {
    const spy = vi.spyOn(advisorPipeline, 'computeAdvisorPipeline');
    const input = teamPlanInputFromFixture(TEAM_PLAN_FIXTURE);
    runTeamPlan(input);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('is deterministic on the fixture', () => {
    const input = teamPlanInputFromFixture(TEAM_PLAN_FIXTURE);
    const first = runTeamPlan(input);
    const second = runTeamPlan(input);
    assertOk(first);
    assertOk(second);
    const stripElapsed = (plan: typeof first.plan) => {
      const { run, ...rest } = plan;
      const { elapsedMs: _elapsed, ...runRest } = run;
      return { ...rest, run: runRest };
    };
    expect(JSON.stringify(stripElapsed(first.plan))).toBe(JSON.stringify(stripElapsed(second.plan)));
  });

  it('satisfies planDps >= currentDps on the fixture', () => {
    const result = runTeamPlan(teamPlanInputFromFixture(TEAM_PLAN_FIXTURE));
    assertOk(result);
    expect(result.plan.planDps).toBeGreaterThanOrEqual(result.plan.currentDps);
  });

  it('finds strictly positive gain on the fixture', () => {
    const result = runTeamPlan(teamPlanInputFromFixture(TEAM_PLAN_FIXTURE));
    assertOk(result);
    expect(result.plan.planDps).toBeGreaterThan(result.plan.currentDps);
  });

  it('reports seedUsed and rounds in run metadata', () => {
    const result = runTeamPlan(teamPlanInputFromFixture(TEAM_PLAN_FIXTURE));
    assertOk(result);
    expect(result.plan.run.seedUsed).toBeTruthy();
    expect(result.plan.run.rounds).toBeGreaterThanOrEqual(0);
    // MAX_ROUNDS now counts gear<->points alternations (each gearPass climbs to local
    // optimality), not individual moves — the convergence break normally exits well before it.
    expect(result.plan.run.rounds).toBeLessThanOrEqual(MAX_ROUNDS);
  });

  it('records evaluation count within the budget cap', () => {
    const result = runTeamPlan(teamPlanInputFromFixture(TEAM_PLAN_FIXTURE));
    assertOk(result);
    expect(result.plan.run.evaluations).toBeGreaterThan(0);
    expect(result.plan.run.evaluations).toBeLessThanOrEqual(TEAM_PLAN_MAX_EVALUATIONS);
  });

  it('returns budgetExhausted with planDps >= currentDps on a tiny evaluation cap', () => {
    const result = runTeamPlan(teamPlanInputFromFixture(TEAM_PLAN_FIXTURE), {
      maxEvaluations: 3,
    });
    assertOk(result);
    expect(result.plan.run.budgetExhausted).toBe(true);
    expect(result.plan.planDps).toBeGreaterThanOrEqual(result.plan.currentDps);
  });

  it('never returns an empty proposedLoadouts map for optimize heroes', () => {
    const input = teamPlanInputFromFixture(TEAM_PLAN_FIXTURE);
    const result = runTeamPlan(input);
    assertOk(result);
    const optimizeIds = input.heroes.map((h) => h.heroId);
    for (const heroId of optimizeIds) {
      expect(result.plan.proposedLoadouts[heroId]).toBeDefined();
    }
  });

  it('includes per-hero rows for every optimize hero', () => {
    const input = teamPlanInputFromFixture(TEAM_PLAN_FIXTURE);
    const result = runTeamPlan(input);
    assertOk(result);
    expect(result.plan.perHero).toHaveLength(input.heroes.length);
  });

  it('reports regime and slot duty metadata', () => {
    const result = runTeamPlan(teamPlanInputFromFixture(TEAM_PLAN_FIXTURE));
    assertOk(result);
    expect(['underSaturated', 'saturated']).toContain(result.plan.regime);
    expect(result.plan.sumDuty).toBeGreaterThanOrEqual(0);
    expect(result.plan.slots).toBeGreaterThanOrEqual(1);
  });

  it('reports no runed heroes on a fixture with none', () => {
    const result = runTeamPlan(teamPlanInputFromFixture(TEAM_PLAN_FIXTURE));
    assertOk(result);
    expect(result.plan.runedHeroNames).toEqual([]);
  });

  it('records elapsedMs as a non-negative number', () => {
    const result = runTeamPlan(teamPlanInputFromFixture(TEAM_PLAN_FIXTURE));
    assertOk(result);
    expect(result.plan.run.elapsedMs).toBeGreaterThanOrEqual(0);
  });

  // The 45-second bound is a ceiling, not a target: the 9-hero roster converges in ~3s locally.
  it('completes the fixture under 45 seconds', () => {
    const input = teamPlanInputFromFixture(TEAM_PLAN_FIXTURE);
    const started = performance.now();
    const result = runTeamPlan(input);
    const elapsed = performance.now() - started;
    // eslint-disable-next-line no-console -- task requires logging measured value
    console.log(`team-plan payload fixture elapsedMs=${Math.round(elapsed)}`);
    assertOk(result);
    expect(elapsed).toBeLessThan(45_000);
  });

  it('exports the worker bundle marker constant', async () => {
    const mod = await import('@bombfarm/domain/team-plan/solver');
    expect(mod.TEAM_PLAN_WORKER_MARKER).toBe('runTeamPlan');
  });
});
