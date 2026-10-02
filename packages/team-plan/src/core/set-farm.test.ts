import { describe, expect, it } from 'vitest';
import { SET_FARM_SETS } from '@bombfarm/domain/team-plan/set-farm';
import { buildTeamPlanInput } from './build-team-plan-input';
import { describePlanChanges, planBasisSignature } from './plan-changes';
import { applyTeamPlanControlChange, isSetFarmObjectiveUnavailable } from './plan-lifecycle';
import { planTargetPhase } from './target-phase';
import { DEFAULT_TEAM_PLAN_CONTROLS, normalizeFarmSet, type TeamPlanControls } from './team-plan-controls';
import type { TeamPlanInputs } from './team-plan-inputs';

function inputs(overrides: Partial<TeamPlanInputs> = {}): TeamPlanInputs {
  return {
    heroes: [],
    inventory: { version: 1, importedAt: 0, items: [] },
    treeDanoTotal: 0,
    treeEnergy: 0,
    treeSpeed: 0,
    treeCritChance: 0,
    treeCritDmg: 0,
    treeLuckFlatPct: 0,
    treeTeamCoinPct: 0,
    treeXpMult: 1,
    houseIdx: 0,
    houseLevel: 1,
    phase: 140,
    mitigationPct: 0,
    slots: 3,
    fieldSlots: null,
    houseCycleSecs: null,
    houseCycleSecsHouseIdx: null,
    houseCycleSecsLevel: null,
    maxPhase: 150,
    farmChosenPhase: 120,
    pvpRoomPhase: null,
    pvpSquadSlots: null,
    ...overrides,
  };
}

function controls(overrides: Partial<TeamPlanControls> = {}): TeamPlanControls {
  return { ...DEFAULT_TEAM_PLAN_CONTROLS, ...overrides };
}

const context = { heroes: [], farmChosenPhase: 120, phase: 140 };
const [firstSet, secondSet] = SET_FARM_SETS as [string, string];

describe('normalizeFarmSet', () => {
  it('keeps a set the game drops and reads anything else as no set', () => {
    expect(DEFAULT_TEAM_PLAN_CONTROLS.farmSet).toBeNull();
    for (const setId of SET_FARM_SETS) expect(normalizeFarmSet(setId)).toBe(setId);
    expect(normalizeFarmSet('not-a-set')).toBeNull();
    expect(normalizeFarmSet(3)).toBeNull();
    expect(normalizeFarmSet(null)).toBeNull();
    expect(normalizeFarmSet(undefined)).toBeNull();
  });
});

describe('the farmSet control change', () => {
  it('clears the plan under Set farm, and only remembers the pick under any other objective', () => {
    const underSetFarm = applyTeamPlanControlChange(controls({ objective: 'setFarm' }), { kind: 'farmSet', value: firstSet }, context);
    expect(underSetFarm).toEqual({ controls: controls({ objective: 'setFarm', farmSet: firstSet }), clearsPlan: true });

    const underGold = applyTeamPlanControlChange(controls({ objective: 'farm' }), { kind: 'farmSet', value: firstSet }, context);
    expect(underGold).toEqual({ controls: controls({ objective: 'farm', farmSet: firstSet }), clearsPlan: false });
  });

  it('an unchanged or unrecognised-to-unrecognised pick is a no-op', () => {
    expect(applyTeamPlanControlChange(controls({ farmSet: firstSet }), { kind: 'farmSet', value: firstSet }, context)).toBeNull();
    expect(applyTeamPlanControlChange(controls(), { kind: 'farmSet', value: 'not-a-set' }, context)).toBeNull();
  });

  it('switching to Set farm clears the plan like any other objective switch', () => {
    const result = applyTeamPlanControlChange(controls(), { kind: 'objective', value: 'setFarm' }, context);
    expect(result?.clearsPlan).toBe(true);
  });
});

describe('a Set farm run', () => {
  it('cannot be scored until a set is picked, nor without the furthest phase reached', () => {
    expect(isSetFarmObjectiveUnavailable(controls({ objective: 'setFarm' }), 150)).toBe(true);
    expect(isSetFarmObjectiveUnavailable(controls({ objective: 'setFarm', farmSet: firstSet }), 150)).toBe(false);
    expect(isSetFarmObjectiveUnavailable(controls({ objective: 'setFarm', farmSet: firstSet }), null)).toBe(true);
  });

  it('has no target phase of its own — the set decides — even with a phase picked', () => {
    const picked = controls({ objective: 'setFarm', farmSet: firstSet, targetPhase: 90, targetPhaseChosen: true });
    expect(planTargetPhase(inputs(), picked)).toBeNull();
  });

  it('asks the solver for the set and no phase', () => {
    const input = buildTeamPlanInput(inputs(), controls({ objective: 'setFarm', farmSet: secondSet, targetPhase: 90, targetPhaseChosen: true }));
    expect(input.objective).toBe('setFarm');
    expect(input.farmSet).toBe(secondSet);
    expect(input.targetPhase).toBeNull();
  });

  it('a gold run carries no set, whatever the control remembers', () => {
    const input = buildTeamPlanInput(inputs(), controls({ objective: 'farm', farmSet: secondSet }));
    expect('farmSet' in input).toBe(false);
  });
});

describe('the plan basis', () => {
  it('a set remembered under another objective leaves that plan’s signature untouched', () => {
    expect(planBasisSignature(inputs(), controls({ farmSet: firstSet }))).toBe(planBasisSignature(inputs(), controls()));
  });

  it('a different set under Set farm is a different plan, listed as one control change', () => {
    const before = { inputs: inputs(), controls: controls({ objective: 'setFarm', farmSet: firstSet }) };
    const after = { inputs: inputs(), controls: controls({ objective: 'setFarm', farmSet: secondSet }) };
    expect(planBasisSignature(before.inputs, before.controls)).not.toBe(planBasisSignature(after.inputs, after.controls));

    const ledger = describePlanChanges(before, after, null);
    expect(ledger.counted).toBe(1);
    expect(ledger.other[0]?.detail).toEqual({ field: 'control', name: 'farmSet', before: firstSet, after: secondSet });
  });

  it('leaving Set farm lists the objective and the set that no longer applies', () => {
    const before = { inputs: inputs(), controls: controls({ objective: 'setFarm', farmSet: firstSet }) };
    const after = { inputs: inputs(), controls: controls({ objective: 'farm', farmSet: firstSet }) };
    const names = describePlanChanges(before, after, null).other.map((entry) => (entry.detail.field === 'control' ? entry.detail.name : null));
    expect(names).toContain('objective');
    expect(names).toContain('farmSet');
  });
});
