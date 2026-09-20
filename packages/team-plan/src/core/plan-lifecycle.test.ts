import { describe, expect, it } from 'vitest';
import { FORJA_MAX } from '@bombfarm/domain/gear';
import {
  applyTeamPlanControlChange,
  computeTeamPlanInputSignature,
  isFarmObjectiveUnavailable,
  isTeamPlanStale,
  resolveTeamPlanTargetPhase,
} from './plan-lifecycle';
import { clampForgeFloor, clampTargetPhase, DEFAULT_TEAM_PLAN_CONTROLS } from './team-plan-controls';
import type { TeamPlanControls } from './team-plan-controls';
import type { TeamPlanInputs } from './team-plan-inputs';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';

/** The signature and target-phase functions read only `id`/`updatedAt`/`battleAllowed` off a
 *  hero — a minimal fixture stands in for the full record. */
function minimalHero(overrides: {
  id: string;
  updatedAt: number;
  battleAllowed?: boolean;
}): HeroRecord {
  return overrides as unknown as HeroRecord;
}

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
    phase: null,
    mitigationPct: 0,
    slots: 3,
    fieldSlots: null,
    houseCycleSecs: null,
    houseCycleSecsHouseIdx: null,
    houseCycleSecsLevel: null,
    maxPhase: null,
    farmChosenPhase: null,
    ...overrides,
  };
}

function controls(overrides: Partial<TeamPlanControls> = {}): TeamPlanControls {
  return { ...DEFAULT_TEAM_PLAN_CONTROLS, ...overrides };
}

describe('resolveTeamPlanTargetPhase', () => {
  it('falls back to the phase the save says the account is on', () => {
    expect(resolveTeamPlanTargetPhase(inputs({ phase: 137 }), controls())).toBe(137);
  });

  it('prefers the host-resolved farm phase once one exists', () => {
    expect(
      resolveTeamPlanTargetPhase(inputs({ phase: 137, farmChosenPhase: 58 }), controls()),
    ).toBe(58);
  });

  it('a pick on this screen wins over both, and None is a pick like any other', () => {
    expect(
      resolveTeamPlanTargetPhase(
        inputs({ phase: 137, farmChosenPhase: 58 }),
        controls({ targetPhase: 200, targetPhaseChosen: true }),
      ),
    ).toBe(200);
    expect(
      resolveTeamPlanTargetPhase(
        inputs({ phase: 137, farmChosenPhase: 58 }),
        controls({ targetPhase: null, targetPhaseChosen: true }),
      ),
    ).toBeNull();
  });

  it('is null when neither a choice nor either fallback exists', () => {
    expect(resolveTeamPlanTargetPhase(inputs(), controls())).toBeNull();
  });
});

describe('isFarmObjectiveUnavailable', () => {
  it('gold scoring needs a furthest phase only while the picker sits on None', () => {
    expect(isFarmObjectiveUnavailable(null, null)).toBe(true);
    expect(isFarmObjectiveUnavailable(null, 200)).toBe(false);
    expect(isFarmObjectiveUnavailable(600, null)).toBe(false);
  });
});

