import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TEAM_PLAN_CONTROLS,
  DEFAULT_TEAM_PLAN_OBJECTIVE,
  TEAM_PLAN_OBJECTIVES,
  TEAM_PLAN_OBJECTIVES_WITHOUT_PVP,
  isTeamPlanObjective,
  normalizeGatePhase,
} from './team-plan-controls';

describe('the objective control', () => {
  it('offers gold, a gate clear and the duel, in that order, and the default is gold', () => {
    expect([...TEAM_PLAN_OBJECTIVES]).toEqual(['farm', 'gateClear', 'pvp']);
    expect([...TEAM_PLAN_OBJECTIVES_WITHOUT_PVP]).toEqual(['farm', 'gateClear']);
    expect(DEFAULT_TEAM_PLAN_OBJECTIVE).toBe('farm');
    expect(DEFAULT_TEAM_PLAN_CONTROLS.gatePhase).toBeNull();
  });

  it('the rotation objective the control no longer offers reads back as unrecognised', () => {
    for (const objective of TEAM_PLAN_OBJECTIVES) expect(isTeamPlanObjective(objective)).toBe(true);
    expect(isTeamPlanObjective('dps')).toBe(false);
    expect(isTeamPlanObjective('gold')).toBe(false);
    expect(isTeamPlanObjective(undefined)).toBe(false);
  });
});

describe('normalizeGatePhase', () => {
  it('keeps a gate and rounds to it; anything that is not a gate reads as "the next gate"', () => {
    expect(normalizeGatePhase(100)).toBe(100);
    expect(normalizeGatePhase(100.2)).toBe(100);
    expect(normalizeGatePhase(101)).toBeNull();
    expect(normalizeGatePhase('100')).toBeNull();
    expect(normalizeGatePhase(Number.NaN)).toBeNull();
    expect(normalizeGatePhase(null)).toBeNull();
  });
});
