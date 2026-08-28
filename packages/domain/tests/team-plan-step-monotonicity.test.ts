import { describe, expect, it } from 'vitest';
import { runTeamPlan } from '@bombfarm/domain/team-plan/solver';
import type { TeamPlanInput, ScopeState } from '@bombfarm/domain/team-plan/types';
import { teamPlanInputFromFixture, TEAM_PLAN_FIXTURE, TEAM_PLAN_LARGE_FIXTURE } from './helpers/team-plan-fixtures';

/**
 * Regression grid for the roster gear optimizer step-monotonicity bug: the plan must never
 * recommend a chore (forge, moves, point resets) whose ROSTER-level DPS delta is negative — with
 * one deliberate, disclosed exception (option B): the `gear` step MAY sit below today, because it
 * is transient (the player climbs back out once the accompanying point resets land). When that
 * happens the plan must say so via `requiresFullPlan` / `gearDipDps` rather than hide it. Per-hero
 * deltas may still be negative — that invariant is checked separately in
 * team-plan-waterfall.test.ts.
 *
 * The bug only reproduces in the `saturated` regime (Σ duty >= slots), which is why the grid
 * sweeps small slot counts across two fixtures and several forge floors, plus donate-scope
 * mixes. `save-20260819-11882-7heroes.json` at floor 10 / slots 3, floor 10 / slots 5, and
 * floor 20 / slots 3 are the cases measured to reproduce the bug on unpatched code (respec step
 * as low as -726 on floor 10 / slots 3 alone).
 *
 * Budget: the guards in `waterfall-guards.ts` are a post-processing step over whatever
 * assignment/points the search happened to find — they hold at ANY evaluation budget, not only
 * a fully-converged one (a truncated search is if anything a *better* adversarial input, since
 * it is more likely to hand the waterfall a candidate that would have dipped without the guard).
 * So most of the grid runs at a small `maxEvaluations` to keep this file fast; only the three
 * cases the plan measured as reproducing the bug (see above) run at the real production budget,
 * to also cover the fully-converged search path end to end.
 *
 * Note on coverage: across this entire grid (both fixtures × every forge floor × every slot
 * count, plus the donate-scope mixes below), the fully-converged, guarded search never actually
 * hands `chooseGearCandidate` a dipping winner — `requiresFullPlan` is `false` everywhere here.
 * That is a property of these committed fixtures, not proof the option-B branch is unreachable or
 * untested: `team-plan-waterfall-requires-full-plan.test.ts` exercises it directly with a mocked
 * `evaluateRoster` so the dip-then-recover path itself has real coverage independent of whether
 * any committed save happens to trigger it.
 */

// MP5 F1 (AD-068 class (b) — structural): re-pointed onto the post-patch corpus. This grid's
// invariant (assertStepInvariants) is checked at every cell regardless of which file backs it,
// so the re-point itself carries no loss; only the three named FULL_BUDGET_CASES keys (specific
// configs the plan's authors measured as reproducing the option-B bug on the OLD fixture) are
// renamed onto the new corpus as a coverage-completeness choice, not a correctness requirement.
const FILES = [TEAM_PLAN_FIXTURE, TEAM_PLAN_LARGE_FIXTURE] as const;
const FORGE_FLOORS = [0, 10, 15, 20];
const SLOT_COUNTS = [1, 2, 3, 5, 9];
const GRID_TIMEOUT_MS = 30_000;
/** Full-budget reproduction cases need more headroom on GitHub-hosted runners. */
const FULL_BUDGET_TIMEOUT_MS = 90_000;

/** Small enough to run in well under a second per config; large enough to still search. */
const REDUCED_MAX_EVALUATIONS = 3_000;

/** The plan's own measured reproduction cases — run these at the real production budget. */
const FULL_BUDGET_CASES = new Set([
  'save-20260819-11882-7heroes.json|10|3',
  'save-20260819-11882-7heroes.json|10|5',
  'save-20260819-11882-7heroes.json|20|3',
]);

function donateMix(heroIds: string[]): Record<string, ScopeState> {
  const scope: Record<string, ScopeState> = {};
  heroIds.forEach((id, index) => {
    scope[id] = index % 3 === 0 ? 'donate' : 'optimize';
  });
  if (!Object.values(scope).includes('optimize')) {
    scope[heroIds[0]!] = 'optimize';
  }
  return scope;
}

/**
 * Option B invariants, checked at the roster level for every grid config:
 *  - the `respec` step's own delta is never negative (`acceptPointResets` only accepts heroes
 *    that raise the roster objective — unconditional, no exception);
 *  - the final (`respec`) objective is never below today, regardless of what the `gear` step did;
 *  - the `gear` step's delta is `>= -1e-9` UNLESS `plan.requiresFullPlan` is `true`, in which case
 *    the dip must be real (`gear.delta < -1e-9`, no false flagging) and `gearDipDps` must be the
 *    positive size of that exact dip;
 *  - every listed point reset shows the real in-game cost (`heroLevel * 1000` gold, display-only).
 */