describe('computeTeamPlanInputSignature', () => {
  const heroes = [minimalHero({ id: 'a', updatedAt: 1, battleAllowed: true })];
  const base = inputs({ heroes, treeDanoTotal: 5, houseIdx: 1, houseCycleSecs: 300 });
  const baseControls = controls({ scopeByHeroId: { a: 'optimize' }, forgeFloor: 10 });

  it('is equal for equal values', () => {
    expect(computeTeamPlanInputSignature(base, baseControls)).toBe(
      computeTeamPlanInputSignature(base, baseControls),
    );
  });

  it.each<[string, TeamPlanInputs]>([
    ['roster id', { ...base, heroes: [minimalHero({ id: 'b', updatedAt: 1, battleAllowed: true })] }],
    ['hero level', { ...base, heroes: [{ ...minimalHero({ id: 'a', updatedAt: 1, battleAllowed: true }), level: 2 }] }],
    [
      'inventory item ids',
      {
        ...base,
        inventory: {
          version: 1,
          importedAt: 0,
          items: [
            {
              id: 'i1',
              defId: 'x',
              rarityIdx: 0,
              level: 1,
              upgrade: 0,
              slot: 'calca',
              equipped: false,
              equippedBy: null,
              defResolved: true,
              marketBlocked: false,
            },
          ],
        },
      },
    ],
    ['house index', { ...base, houseIdx: 2 }],
    ['tree dano total', { ...base, treeDanoTotal: 6 }],
    ['house cycle seconds', { ...base, houseCycleSecs: 400 }],
  ])('differs when %s changes', (_label, patched) => {
    expect(computeTeamPlanInputSignature(base, baseControls)).not.toBe(
      computeTeamPlanInputSignature(patched, baseControls),
    );
  });

  // The game flips these on every field rotation, ticks a rune's seconds down on every read and
  // re-derives power from the rest; a storage timestamp and an import stamp say when a record
  // was written, not what it holds. None of them is anything the solver reads.
  it.each<[string, TeamPlanInputs]>([
    ['hero updatedAt', { ...base, heroes: [minimalHero({ id: 'a', updatedAt: 2, battleAllowed: true })] }],
    ['hero deployed', { ...base, heroes: [{ ...minimalHero({ id: 'a', updatedAt: 1, battleAllowed: true }), deployed: true }] }],
    ['hero power', { ...base, heroes: [{ ...minimalHero({ id: 'a', updatedAt: 1, battleAllowed: true }), power: 999 }] }],
    [
      'hero battleAllowed under an explicit scope',
      { ...base, heroes: [minimalHero({ id: 'a', updatedAt: 1, battleAllowed: false })] },
    ],
    ['inventory importedAt', { ...base, inventory: { version: 1, importedAt: 9, items: [] } }],
  ])('is unmoved when %s changes', (_label, patched) => {
    expect(computeTeamPlanInputSignature(patched, baseControls)).toBe(computeTeamPlanInputSignature(base, baseControls));
  });

  it("differs when battleAllowed flips a hero's DEFAULT scope — the one way it reaches the plan", () => {
    const unscoped = controls({ ...baseControls, scopeByHeroId: {} });
    expect(computeTeamPlanInputSignature(base, unscoped)).not.toBe(
      computeTeamPlanInputSignature({ ...base, heroes: [minimalHero({ id: 'a', updatedAt: 1, battleAllowed: false })] }, unscoped),
    );
  });

  it('differs when the forge floor changes', () => {
    expect(computeTeamPlanInputSignature(base, baseControls)).not.toBe(
      computeTeamPlanInputSignature(base, controls({ ...baseControls, forgeFloor: 11 })),
    );
  });

  it('differs when slots (house slots) changes', () => {
    expect(computeTeamPlanInputSignature(base, baseControls)).not.toBe(
      computeTeamPlanInputSignature({ ...base, slots: 4 }, baseControls),
    );
  });

  it('differs when scope map changes', () => {
    expect(computeTeamPlanInputSignature(base, baseControls)).not.toBe(
      computeTeamPlanInputSignature(base, controls({ ...baseControls, scopeByHeroId: { a: 'donate' } })),
    );
  });

  it('differs when the objective changes', () => {
    expect(computeTeamPlanInputSignature(base, baseControls)).not.toBe(
      computeTeamPlanInputSignature(base, controls({ ...baseControls, objective: 'dps' })),
    );
  });

  it('differs when the resolved target phase changes', () => {
    expect(computeTeamPlanInputSignature(base, baseControls)).not.toBe(
      computeTeamPlanInputSignature(
        base,
        controls({ ...baseControls, targetPhase: 300, targetPhaseChosen: true }),
      ),
    );
  });

  it('differs when allowedChanges changes', () => {
    expect(computeTeamPlanInputSignature(base, baseControls)).not.toBe(
      computeTeamPlanInputSignature(base, controls({ ...baseControls, allowedChanges: 'gear' })),
    );
  });

  it('differs when ignoreFieldCrowding changes', () => {
    expect(computeTeamPlanInputSignature(base, baseControls)).not.toBe(
      computeTeamPlanInputSignature(base, controls({ ...baseControls, ignoreFieldCrowding: true })),
    );
  });

  it('differs when aurasAtCap changes', () => {
    expect(computeTeamPlanInputSignature(base, baseControls)).not.toBe(
      computeTeamPlanInputSignature(base, controls({ ...baseControls, aurasAtCap: ['grito_guerra'] })),
    );
  });
});

