import { describe, expect, it } from 'vitest';
import { setName } from '@bombfarm/domain/game-labels';
import { SET_FARM_SETS, setFarmBand } from '@bombfarm/domain/team-plan/set-farm';
import { teamPlanEn, teamPlanPtBR } from '../copy';
import { formatObjectiveFigure, objectiveFigurePrecision } from './objective-figure';
import { teamPlanFarmSetOptions } from './set-farm-options';

describe('teamPlanFarmSetOptions', () => {
  it('lists every set the game drops, in drop order, each named with its phase band', () => {
    const options = teamPlanFarmSetOptions(teamPlanEn, 'en', null);
    expect(options).toHaveLength(30);
    expect(options.map((option) => option.value)).toEqual([...SET_FARM_SETS]);
    for (const option of options) {
      const band = setFarmBand(option.value);
      expect(band, option.value).not.toBeNull();
      expect(option.label).toBe(`${setName(option.value, 'en')} · phases ${band?.minPhase}–${band?.maxPhase}`);
      expect(option.unreached).toBe(false);
    }
  });

  it('marks the sets whose band starts past the furthest phase reached, and only those', () => {
    const maxPhase = 150;
    const options = teamPlanFarmSetOptions(teamPlanEn, 'en', maxPhase);
    for (const option of options) {
      const band = setFarmBand(option.value);
      expect(option.unreached, option.value).toBe((band?.minPhase ?? 0) > maxPhase);
    }
    expect(options.some((option) => option.unreached)).toBe(true);
    expect(options.some((option) => !option.unreached)).toBe(true);
    const locked = options.find((option) => option.unreached);
    expect(locked?.label).toMatch(/not reached yet$/);
  });

  it('speaks the language it is asked for', () => {
    const [first] = teamPlanFarmSetOptions(teamPlanPtBR, 'pt', null);
    expect(first?.label).toContain(setName(SET_FARM_SETS[0] ?? '', 'pt'));
    expect(first?.label).toContain('fases');
  });
});

describe('formatObjectiveFigure', () => {
  it('prints set chests per hour to two decimals, never abbreviated to nothing', () => {
    expect(objectiveFigurePrecision('setFarm')).toBe('fine');
    expect(formatObjectiveFigure(0.4237, 'en', 'fine')).toEqual({ shown: '0.42', exact: '0.424' });
    expect(formatObjectiveFigure(0.05, 'en', 'fine', { signed: true }).shown).toBe('+0.05');
    expect(formatObjectiveFigure(-1.5, 'pt', 'fine').shown).toBe('-1,50');
  });

  it('keeps gold and damage abbreviated, with the whole number behind the tooltip', () => {
    for (const objective of ['farm', 'gateClear', 'pvp', 'dps'] as const) {
      expect(objectiveFigurePrecision(objective)).toBe('compact');
    }
    expect(formatObjectiveFigure(90_200, 'en', 'compact', { signed: true })).toEqual({ shown: '+90.2k', exact: '+90,200' });
  });
});