function assertStepInvariants(result: ReturnType<typeof runTeamPlan>, input: TeamPlanInput): void {
  if (result.blocked) throw new Error('plan blocked');
  const { plan } = result;
  const todayStep = plan.steps.find((step) => step.id === 'today');
  const gearStep = plan.steps.find((step) => step.id === 'gear');
  const respecStep = plan.steps.find((step) => step.id === 'respec');
  if (!todayStep || !gearStep || !respecStep) throw new Error('missing waterfall step');

  expect(respecStep.delta).toBeGreaterThanOrEqual(-1e-9);
  expect(respecStep.objective).toBeGreaterThanOrEqual(todayStep.objective - 1e-9);

  if (plan.requiresFullPlan) {
    expect(gearStep.delta).toBeLessThan(-1e-9);
    expect(plan.gearDipDps).toBeGreaterThan(0);
    expect(plan.gearDipDps).toBeCloseTo(todayStep.objective - gearStep.objective, 6);
  } else {
    expect(gearStep.delta).toBeGreaterThanOrEqual(-1e-9);
    expect(plan.gearDipDps).toBe(0);
  }

  const levelByHeroId = new Map(input.heroes.map((hero) => [hero.heroId, hero.level]));
  for (const reset of plan.pointResets) {
    const level = levelByHeroId.get(reset.heroId) ?? 0;
    expect(reset.resetCostGold).toBe(level * 1000);
  }
}

function runAtBudget(input: TeamPlanInput, key: string) {
  const maxEvaluations = FULL_BUDGET_CASES.has(key) ? undefined : REDUCED_MAX_EVALUATIONS;
  return runTeamPlan(input, maxEvaluations === undefined ? undefined : { maxEvaluations });
}

describe('team plan step monotonicity (roster level)', () => {
  for (const file of FILES) {
    for (const forgeFloor of FORGE_FLOORS) {
      for (const slots of SLOT_COUNTS) {
        const key = `${file}|${forgeFloor}|${slots}`;
        const budgetNote = FULL_BUDGET_CASES.has(key) ? ' [full budget]' : '';
        it(
          `${file} floor ${forgeFloor} slots ${slots}: option B step invariants hold${budgetNote}`,
          () => {
            const input = teamPlanInputFromFixture(file, forgeFloor);
            input.account.fieldSlots = slots;
            assertStepInvariants(runAtBudget(input, key), input);
          },
          FULL_BUDGET_CASES.has(key) ? FULL_BUDGET_TIMEOUT_MS : GRID_TIMEOUT_MS,
        );
      }
    }
  }

  it(
    'export floor 10 slots 3 with a donate-scope mix: option B step invariants hold',
    () => {
      const input = teamPlanInputFromFixture(TEAM_PLAN_FIXTURE, 10);
      input.account.fieldSlots = 3;
      input.scopeByHeroId = donateMix(input.heroes.map((h) => h.heroId));
      assertStepInvariants(runTeamPlan(input, { maxEvaluations: REDUCED_MAX_EVALUATIONS }), input);
    },
    GRID_TIMEOUT_MS,
  );

  it(
    'export floor 20 slots 5 with a donate-scope mix: option B step invariants hold',
    () => {
      const input = teamPlanInputFromFixture(TEAM_PLAN_FIXTURE, 20);
      input.account.fieldSlots = 5;
      input.scopeByHeroId = donateMix(input.heroes.map((h) => h.heroId));
      assertStepInvariants(runTeamPlan(input, { maxEvaluations: REDUCED_MAX_EVALUATIONS }), input);
    },
    GRID_TIMEOUT_MS,
  );

  it(
    'export floor 10 slots 9: pointResets is in acceptance order, not heroId order',
    () => {
      // The LARGE in-regime fixture, deliberately, and it is the only test in this file that
      // needs it: an ordering claim needs at least two things to order, and the 7-hero roster
      // produces exactly ONE point reset at this config (measured). The 11-hero roster produces
      // five, in an order that is not alphabetical by heroId — which is the discrimination.
      const input = teamPlanInputFromFixture(TEAM_PLAN_LARGE_FIXTURE, 10);
      input.account.fieldSlots = 9;
      const result = runTeamPlan(input, { maxEvaluations: REDUCED_MAX_EVALUATIONS });
      if (result.blocked) throw new Error('plan blocked');
      const heroIds = result.plan.pointResets.map((reset) => reset.heroId);
      expect(heroIds.length).toBeGreaterThan(1);
      const sortedByHeroId = [...heroIds].sort((a, b) => a.localeCompare(b));
      // A regression to `.sort(heroId)` in buildPointResets would make this fail: acceptance
      // order (greedy best-marginal-gain-first) is not alphabetical for this fixture.
      expect(heroIds).not.toEqual(sortedByHeroId);
    },
    GRID_TIMEOUT_MS,
  );
});
