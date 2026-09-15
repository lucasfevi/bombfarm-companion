import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { TeamPlan } from '@bombfarm/domain/team-plan/types';
import { teamPlanEn } from '../copy';
import { teamPlanObjectiveCopy } from '../model/objective-copy';
import { TeamPlanRunSummary, TeamPlanRunSummaryBody } from './team-plan-run-summary';

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

function props(givenPlan: TeamPlan, ranOnMainThread = false) {
  return {
    t: teamPlanEn,
    lang: 'en' as const,
    plan: givenPlan,
    ranOnMainThread,
    copy: teamPlanObjectiveCopy(teamPlanEn, 'dps'),
  };
}

function renderBody(givenPlan: TeamPlan) {
  return renderToStaticMarkup(createElement(TeamPlanRunSummaryBody, props(givenPlan)));
}

describe('TeamPlanRunSummary — folded by default', () => {
  it('renders the title as a heading that opens the fold, and none of the body', () => {
    const html = renderToStaticMarkup(createElement(TeamPlanRunSummary, props(plan())));
    expect(html).toMatch(/<h2[^>]*><button[^>]*>.*Search summary/);
    expect(html).not.toContain('team-plan-run-summary-body');
    expect(html).not.toContain('search passes');
  });

  it('keeps a search cut short, and a search run on the main thread, outside the fold', () => {
    const cutShort = plan({ run: { ...plan().run, budgetExhausted: true } });
    const html = renderToStaticMarkup(createElement(TeamPlanRunSummary, props(cutShort, true)));
    expect(html).toContain(teamPlanEn.teamPlanBudgetExhausted);
    expect(html).toContain(teamPlanEn.teamPlanMainThreadFallback);
    expect(html).not.toContain('team-plan-run-summary-body');
  });
});

describe('TeamPlanRunSummaryBody — runed-heroes line', () => {
  it('is absent when the plan names no runed heroes', () => {
    const html = renderBody(plan({ runedHeroNames: [] }));
    expect(html).not.toContain('Timed runes');
  });

  it('names every runed hero, joined by comma, when the plan lists some', () => {
    const html = renderBody(plan({ runedHeroNames: ['Jon', 'WB;PA'] }));
    expect(html).toContain('Timed runes are counted on: Jon, WB;PA.');
  });
});
