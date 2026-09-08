/**
 * `TeamPlanInput.targetPhase` — the one phase both objectives score at.
 *
 * Nothing here is regime-bound. Every claim is about the SEARCH, not about the game: that a named
 * phase reaches the thing being optimised, that it is reported back, that removing it restores the
 * sweep. A patch moves the numbers on both sides of each comparison together, so these assertions
 * are worth more on more captures rather than fewer.
 *
 * The two "a pin changes what is optimised" tests are the load-bearing ones. A phase control wired
 * to nothing still renders, still stores a value, and still round-trips through `TeamPlanInput` —
 * the only thing that catches it is a plan that comes out DIFFERENT for a low pin and a high one,
 * under each objective separately.
 */
import { describe, expect, it } from 'vitest';
import { runTeamPlan } from '@bombfarm/domain/team-plan';
import { wikiPhaseLine } from '@bombfarm/domain/phase-wiki';
import { farmFromAccount } from '@bombfarm/domain/team-plan/waterfall-guards';
import type { TeamPlanInput } from '@bombfarm/domain/team-plan/types';
import { loadTeamPlanFarmFixture } from './helpers/team-plan-farm-fixtures';

/** 7 heroes, 40 items worn — geared enough that the search has real choices to make, and small
 *  enough that this file runs six plans without dominating the suite. */
const CAPTURE = 'save-20260819-11882-7heroes.json';

/** Both feasible for this squad, and far enough apart that the phase's own economy differs. */
const LOW_PHASE = 1;
const HIGH_PHASE = 51;

function inputFor(): TeamPlanInput {
  return loadTeamPlanFarmFixture(CAPTURE).teamPlanInput;
}

function planAt(
  input: TeamPlanInput,
  objective: 'dps' | 'farm',
  targetPhase: number | null,
) {
  const result = runTeamPlan({ ...input, objective, targetPhase });
  if (result.blocked) throw new Error(`plan blocked: ${result.heroNames.join(', ')}`);
  return result.plan;
}

describe('a chosen phase changes what the search optimises', () => {
  it('farm: a plan pinned low and one pinned high are different plans, at their own phases', () => {
    const input = inputFor();
    const low = planAt(input, 'farm', LOW_PHASE);
    const high = planAt(input, 'farm', HIGH_PHASE);

    expect(low.scoredPhase).toBe(LOW_PHASE);
    expect(high.scoredPhase).toBe(HIGH_PHASE);
    // The objective IS gold per hour in farm mode, and the two phases pay differently enough that
    // a picker wired to nothing could not produce this gap.
    expect(low.planDps).toBeGreaterThan(0);
    expect(high.planDps).toBeGreaterThan(low.planDps * 2);
  });

  it('damage: the same two pins score the roster against their own phase mitigation', () => {
    const input = inputFor();
    const low = planAt(input, 'dps', LOW_PHASE);
    const high = planAt(input, 'dps', HIGH_PHASE);

    expect(low.scoredPhase).toBe(LOW_PHASE);
    expect(high.scoredPhase).toBe(HIGH_PHASE);
    expect(low.planDps).not.toBe(high.planDps);
    // Not merely "different": the harder phase mitigates more, so it must be the lower figure.
    expect(high.planDps).toBeLessThan(low.planDps);
  });

  it('the mitigation a pin scores against is that phase\'s wiki row, not the save\'s', () => {
    const input = inputFor();
    const context = farmFromAccount({ ...input, targetPhase: HIGH_PHASE });

    expect(context.phase).toBe(HIGH_PHASE);
    expect(context.mitigationPct).toBe((wikiPhaseLine(HIGH_PHASE)?.mitig ?? 0) * 100);
    expect(farmFromAccount(input).mitigationPct).toBe(input.account.mitigationPct);
  });
});

describe('no chosen phase', () => {
  it('farm still sweeps, and the plan names the phase it settled on as automatic', () => {
    const input = inputFor();
    const swept = planAt(input, 'farm', null);

    expect(swept.scoredPhaseSource).toBe('searched');
    expect(swept.scoredPhase).not.toBeNull();
    expect(swept.scoredPhaseInfeasible).toBe(false);
    // A sweep that only ever returned the account's own phase would be no sweep at all.
    expect(swept.scoredPhase).toBeLessThanOrEqual(input.account.maxPhase ?? 600);
    expect(swept.planDps).toBeGreaterThan(0);
  });

  it('damage stays on the account\'s own phase, and does not invent one', () => {
    const input = inputFor();
    const plan = planAt(input, 'dps', null);

    expect(plan.scoredPhaseSource).toBe('account');
    expect(plan.scoredPhase).toBe(input.account.phase);
  });
});

describe('phases the account has not reached, and phases the squad cannot hold', () => {
  it('a pin past maxPhase is planned for rather than refused', () => {
    const input = inputFor();
    const beyond = (input.account.maxPhase ?? 1) + 20;
    const plan = planAt(input, 'farm', beyond);

    expect(plan.scoredPhase).toBe(beyond);
    expect(plan.scoredPhaseSource).toBe('chosen');
  });

  it('a phase the squad cannot clear reports itself, rather than passing zero off as a rate', () => {
    const input = inputFor();
    const plan = planAt(input, 'farm', 600);

    expect(plan.scoredPhase).toBe(600);
    expect(plan.scoredPhaseSource).toBe('chosen');
    expect(plan.scoredPhaseInfeasible).toBe(true);
    expect(plan.planDps).toBe(0);
  });
});

describe('a record with no furthest phase', () => {
  function withoutMaxPhase(): TeamPlanInput {
    const input = inputFor();
    return { ...input, account: { ...input.account, maxPhase: null } };
  }

  it('farm plans fine with a phase named — there is no sweep left to bound', () => {
    const plan = planAt(withoutMaxPhase(), 'farm', HIGH_PHASE);

    expect(plan.scoredPhase).toBe(HIGH_PHASE);
    expect(plan.planDps).toBeGreaterThan(0);
  });

  it('farm still refuses to sweep without one, rather than ranging over all 600 phases', () => {
    expect(() => planAt(withoutMaxPhase(), 'farm', null)).toThrow(/targetPhase or account.maxPhase/);
  });
});

describe('determinism', () => {
  it('the same account, objective and phase give the same plan twice', () => {
    const input = inputFor();
    const first = planAt(input, 'farm', HIGH_PHASE);
    const second = planAt(input, 'farm', HIGH_PHASE);

    expect(second.planDps).toBe(first.planDps);
    expect(second.scoredPhase).toBe(first.scoredPhase);
    expect(second.moveList).toEqual(first.moveList);
    expect(second.pointResets).toEqual(first.pointResets);
  });
});
