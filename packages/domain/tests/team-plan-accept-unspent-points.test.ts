/**
 * A plan that only ADDS points to a hero is free, so it is taken whenever it does not lower the
 * roster. `acceptPointResets` used to demand a strict gain for every hero, which dropped the
 * spend whenever the build was already right and the extra points moved nothing — the hero kept
 * them banked while the plan called itself finished.
 *
 * Luck is the clean witness: it is refundable and placeable like any stat but worth no combat
 * damage, so adding it can only tie the objective.
 */
import { describe, expect, it } from 'vitest';
import { buildHeroPlanContexts } from '@bombfarm/domain/team-plan/hero-context';
import { buildPool } from '@bombfarm/domain/team-plan/pool';
import { buildInitialAssignment } from '@bombfarm/domain/team-plan/solver-assignment';
import { acceptPointResets, evaluateAt } from '@bombfarm/domain/team-plan/waterfall-guards';
import type { PointAlloc } from '@bombfarm/domain/gear/types';
import { TEAM_PLAN_FIXTURE, holdTeamPlanSuiteUntilInRegime, teamPlanInputFromFixture } from './helpers/team-plan-fixtures';

holdTeamPlanSuiteUntilInRegime();

const input = teamPlanInputFromFixture(TEAM_PLAN_FIXTURE, 10);
const built = buildHeroPlanContexts(input.heroes, input.account, input.scopeByHeroId);
if (built.blocked) throw new Error('fixture roster is blocked');
const { contexts } = built;
const itemById = new Map(input.inventory.map((item) => [item.id, item]));
const optimizeContexts = contexts.filter((ctx) => ctx.scope === 'optimize');
const pool = buildPool({
  inventory: input.inventory,
  scopeByHeroId: input.scopeByHeroId,
  forgeFloor: input.forgeFloor,
  rosterHeroIds: new Set(input.heroes.map((hero) => hero.heroId)),
});
const assignment = buildInitialAssignment(input.inventory, pool, optimizeContexts, input.forgeFloor);
const currentPts: Record<string, PointAlloc> = Object.fromEntries(input.heroes.map((hero) => [hero.heroId, hero.pts]));
const heroId = optimizeContexts[0]!.heroId;
const evaluate = (pts: Record<string, PointAlloc>) =>
  evaluateAt(contexts, assignment, pts, input, itemById, input.forgeFloor);

function accept(finalPts: PointAlloc) {
  return acceptPointResets(
    contexts,
    assignment,
    currentPts,
    { ...currentPts, [heroId]: finalPts },
    input,
    itemById,
    input.forgeFloor,
    evaluate(currentPts),
  );
}

describe('acceptPointResets and points that change nothing', () => {
  it('takes an add-only spend that leaves the roster objective where it was', () => {
    const spent = { ...currentPts[heroId]!, luck: currentPts[heroId]!.luck + 3 };
    expect(evaluate({ ...currentPts, [heroId]: spent }).objective).toBeCloseTo(evaluate(currentPts).objective, 9);

    const result = accept(spent);

    expect(result.acceptedHeroIds).toEqual([heroId]);
    expect(result.ptsByHeroId[heroId]).toEqual(spent);
  });
});
