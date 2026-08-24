import { describe, expect, it } from 'vitest';
import { ZERO_PTS } from '@bombfarm/domain/planner-constants';
import type { TeamPlan, TeamPlanPerHeroRow } from '@bombfarm/domain/team-plan/types';
import { pointsResetView } from '@/features/team-plan/model/points-reset-view';

const ZERO_STATS = {
  attack: 0,
  energy: 0,
  speed: 0,
  critChance: 0,
  critDmg: 0,
  penetration: 0,
  cdr: 0,
  luck: 0,
};

function row(overrides: Partial<TeamPlanPerHeroRow> = {}): TeamPlanPerHeroRow {
  return {
    heroId: '30140',
    heroName: 'Bellatrix',
    level: 109,
    before: 0,
    after: 0,
    delta: 0,
    combatStatsBefore: ZERO_STATS,
    combatStatsAfter: ZERO_STATS,
    sheetStatsBefore: ZERO_STATS,
    sheetStatsAfter: ZERO_STATS,
    hitBefore: 0,
    hitAfter: 0,
    ...overrides,
  };
}

function plan(pointResets: TeamPlan['pointResets']): TeamPlan {
  return {
    steps: [],
    forgeList: [],
    moveList: [],
    pointResets,
    perHero: [],
    proposedLoadouts: {},
    regime: 'underSaturated',
    sumDuty: 0,
    slots: 6,
    currentDps: 0,
    planDps: 0,
    forgeFloorApplied: 0,
    gearBreakdown: { forgeDelta: 0, moveDelta: 0 },
    requiresFullPlan: false,
    gearDipDps: 0,
    disclosures: {
      unmodelledAbilities: [],
      loadoutDriftHeroNames: [],
      foreignOwnedItemCount: 0,
      marketBlockedItemCount: 0,
      unresolvedDefItemCount: 0,
    },
    run: { rounds: 0, evaluations: 0, budgetExhausted: false, elapsedMs: 0, seedUsed: 'current' },
  };
}

const SCORED_AT = { ...ZERO_PTS(), attack: 94, energy: 15 };
const PROPOSED = { ...ZERO_PTS(), attack: 92, energy: 17 };

describe('pointsResetView', () => {
  it('reads the before column off the plan, so a respec after the run cannot rewrite it', () => {
    const view = pointsResetView(
      plan([
        {
          heroId: '30140',
          ptsBefore: SCORED_AT,
          pts: PROPOSED,
          gainPct: 1,
          rosterGainDps: 1,
          resetCostGold: 109_000,
        },
      ]),
      row(),
    );

    expect(view).toEqual({ before: SCORED_AT, after: PROPOSED, level: 109 });
  });

  it('returns nothing for a hero the plan proposed no reset for', () => {
    expect(pointsResetView(plan([]), row())).toBeNull();
  });
});
