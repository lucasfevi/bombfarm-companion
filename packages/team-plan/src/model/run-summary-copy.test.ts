import { describe, expect, it } from 'vitest';
import { SET_FARM_SLOW_CLEAR_SECS, type TeamPlan } from '@bombfarm/domain/team-plan/types';
import { teamPlanEn, teamPlanPtBR } from '../copy';
import {
  formatElapsedSeconds,
  scoredPhaseClearTime,
  scoredPhaseHint,
  scoredPhaseMovedFrom,
  scoredPhaseValue,
  seedStartLabel,
  slowClearWarning,
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

describe('scoredPhaseHint under a set farm', () => {
  it('names the band search for a phase the solver picked, with no clear-time ceiling', () => {
    const hint = scoredPhaseHint(teamPlanEn, plan({ scoredPhase: 75, scoredPhaseSource: 'searched' }), 'setFarm');
    expect(hint).toBe(teamPlanEn.teamPlanScoredPhaseSetSearched);
    expect(hint).toContain('this set drops');
    expect(hint).not.toMatch(/or less/);
  });

  it('says the squad cannot clear the band, whether the plan names a phase or not', () => {
    const unfarmable = teamPlanEn.teamPlanScoredPhaseSetUnfarmable;
    expect(scoredPhaseHint(teamPlanEn, plan({ scoredPhase: 75, scoredPhaseSource: 'searched', scoredPhaseInfeasible: true }), 'setFarm')).toBe(unfarmable);
    expect(scoredPhaseHint(teamPlanEn, plan({ scoredPhase: null, scoredPhaseSource: 'searched' }), 'setFarm')).toBe(unfarmable);
  });
});

describe('the clear time of a set farm plan, and the slow-clear warning', () => {
  const setPlan = (scoredPhaseClearSecs: number | null | undefined, extra: Partial<TeamPlan> = {}) =>
    plan({ scoredPhase: 51, scoredPhaseSource: 'searched', scoredPhaseClearSecs, ...extra });

  it('warns at the threshold and above, never below it', () => {
    expect(slowClearWarning(teamPlanEn, 'en', setPlan(SET_FARM_SLOW_CLEAR_SECS), 'setFarm')).toBe(
      `Clears take ${SET_FARM_SLOW_CLEAR_SECS} s here — this set’s phases are hard for your squad, and the estimate is least certain at slow clears.`,
    );
    expect(slowClearWarning(teamPlanEn, 'en', setPlan(179.35), 'setFarm')).toContain('Clears take 179 s here');
    expect(slowClearWarning(teamPlanEn, 'en', setPlan(SET_FARM_SLOW_CLEAR_SECS - 0.1), 'setFarm')).toBeNull();
    expect(slowClearWarning(teamPlanEn, 'en', setPlan(16.66), 'setFarm')).toBeNull();
  });

  it('warns in Portuguese with the same figure', () => {
    expect(slowClearWarning(teamPlanPtBR, 'pt', setPlan(82.12), 'setFarm')).toBe(
      'As limpezas levam 82 s aqui — as fases deste conjunto são difíceis para seu esquadrão, e a estimativa é menos certa em limpezas lentas.',
    );
  });

  it('prints the clear time below the threshold, and leaves it to the warning at or above', () => {
    expect(scoredPhaseClearTime(teamPlanEn, 'en', setPlan(16.66), 'setFarm')).toBe('About 17 s per clear.');
    expect(scoredPhaseClearTime(teamPlanEn, 'en', setPlan(4.26), 'setFarm')).toBe('About 4.3 s per clear.');
    expect(scoredPhaseClearTime(teamPlanPtBR, 'pt', setPlan(4.26), 'setFarm')).toBe('Cerca de 4,3 s por limpeza.');
    expect(scoredPhaseClearTime(teamPlanEn, 'en', setPlan(SET_FARM_SLOW_CLEAR_SECS), 'setFarm')).toBeNull();
  });

  it('says nothing about clear time outside a set farm, on an unclearable phase, or without a figure', () => {
    for (const objective of ['farm', 'dps', 'gateClear', 'pvp'] as const) {
      expect(slowClearWarning(teamPlanEn, 'en', setPlan(500), objective)).toBeNull();
      expect(scoredPhaseClearTime(teamPlanEn, 'en', setPlan(10), objective)).toBeNull();
    }
    expect(slowClearWarning(teamPlanEn, 'en', setPlan(500, { scoredPhaseInfeasible: true }), 'setFarm')).toBeNull();
    for (const missing of [null, undefined]) {
      expect(slowClearWarning(teamPlanEn, 'en', setPlan(missing), 'setFarm')).toBeNull();
      expect(scoredPhaseClearTime(teamPlanEn, 'en', setPlan(missing), 'setFarm')).toBeNull();
    }
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