describe('isTeamPlanStale', () => {
  it('is false without a stored signature', () => {
    expect(isTeamPlanStale(null, 'live')).toBe(false);
  });

  it('is false when the stored signature matches', () => {
    expect(isTeamPlanStale('sig', 'sig')).toBe(false);
  });

  it('is true when the stored signature differs from the live one', () => {
    expect(isTeamPlanStale('sig', 'other')).toBe(true);
  });
});

describe('clampForgeFloor', () => {
  it('clamps into 0…FORJA_MAX', () => {
    expect(clampForgeFloor(99)).toBe(FORJA_MAX);
    expect(clampForgeFloor(-1)).toBe(0);
  });

  it('defaults a non-finite value to 10', () => {
    expect(clampForgeFloor(Number.NaN)).toBe(10);
    expect(clampForgeFloor(Number.POSITIVE_INFINITY)).toBe(10);
  });
});

describe('clampTargetPhase', () => {
  it('clamps to the wiki table', () => {
    expect(clampTargetPhase(9999)).toBe(600);
    expect(clampTargetPhase(0)).toBe(1);
  });

  it('is null for null, undefined, or a non-finite value', () => {
    expect(clampTargetPhase(null)).toBeNull();
    expect(clampTargetPhase(undefined)).toBeNull();
    expect(clampTargetPhase(Number.NaN)).toBeNull();
  });
});

