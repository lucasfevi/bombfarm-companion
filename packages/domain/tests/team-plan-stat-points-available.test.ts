/**
 * Parity check for AC-59-adjacent behaviour: `statPointsAvailable` (banked, unspent stat points,
 * `HeroRecord.statPointsAvailable`) was threaded into the single-hero advisor pipeline's reopt
 * budget in PR #34 (`advisor-pipeline.ts` -> `findGateCandidate`), but `HeroPlanContext` /
 * `TeamPlanHeroInput` had no such field — team-plan's points passes (`solver-search.ts`'s
 * `pointsPass`, `waterfall.ts`'s `finalPtsFromOptimizeBuild`) silently kept calling
 * `findGateCandidate`/`optimizeBuild` with `statPointsAvailable` defaulted to 0, so a hero with
 * banked points got different advice from the Planner and the Team Plan page for the same
 * account state. These tests cover both team-plan call sites now that the field is threaded
 * through `buildHeroPlanContext`.
 *
 * MP5 F1 (AD-068 class (b) — structural): re-pointed onto payload-20260812-8heroes.json.
 * Every corpus hero has a real `stat_points_available: 0` (spec Edge Case), but both tests
 * here synthetically OVERRIDE `statPointsAvailable` to 20/0 on `heroInput` rather than reading
 * it from the fixture — the fixture only supplies a realistic loadout/sheetOther baseline, so
 * neither test actually depends on the fixture's own banked-points value and both re-point
 * with no loss.
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
import { teamPlanInputFromFixture } from './helpers/team-plan-fixtures';

function sumPts(pts: Record<string, number>): number {
  return SHEET_KEYS.reduce((sum, key) => sum + (pts[key] ?? 0), 0);
}

describe('team-plan statPointsAvailable — waterfall.ts finalPtsFromOptimizeBuild', () => {
  it('a hero with 0 spent + N banked points gets a real reallocation; 0 banked keeps the budget<=0 fast path', () => {
    const input = teamPlanInputFromFixture('payload-20260812-8heroes.json', 10);
    const heroInput = input.heroes[0]!;
    const farm = farmFromAccount(input);

    const ctxBanked = buildHeroPlanContext(
      { ...heroInput, pts: ZERO_PTS(), statPointsAvailable: 20 },
      input.account,
      'optimize',
    )!;
    const scoreBanked = scoreHeroLoadout(ctxBanked, heroInput.loadout, ZERO_PTS(), zeroTeamBuffs(), farm);
    const evaluationBanked: RosterEvaluation = {
      objective: 0,
      regime: 'underSaturated',
      sumDuty: 0,
      slots: 0,
      perHero: { [ctxBanked.heroId]: scoreBanked },
      auras: zeroTeamBuffs(),
    };
    const outBanked = finalPtsFromOptimizeBuild(
      [ctxBanked],
      evaluationBanked,
      { [ctxBanked.heroId]: ZERO_PTS() },
    );
    expect(sumPts(outBanked[ctxBanked.heroId]!)).toBeGreaterThan(0);
    expect(sumPts(outBanked[ctxBanked.heroId]!)).toBeLessThanOrEqual(20);

    const ctxUnbanked = buildHeroPlanContext(
      { ...heroInput, pts: ZERO_PTS(), statPointsAvailable: 0 },
      input.account,
      'optimize',
    )!;
    const scoreUnbanked = scoreHeroLoadout(ctxUnbanked, heroInput.loadout, ZERO_PTS(), zeroTeamBuffs(), farm);
    const evaluationUnbanked: RosterEvaluation = {
      ...evaluationBanked,
      perHero: { [ctxUnbanked.heroId]: scoreUnbanked },
    };
    const outUnbanked = finalPtsFromOptimizeBuild(
      [ctxUnbanked],
      evaluationUnbanked,
      { [ctxUnbanked.heroId]: ZERO_PTS() },
    );
    expect(sumPts(outUnbanked[ctxUnbanked.heroId]!)).toBe(0);
  });
});

describe('team-plan statPointsAvailable — solver-search.ts pointsPass (via runTeamPlan)', () => {
  it('proposes a point reset for a hero with 0 spent + banked points, but not for the same hero with 0 banked', () => {
    const bankedInput = teamPlanInputFromFixture('payload-20260812-8heroes.json', 10);
    const targetHeroId = bankedInput.heroes[0]!.heroId;
    bankedInput.heroes = bankedInput.heroes.map((hero) =>
      hero.heroId === targetHeroId
        ? { ...hero, pts: ZERO_PTS(), statPointsAvailable: 20 }
        : hero,
    );
    const bankedResult = runTeamPlan(bankedInput);
    if (bankedResult.blocked) throw new Error('blocked');
    const bankedReset = bankedResult.plan.pointResets.find((reset) => reset.heroId === targetHeroId);
    expect(bankedReset).toBeDefined();
    expect(sumPts(bankedReset!.pts)).toBeGreaterThan(0);

    const unbankedInput = teamPlanInputFromFixture('payload-20260812-8heroes.json', 10);
    unbankedInput.heroes = unbankedInput.heroes.map((hero) =>
      hero.heroId === targetHeroId
        ? { ...hero, pts: ZERO_PTS(), statPointsAvailable: 0 }
        : hero,
    );
    const unbankedResult = runTeamPlan(unbankedInput);
    if (unbankedResult.blocked) throw new Error('blocked');
    const unbankedReset = unbankedResult.plan.pointResets.find((reset) => reset.heroId === targetHeroId);
    expect(unbankedReset).toBeUndefined();
  });
});
