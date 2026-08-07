import { describe, expect, it, vi } from 'vitest';
import * as advisorPipeline from '@bombfarm/domain/advisor-pipeline';
import { GEAR_PLAN_MAX_EVALUATIONS, runGearPlan } from '@bombfarm/domain/gear-plan/solver';
import { gearPlanInputFromFixture } from './helpers/gear-plan-fixtures';

function assertOk(result: ReturnType<typeof runGearPlan>): asserts result is { blocked: false; plan: NonNullable<import('@bombfarm/domain/gear-plan/types').GearPlan> } {
  expect(result.blocked).toBe(false);
  if (result.blocked) throw new Error('expected plan');
}

describe('runGearPlan', () => {
  it('returns blocked when an in-scope hero lacks birth', () => {
    const input = gearPlanInputFromFixture('save-20260731-11heroes.json');
    input.heroes[0] = { ...input.heroes[0]!, birth: undefined };
    const result = runGearPlan(input);
    expect(result.blocked).toBe(true);
    if (result.blocked) {
      expect(result.heroNames.length).toBeGreaterThan(0);
    }
  });

  it('does not call computeAdvisorPipeline during a full run', () => {
    const spy = vi.spyOn(advisorPipeline, 'computeAdvisorPipeline');
    const input = gearPlanInputFromFixture('save-20260731-11heroes.json');
    runGearPlan(input);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('is deterministic on save-20260731-11heroes.json', () => {
    const input = gearPlanInputFromFixture('save-20260731-11heroes.json');
    const first = runGearPlan(input);
    const second = runGearPlan(input);
    assertOk(first);
    assertOk(second);
    const stripElapsed = (plan: typeof first.plan) => {
      const { run, ...rest } = plan;
      const { elapsedMs: _elapsed, ...runRest } = run;
      return { ...rest, run: runRest };
    };
    expect(JSON.stringify(stripElapsed(first.plan))).toBe(JSON.stringify(stripElapsed(second.plan)));
  });

  it('satisfies planDps >= currentDps on save-20260731-11heroes.json', () => {
    const result = runGearPlan(gearPlanInputFromFixture('save-20260731-11heroes.json'));
    assertOk(result);
    expect(result.plan.planDps).toBeGreaterThanOrEqual(result.plan.currentDps);
  });

  it('satisfies planDps >= currentDps on save-20260801-crit-dmg-tree.json', () => {
    const result = runGearPlan(gearPlanInputFromFixture('save-20260801-crit-dmg-tree.json'));
    assertOk(result);
    expect(result.plan.planDps).toBeGreaterThanOrEqual(result.plan.currentDps);
  });

  it('finds strictly positive gain on save-20260731-11heroes.json', () => {
    const result = runGearPlan(gearPlanInputFromFixture('save-20260731-11heroes.json'));
    assertOk(result);
    expect(result.plan.planDps).toBeGreaterThan(result.plan.currentDps);
  });

  it('reports seedUsed and rounds in run metadata', () => {
    const result = runGearPlan(gearPlanInputFromFixture('save-20260731-11heroes.json'));
    assertOk(result);
    expect(result.plan.run.seedUsed).toBeTruthy();
    expect(result.plan.run.rounds).toBeGreaterThanOrEqual(0);
    expect(result.plan.run.rounds).toBeLessThanOrEqual(6);
  });

  it('records evaluation count within the budget cap', () => {
    const result = runGearPlan(gearPlanInputFromFixture('save-20260731-11heroes.json'));
    assertOk(result);
    expect(result.plan.run.evaluations).toBeGreaterThan(0);
    expect(result.plan.run.evaluations).toBeLessThanOrEqual(GEAR_PLAN_MAX_EVALUATIONS);
  });

  it('returns budgetExhausted with planDps >= currentDps on a tiny evaluation cap', () => {
    const result = runGearPlan(gearPlanInputFromFixture('save-20260731-11heroes.json'), {
      maxEvaluations: 3,
    });
    assertOk(result);
    expect(result.plan.run.budgetExhausted).toBe(true);
    expect(result.plan.planDps).toBeGreaterThanOrEqual(result.plan.currentDps);
  });

  it('never returns an empty proposedLoadouts map for optimize heroes', () => {
    const input = gearPlanInputFromFixture('save-20260731-11heroes.json');
    const result = runGearPlan(input);
    assertOk(result);
    const optimizeIds = input.heroes.map((h) => h.heroId);
    for (const heroId of optimizeIds) {
      expect(result.plan.proposedLoadouts[heroId]).toBeDefined();
    }
  });

  it('includes per-hero rows for every optimize hero', () => {
    const input = gearPlanInputFromFixture('save-20260731-11heroes.json');
    const result = runGearPlan(input);
    assertOk(result);
    expect(result.plan.perHero).toHaveLength(input.heroes.length);
  });

  it('reports regime and slot duty metadata', () => {
    const result = runGearPlan(gearPlanInputFromFixture('save-20260731-11heroes.json'));
    assertOk(result);
    expect(['underSaturated', 'saturated']).toContain(result.plan.regime);
    expect(result.plan.sumDuty).toBeGreaterThanOrEqual(0);
    expect(result.plan.slots).toBeGreaterThanOrEqual(1);
  });

  it('exposes disclosures for unmodelled abilities and exclusions', () => {
    const result = runGearPlan(gearPlanInputFromFixture('save-20260731-11heroes.json'));
    assertOk(result);
    expect(Array.isArray(result.plan.disclosures.unmodelledAbilities)).toBe(true);
    expect(result.plan.disclosures.marketBlockedItemCount).toBeGreaterThanOrEqual(0);
    expect(result.plan.disclosures.foreignOwnedItemCount).toBeGreaterThanOrEqual(0);
  });

  it('records elapsedMs as a non-negative number', () => {
    const result = runGearPlan(gearPlanInputFromFixture('save-20260731-11heroes.json'));
    assertOk(result);
    expect(result.plan.run.elapsedMs).toBeGreaterThanOrEqual(0);
  });

  it('completes save-20260801-crit-dmg-tree.json under 5 seconds', () => {
    const input = gearPlanInputFromFixture('save-20260801-crit-dmg-tree.json');
    const started = performance.now();
    const result = runGearPlan(input);
    const elapsed = performance.now() - started;
    // eslint-disable-next-line no-console -- task requires logging measured value
    console.log(`gear-plan crit-dmg fixture elapsedMs=${Math.round(elapsed)}`);
    assertOk(result);
    expect(elapsed).toBeLessThan(5000);
  });

  it('exports the worker bundle marker constant', async () => {
    const mod = await import('@bombfarm/domain/gear-plan/solver');
    expect(mod.GEAR_PLAN_WORKER_MARKER).toBe('runGearPlan');
  });
});
