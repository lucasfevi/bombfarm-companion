/**
 * The package screen is drawn by two hosts that do not share every surface: the web's save-export
 * flow, its "top bar" import affordance, its "Planner" and "Account tab" pages, its "Optimizer
 * page" self-reference. A sentence naming one of those is true on the web and false — or
 * meaningless — on the desktop, so it belongs in `TeamPlanHostCopy`, never in this dictionary.
 */
import { describe, expect, it } from 'vitest';
import { teamPlanEn, teamPlanPtBR } from './index';

const HOST_WORD_PATTERNS = [
  /import/i,
  /planner/i,
  /account tab/i,
  /aba conta/i,
  /save file/i,
  /\bo save\b/i,
  /\b(your|this|the) save\b/i,
  /re-?export/i,
  /top bar/i,
  /barra superior/i,
  /optimizer page/i,
  /página otimizador/i,
];

function offendingPatterns(value: string): RegExp[] {
  return HOST_WORD_PATTERNS.filter((pattern) => pattern.test(value));
}

describe('the package dictionary names no host word, in either language', () => {
  it('no key in teamPlanEn matches a host-word pattern', () => {
    const offenders: string[] = [];
    for (const [key, value] of Object.entries(teamPlanEn)) {
      const hits = offendingPatterns(value);
      if (hits.length > 0) offenders.push(`en.${key}: ${hits.join(', ')}`);
    }
    expect(offenders).toEqual([]);
  });

  it('no key in teamPlanPtBR matches a host-word pattern', () => {
    const offenders: string[] = [];
    for (const [key, value] of Object.entries(teamPlanPtBR)) {
      const hits = offendingPatterns(value);
      if (hits.length > 0) offenders.push(`pt.${key}: ${hits.join(', ')}`);
    }
    expect(offenders).toEqual([]);
  });
});

/**
 * Red-state demonstration: the thirteen web host values, verbatim, as they read today — proves
 * the scan actually catches real host copy rather than passing vacuously. `teamPlanBlockedBody`
 * is named explicitly because it is the one the orchestrator decided belongs in the contract;
 * `teamPlanBudgetExhausted` (a genuine package key, "stopped early **to save** time") is asserted
 * as a non-hit, which is the word-bounded `\bo save\b` / `\b(your|this|the) save\b` pair doing
 * their job — an unbounded `/save/i` would have false-positived on it.
 */
const WEB_HOST_VALUES_EN = {
  teamPlanEmptyNoRosterTitle: 'Import heroes first',
  teamPlanEmptyNoRosterBody:
    'Export your save in Bomb Farm, then use Import in the top bar to load your roster and item inventory.',
  teamPlanEmptyNoInventoryTitle: 'No item inventory yet',
  teamPlanEmptyNoInventoryBody:
    'Re-import your save so the planner can read every item you own, not only what is equipped.',
  teamPlanEmptyAllLeaveAloneTitle: 'Nothing in scope',
  teamPlanEmptyAllLeaveAloneBody: 'Set at least one hero to Optimize before running a plan.',
  teamPlanBlockedBody: 'Re-export your save so these heroes include a birth roll: {heroes}.',
  teamPlanObjectiveFarmNeedsMaxPhase:
    'Letting the search pick its own phase needs the furthest phase your account has reached, which this save did not carry. Pick a phase above, re-import the save, or score for damage.',
  teamPlanAuraDisclosureDps:
    'Team auras here come from the scoped roster, exclude the hero being scored, and are weighted by each carrier’s duty. The Account tab’s manual Team buffs are ignored on this page but still drive the Planner’s own DPS.',
  teamPlanAuraDisclosureFarm:
    'Team auras here come from the scoped roster, exclude the hero being scored, and are weighted by each carrier’s duty. The Account tab’s manual Team buffs are ignored on this page, though the Planner page still reads them.',
  teamPlanPlannerDivergenceDps:
    'Planner DPS can differ from this page when roster-derived auras replace manual Team buffs, or when {ability} is modelled here only.',
  teamPlanPlannerDivergenceFarm:
    'The Planner’s own figures can differ from this page when roster-derived auras replace manual Team buffs, or when {ability} is modelled here only.',
  teamPlanFarmAdvisorPointer: 'For gear moves and forge work as well, use the Optimizer page.',
};

describe('red state: the thirteen web host values are caught', () => {
  const fixture = { ...teamPlanEn, ...WEB_HOST_VALUES_EN };

  it('reports at least ten of the thirteen host keys as hits, including teamPlanBlockedBody', () => {
    const hitKeys = Object.keys(WEB_HOST_VALUES_EN).filter(
      (key) => offendingPatterns(fixture[key as keyof typeof fixture]).length > 0,
    );
    expect(hitKeys.length).toBeGreaterThanOrEqual(10);
    expect(hitKeys).toContain('teamPlanBlockedBody');
  });

  it('does not flag teamPlanBudgetExhausted — "stopped early to save time" is not a host sentence', () => {
    expect(offendingPatterns(fixture.teamPlanBudgetExhausted)).toEqual([]);
  });
});
