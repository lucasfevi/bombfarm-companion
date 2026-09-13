import { describe, expect, it } from 'vitest';
import type { TeamPlan } from '@bombfarm/domain/team-plan/types';
import { teamPlanEn } from '../copy';
import { formatElapsedSeconds, scoredPhaseHint, seedStartLabel } from './run-summary-copy';

function plan(overrides: Partial<TeamPlan>): TeamPlan {
  return {
    scoredPhase: null,
    scoredPhaseSource: 'account',
    scoredPhaseInfeasible: false,
    ...overrides,
  } as TeamPlan;
}

describe('formatElapsedSeconds', () => {
  it('formats milliseconds as seconds to one decimal', () => {
    expect(formatElapsedSeconds(1234, 'en')).toBe('1.2');
  });
});

describe('seedStartLabel', () => {
  it.each([
    ['current', teamPlanEn.teamPlanRunSeedCurrent],
    ['greedyHeroDps', teamPlanEn.teamPlanRunSeedGreedyHeroDps],
    ['greedySlotValue', teamPlanEn.teamPlanRunSeedGreedySlotValue],
    ['bestItemFirst', teamPlanEn.teamPlanRunSeedBestItemFirst],
  ] as const)('resolves %s to its own label', (seedUsed, expected) => {
    expect(seedStartLabel(teamPlanEn, seedUsed)).toBe(expected);
  });

  it('falls back for an unrecognised seed', () => {
    expect(seedStartLabel(teamPlanEn, 'something-else')).toBe(teamPlanEn.teamPlanRunSeedFallback);
  });
});

describe('scoredPhaseHint', () => {
  it('is null when there is no scored phase and the source is not a search', () => {
    expect(scoredPhaseHint(teamPlanEn, 'en', plan({ scoredPhase: null, scoredPhaseSource: 'account' }))).toBeNull();
  });

  it('reports no feasible phase was found when a search comes up empty', () => {
    expect(scoredPhaseHint(teamPlanEn, 'en', plan({ scoredPhase: null, scoredPhaseSource: 'searched' }))).toBe(
      teamPlanEn.teamPlanScoredPhaseNoneFeasible,
    );
  });

  it('reports an unreachable phase ahead of source-specific wording', () => {
    const hint = scoredPhaseHint(
      teamPlanEn,
      'en',
      plan({ scoredPhase: 200, scoredPhaseInfeasible: true, scoredPhaseSource: 'chosen' }),
    );
    expect(hint).toContain('cannot clear it');
  });

  it('names an automatically searched phase', () => {
    const hint = scoredPhaseHint(teamPlanEn, 'en', plan({ scoredPhase: 51, scoredPhaseSource: 'searched' }));
    expect(hint).toContain('picked automatically');
  });

  it("names the account's own phase", () => {
    const hint = scoredPhaseHint(teamPlanEn, 'en', plan({ scoredPhase: 51, scoredPhaseSource: 'account' }));
    expect(hint).toContain('where your account is now');
  });

  it('names a chosen phase', () => {
    const hint = scoredPhaseHint(teamPlanEn, 'en', plan({ scoredPhase: 51, scoredPhaseSource: 'chosen' }));
    expect(hint).toContain('the phase you picked');
  });
});
