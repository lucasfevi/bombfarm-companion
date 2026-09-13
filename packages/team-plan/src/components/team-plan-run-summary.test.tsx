import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { TeamPlan } from '@bombfarm/domain/team-plan/types';
import { teamPlanEn } from '../copy';
import { teamPlanObjectiveCopy } from '../model/objective-copy';
import { TeamPlanRunSummary } from './team-plan-run-summary';

function plan(overrides: Partial<TeamPlan> = {}): TeamPlan {
  return {
    steps: [],
    forgeList: [],
    moveList: [],
    pointResets: [],
    perHero: [],
    proposedLoadouts: {},
    regime: 'underSaturated',
    sumDuty: 0,
    slots: 6,
    currentDps: 0,
    planDps: 0,
    forgeFloorApplied: 0,
    allowedChanges: 'both',
    scoredPhase: null,
    scoredPhaseSource: 'account',
    scoredPhaseInfeasible: false,
    gearBreakdown: { forgeDelta: 0, moveDelta: 0 },
    requiresFullPlan: false,
    gearDipDps: 0,
    runedHeroNames: [],
    run: { rounds: 0, evaluations: 0, budgetExhausted: false, elapsedMs: 0, seedUsed: 'current' },
    ...overrides,
  };
}

function render(givenPlan: TeamPlan) {
  return renderToStaticMarkup(
    createElement(TeamPlanRunSummary, {
      t: teamPlanEn,
      lang: 'en',
      plan: givenPlan,
      ranOnMainThread: false,
      copy: teamPlanObjectiveCopy(teamPlanEn, 'dps'),
    }),
  );
}

describe('TeamPlanRunSummary — runed-heroes line', () => {
  it('is absent when the plan names no runed heroes', () => {
    const html = render(plan({ runedHeroNames: [] }));
    expect(html).not.toContain('Timed runes');
  });

  it('names every runed hero, joined by comma, when the plan lists some', () => {
    const html = render(plan({ runedHeroNames: ['Jon', 'WB;PA'] }));
    expect(html).toContain('Timed runes are counted on: Jon, WB;PA.');
  });
});
