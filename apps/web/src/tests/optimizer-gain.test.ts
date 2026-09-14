import { describe, expect, it } from 'vitest';
import type { TeamPlan } from '@bombfarm/domain/team-plan/types';
import { FARM_RESPEC_WORTH_MAKING_PCT } from '@bombfarm/farm/core';
import { belowFloor, gainPct } from '@/features/home/model/optimizer-gain';

function plan(overrides: Partial<TeamPlan>): TeamPlan {
  return {
    steps: [],
    forgeList: [],
    moveList: [],
    pointResets: [],
    perHero: [],
    proposedLoadouts: {},
    regime: 'underSaturated',
    sumDuty: 1,
    slots: 3,
    currentDps: 100,
    planDps: 120,
    forgeFloorApplied: 10,
    allowedChanges: 'both',
    scoredPhase: null,
    scoredPhaseSource: 'account',
    scoredPhaseInfeasible: false,
    gearBreakdown: { forgeDelta: 0, moveDelta: 0 },
    requiresFullPlan: false,
    gearDipDps: 0,
    runedHeroNames: [],
    run: { rounds: 1, evaluations: 1, budgetExhausted: false, elapsedMs: 1, seedUsed: 'seed' },
    ...overrides,
  };
}

describe("the optimizer card's headline gain", () => {
  it("gain is the waterfall's percent and zero when the current DPS is zero", () => {
    expect(gainPct(plan({ currentDps: 100, planDps: 112 }))).toBe(12);
    expect(gainPct(plan({ currentDps: 200, planDps: 190 }))).toBe(-5);
    expect(gainPct(plan({ currentDps: 0, planDps: 112 }))).toBe(0);
  });

  it("the floor is the farm respec's worth-making percent under either objective", () => {
    expect(FARM_RESPEC_WORTH_MAKING_PCT).toBe(5);
    expect(belowFloor(plan({ currentDps: 1000, planDps: 1049 }))).toBe(true);
    expect(belowFloor(plan({ currentDps: 1000, planDps: 1050 }))).toBe(false);
    expect(belowFloor(plan({ currentDps: 1000, planDps: 1000 + FARM_RESPEC_WORTH_MAKING_PCT * 10 - 1 }))).toBe(true);
    expect(belowFloor(plan({ currentDps: 1000, planDps: 1000 + FARM_RESPEC_WORTH_MAKING_PCT * 10 }))).toBe(false);
    expect(belowFloor(plan({ currentDps: 0, planDps: 500 }))).toBe(true);
  });
});
