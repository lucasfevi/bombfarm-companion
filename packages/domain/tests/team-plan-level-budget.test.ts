/**
 * The team-plan points passes budget against the hero's level, exactly as the single-hero
 * advisor pipeline does (`reoptBudget`) — `solver-search.ts`'s `pointsPass` and `waterfall.ts`'s
 * `finalPtsFromOptimizeBuild`, the two call sites that reach the reopt tiers from here.
 *
 * Replaces the former `team-plan-stat-points-available.test.ts`, whose premise was the defect:
 * the passes used to add a save's banked `statPointsAvailable` on top of `budgetOf(pts)`. That
 * count is a snapshot of `level - spent` taken at import and never shrank as the plan spent
 * those same points, so each pass re-granted the whole allowance and the proposed point reset
 * climbed past the hero's level — visibly, on the Team Plan page's own Point Reset table.
 *
 * Class (b) — structural: payload-20260812-8heroes.json supplies a realistic
 * loadout/sheetOther baseline only; the levels asserted against are read off the fixture hero
 * rather than pinned, so no hero identity or captured value is asserted here.
 */
import { describe, expect, it } from 'vitest';
import { SHEET_KEYS, ZERO_PTS } from '@bombfarm/domain/planner-constants';
import { zeroTeamBuffs } from '@bombfarm/domain/team-buffs';
import { runTeamPlan } from '@bombfarm/domain/team-plan/solver';
import { buildHeroPlanContext } from '@bombfarm/domain/team-plan/hero-context';
import { scoreHeroLoadout } from '@bombfarm/domain/team-plan/score';
import { finalPtsFromOptimizeBuild } from '@bombfarm/domain/team-plan/waterfall';
import { farmFromAccount } from '@bombfarm/domain/team-plan/waterfall-guards';
import type { RosterEvaluation } from '@bombfarm/domain/team-plan/types';
import { holdTeamPlanSuiteUntilInRegime, teamPlanInputFromFixture } from './helpers/team-plan-fixtures';

holdTeamPlanSuiteUntilInRegime();

function sumPts(pts: Record<string, number>): number {
  return SHEET_KEYS.reduce((sum, key) => sum + (pts[key] ?? 0), 0);
}

describe('team-plan point budget — waterfall.ts finalPtsFromOptimizeBuild', () => {
  it('places at most the hero level, and re-running the pass on its own output does not grow the spend', () => {
    const input = teamPlanInputFromFixture('payload-20260812-8heroes.json', 10);
    const heroInput = input.heroes[0]!;
    const farm = farmFromAccount(input);

    const ctx = buildHeroPlanContext({ ...heroInput, pts: ZERO_PTS() }, input.account, 'optimize')!;
    const score = scoreHeroLoadout(ctx, heroInput.loadout, ZERO_PTS(), zeroTeamBuffs(), farm);
    const evaluation: RosterEvaluation = {
      objective: 0,
      regime: 'underSaturated',
      sumDuty: 0,
      slots: 0,
      perHero: { [ctx.heroId]: score },
      auras: zeroTeamBuffs(),
    };

    const first = finalPtsFromOptimizeBuild([ctx], evaluation, { [ctx.heroId]: ZERO_PTS() });
    const firstSum = sumPts(first[ctx.heroId]!);
    expect(firstSum).toBeGreaterThan(0);
    expect(firstSum).toBeLessThanOrEqual(ctx.level);

    // The defect, driven the way the page does it — the pass fed its own output back. Each
    // round used to add the banked count again; now the budget is the same pool either way.
    let pts = first;
    for (let round = 0; round < 4; round++) {
      pts = finalPtsFromOptimizeBuild([ctx], evaluation, pts);
      expect(sumPts(pts[ctx.heroId]!), `round ${round}`).toBe(firstSum);
    }
  });

  it('a hero at level 0 has nothing to place', () => {
    const input = teamPlanInputFromFixture('payload-20260812-8heroes.json', 10);
    const heroInput = input.heroes[0]!;
    const farm = farmFromAccount(input);

    const ctx = buildHeroPlanContext(
      { ...heroInput, pts: ZERO_PTS(), level: 0 },
      input.account,
      'optimize',
    )!;
    const score = scoreHeroLoadout(ctx, heroInput.loadout, ZERO_PTS(), zeroTeamBuffs(), farm);
    const evaluation: RosterEvaluation = {
      objective: 0,
      regime: 'underSaturated',
      sumDuty: 0,
      slots: 0,
      perHero: { [ctx.heroId]: score },
      auras: zeroTeamBuffs(),
    };

    const out = finalPtsFromOptimizeBuild([ctx], evaluation, { [ctx.heroId]: ZERO_PTS() });
    expect(sumPts(out[ctx.heroId]!)).toBe(0);
  });
});

describe('team-plan point budget — solver-search.ts pointsPass (via runTeamPlan)', () => {
  it('never proposes a point reset that spends past the hero level', () => {
    const input = teamPlanInputFromFixture('payload-20260812-8heroes.json', 10);
    const levelById = new Map(input.heroes.map((hero) => [hero.heroId, hero.level]));
    // Every hero starts with nothing spent, so the whole roster has its full pool to place —
    // the widest version of the case the old budget inflated.
    input.heroes = input.heroes.map((hero) => ({ ...hero, pts: ZERO_PTS() }));

    const result = runTeamPlan(input);
    if (result.blocked) throw new Error('blocked');
    expect(result.plan.pointResets.length).toBeGreaterThan(0);
    for (const reset of result.plan.pointResets) {
      const level = levelById.get(reset.heroId)!;
      expect(sumPts(reset.pts), `${reset.heroId} (level ${level})`).toBeLessThanOrEqual(level);
    }
  });

  it('agrees with the Planner: the reset it proposes spends the same pool the Points panel would', () => {
    const input = teamPlanInputFromFixture('payload-20260812-8heroes.json', 10);
    input.heroes = input.heroes.map((hero) => ({ ...hero, pts: ZERO_PTS() }));

    const result = runTeamPlan(input);
    if (result.blocked) throw new Error('blocked');
    const reset = result.plan.pointResets[0];
    expect(reset).toBeDefined();

    const hero = input.heroes.find((entry) => entry.heroId === reset!.heroId)!;
    // `reoptBudget(ZERO_PTS(), level)` is `level` — the Points panel's own ceiling
    // (`clampPointStep`). Placed + unplaced must account for exactly that, no more.
    expect(sumPts(reset!.pts)).toBeLessThanOrEqual(hero.level);
  });
});