describe('applyTeamPlanControlChange', () => {
  const heroes = [
    { id: 'a', battleAllowed: true },
    { id: 'b', battleAllowed: false },
  ];
  const context = { heroes, farmChosenPhase: null, phase: null };

  it('scope: a no-op change returns null', () => {
    const control = controls({ scopeByHeroId: { a: 'optimize', b: 'donate' } });
    expect(applyTeamPlanControlChange(control, { kind: 'scope', heroId: 'a', scope: 'optimize' }, context)).toBeNull();
  });

  it('scope: a partial map with an unchanged hero writes the full map and does not clear', () => {
    const control = controls({ scopeByHeroId: { a: 'optimize' } });
    const result = applyTeamPlanControlChange(
      control,
      { kind: 'scope', heroId: 'a', scope: 'optimize' },
      context,
    );
    expect(result).toEqual({
      controls: { ...control, scopeByHeroId: { a: 'optimize', b: 'donate' } },
      clearsPlan: false,
    });
  });

  it('scope: a move that changes the resolved value clears the plan', () => {
    const control = controls({ scopeByHeroId: { a: 'optimize', b: 'donate' } });
    const result = applyTeamPlanControlChange(
      control,
      { kind: 'scope', heroId: 'a', scope: 'donate' },
      context,
    );
    expect(result).toEqual({
      controls: { ...control, scopeByHeroId: { a: 'donate', b: 'donate' } },
      clearsPlan: true,
    });
  });

  it('forgeFloor: an unchanged clamped value returns null', () => {
    const control = controls({ forgeFloor: 10 });
    expect(applyTeamPlanControlChange(control, { kind: 'forgeFloor', value: 10 }, context)).toBeNull();
  });

  it('forgeFloor: a changed value never clears the plan', () => {
    const control = controls({ forgeFloor: 10 });
    const result = applyTeamPlanControlChange(control, { kind: 'forgeFloor', value: 12 }, context);
    expect(result).toEqual({ controls: { ...control, forgeFloor: 12 }, clearsPlan: false });
  });

  it('objective: an unchanged value returns null, a changed value clears', () => {
    const control = controls({ objective: 'farm' });
    expect(applyTeamPlanControlChange(control, { kind: 'objective', value: 'farm' }, context)).toBeNull();
    const result = applyTeamPlanControlChange(control, { kind: 'objective', value: 'dps' }, context);
    expect(result).toEqual({ controls: { ...control, objective: 'dps' }, clearsPlan: true });
  });

  it('allowedChanges: an unchanged value returns null, a changed value clears', () => {
    const control = controls({ allowedChanges: 'both' });
    expect(
      applyTeamPlanControlChange(control, { kind: 'allowedChanges', value: 'both' }, context),
    ).toBeNull();
    const result = applyTeamPlanControlChange(
      control,
      { kind: 'allowedChanges', value: 'points' },
      context,
    );
    expect(result).toEqual({ controls: { ...control, allowedChanges: 'points' }, clearsPlan: true });
  });

  it('ignoreFieldCrowding: an unchanged value returns null, a changed value clears', () => {
    const control = controls({ ignoreFieldCrowding: false });
    expect(
      applyTeamPlanControlChange(control, { kind: 'ignoreFieldCrowding', value: false }, context),
    ).toBeNull();
    const result = applyTeamPlanControlChange(
      control,
      { kind: 'ignoreFieldCrowding', value: true },
      context,
    );
    expect(result).toEqual({
      controls: { ...control, ignoreFieldCrowding: true },
      clearsPlan: true,
    });
  });

  it('auraAtCap: an unchanged aura returns null, a flipped one clears, and the list keeps the domain order', () => {
    const control = controls({ aurasAtCap: ['passagem_bastao'] });
    expect(
      applyTeamPlanControlChange(control, { kind: 'auraAtCap', auraId: 'passagem_bastao', value: true }, context),
    ).toBeNull();
    expect(applyTeamPlanControlChange(control, { kind: 'auraAtCap', auraId: 'brecha', value: false }, context)).toBeNull();
    const lit = applyTeamPlanControlChange(control, { kind: 'auraAtCap', auraId: 'grito_guerra', value: true }, context);
    expect(lit).toEqual({ controls: { ...control, aurasAtCap: ['grito_guerra', 'passagem_bastao'] }, clearsPlan: true });
    const cleared = applyTeamPlanControlChange(control, { kind: 'auraAtCap', auraId: 'passagem_bastao', value: false }, context);
    expect(cleared?.controls.aurasAtCap).toBe(DEFAULT_TEAM_PLAN_CONTROLS.aurasAtCap);
    expect(cleared?.clearsPlan).toBe(true);
  });

  it('targetPhase: the first pick of the phase the derived default already sits on flips targetPhaseChosen without clearing', () => {
    const control = controls({ targetPhase: null, targetPhaseChosen: false });
    const withFarmChosen = { heroes, farmChosenPhase: 58, phase: 137 };
    const result = applyTeamPlanControlChange(
      control,
      { kind: 'targetPhase', value: 58 },
      withFarmChosen,
    );
    expect(result).toEqual({
      controls: { ...control, targetPhase: 58, targetPhaseChosen: true },
      clearsPlan: false,
    });
  });

  it('targetPhase: a pick that moves the resolved value clears', () => {
    const control = controls({ targetPhase: null, targetPhaseChosen: false });
    const withFarmChosen = { heroes, farmChosenPhase: 58, phase: 137 };
    const result = applyTeamPlanControlChange(
      control,
      { kind: 'targetPhase', value: 200 },
      withFarmChosen,
    );
    expect(result).toEqual({
      controls: { ...control, targetPhase: 200, targetPhaseChosen: true },
      clearsPlan: true,
    });
  });

  it('targetPhase: an unchanged already-chosen value returns null', () => {
    const control = controls({ targetPhase: 200, targetPhaseChosen: true });
    expect(
      applyTeamPlanControlChange(control, { kind: 'targetPhase', value: 200 }, context),
    ).toBeNull();
  });
});
