/**
 * The Team plan phase picker's options and the query that finds them.
 *
 * The three ways a player names a phase — the difficulty word, the in-game coordinate, and the
 * bare number — are asserted here rather than in the control, because they are a property of the
 * LABEL and the matcher, and the control only puts the two together. The wiki's flavour names are
 * asserted absent for the same reason they are absent: they diverge from the client past world 2,
 * so a phase findable by one would be findable by a name the game does not use.
 */
import { describe, expect, it } from 'vitest';
import { searchSelectMatches, type SearchSelectOption } from '@bombfarm/ui';
import { WIKI_PHASE_LINES, PHASE_NAMES } from '@bombfarm/domain/phase-wiki';
import { STRINGS, type Lang } from '@/shared/i18n';
import {
  phaseFromOptionValue,
  phaseOptionValue,
  TEAM_PLAN_PHASE_NONE,
  teamPlanPhaseOptions,
} from '@/features/team-plan/model/phase-options';

function optionsFor(lang: Lang): SearchSelectOption[] {
  return teamPlanPhaseOptions(lang, STRINGS[lang].teamPlanPhaseNone);
}

function matches(lang: Lang, query: string): SearchSelectOption[] {
  return optionsFor(lang).filter((option) => searchSelectMatches(option, query));
}

describe('team plan phase options', () => {
  it('offers every wiki phase, plus None as a real option ahead of them', () => {
    const options = optionsFor('en');
    expect(options).toHaveLength(WIKI_PHASE_LINES.length + 1);
    expect(options[0]).toEqual({ value: TEAM_PLAN_PHASE_NONE, label: STRINGS.en.teamPlanPhaseNone });
    expect(options[1].label).toBe('Easy 1-1 (#1)');
  });

  it('round-trips a phase through the control value, and None through the empty one', () => {
    expect(phaseFromOptionValue(phaseOptionValue(151))).toBe(151);
    expect(phaseOptionValue(null)).toBe(TEAM_PLAN_PHASE_NONE);
    expect(phaseFromOptionValue(TEAM_PLAN_PHASE_NONE)).toBeNull();
  });

  it('labels a phase the way the game names it, in both languages', () => {
    const byPhase = (lang: Lang, phase: number) =>
      optionsFor(lang).find((option) => option.value === String(phase))?.label;
    expect(byPhase('en', 151)).toBe('Hard 1-1 (#151)');
    expect(byPhase('pt', 151)).toBe('Difícil 1-1 (#151)');
  });
});

describe('finding a phase', () => {
  it('by the difficulty word', () => {
    const found = matches('en', 'Normal');
    expect(found.length).toBeGreaterThan(0);
    expect(found.every((option) => option.label.startsWith('Normal '))).toBe(true);
    expect(found).toContainEqual({ value: '71', label: 'Normal 2-1 (#71)' });
  });

  it('by the full coordinate', () => {
    const found = matches('en', 'Normal 2-1');
    expect(found).toContainEqual({ value: '71', label: 'Normal 2-1 (#71)' });
    // `2-1` is a prefix of `2-10`, so the narrower query has to stay narrow.
    expect(matches('en', 'Normal 3-4')).toEqual([{ value: '94', label: 'Normal 3-4 (#94)' }]);
  });

  it('by the bare number', () => {
    expect(matches('en', '151')).toEqual([{ value: '151', label: 'Hard 1-1 (#151)' }]);
  });

  it('by a difficulty word typed without its accents', () => {
    const found = matches('pt', 'dificil 1-1');
    expect(found).toContainEqual({ value: '151', label: 'Difícil 1-1 (#151)' });
  });

  it('in any token order, and an empty query keeps everything', () => {
    expect(matches('en', '1-1 hard')).toContainEqual({ value: '151', label: 'Hard 1-1 (#151)' });
    expect(matches('en', '   ')).toHaveLength(WIKI_PHASE_LINES.length + 1);
  });

  it('never by a wiki flavour name, which diverges from the client past world 2', () => {
    const beyondWorldTwo = PHASE_NAMES[24];
    expect(beyondWorldTwo).toBeTruthy();
    expect(matches('pt', beyondWorldTwo)).toEqual([]);
  });
});
