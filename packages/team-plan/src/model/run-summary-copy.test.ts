import { describe, expect, it } from 'vitest';
import type { TeamPlan } from '@bombfarm/domain/team-plan/types';
import { teamPlanEn } from '../copy';
import {
  formatElapsedSeconds,
  scoredPhaseHint,
  scoredPhaseMovedFrom,
  scoredPhaseValue,
  seedStartLabel,
} from './run-summary-copy';

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
    expect(scoredPhaseHint(teamPlanEn, plan({ scoredPhase: null, scoredPhaseSource: 'account' }))).toBeNull();
  });

  it('reports no feasible phase was found when a search comes up empty', () => {
    expect(scoredPhaseHint(teamPlanEn, plan({ scoredPhase: null, scoredPhaseSource: 'searched' }))).toBe(
      teamPlanEn.teamPlanScoredPhaseNoneFeasible,
    );
  });

  it('reports an unreachable phase ahead of source-specific wording', () => {
    const hint = scoredPhaseHint(
      teamPlanEn,
      plan({ scoredPhase: 200, scoredPhaseInfeasible: true, scoredPhaseSource: 'chosen' }),
    );
    expect(hint).toContain('cannot clear it');
  });

  it('names an automatically searched phase', () => {
    const hint = scoredPhaseHint(teamPlanEn, plan({ scoredPhase: 51, scoredPhaseSource: 'searched' }));
    expect(hint).toContain('Picked automatically');
  });

  it("names the account's own phase", () => {
    const hint = scoredPhaseHint(teamPlanEn, plan({ scoredPhase: 51, scoredPhaseSource: 'account' }));
    expect(hint).toContain('Where your account is now');
  });

  it('names a chosen phase', () => {
    const hint = scoredPhaseHint(teamPlanEn, plan({ scoredPhase: 51, scoredPhaseSource: 'chosen' }));
    expect(hint).toContain('The phase you picked');
  });
});

describe('scoredPhaseValue', () => {
  it('writes the phase the way the game does', () => {
    expect(scoredPhaseValue('en', plan({ scoredPhase: 51 }))).toBe('Normal 1-1 (#51)');
  });

  it('is a dash when the plan has no phase to name', () => {
    expect(scoredPhaseValue('en', plan({ scoredPhase: null }))).toBe('—');
  });
});

describe('scoredPhaseMovedFrom', () => {
  it("names the account's phase when the plan is about a different one", () => {
    expect(scoredPhaseMovedFrom(teamPlanEn, 'en', plan({ scoredPhase: 93, scoredPhaseSource: 'searched' }), 91)).toBe(
      'was Normal 3-1 (#91)',
    );
  });

  it("says nothing when the plan stays on the account's phase", () => {
    expect(scoredPhaseMovedFrom(teamPlanEn, 'en', plan({ scoredPhase: 91 }), 91)).toBeNull();
  });

  it('says nothing rather than "was —" when either phase is unknown', () => {
    expect(scoredPhaseMovedFrom(teamPlanEn, 'en', plan({ scoredPhase: null }), 91)).toBeNull();
    expect(scoredPhaseMovedFrom(teamPlanEn, 'en', plan({ scoredPhase: 93 }), null)).toBeNull();
  });
});
