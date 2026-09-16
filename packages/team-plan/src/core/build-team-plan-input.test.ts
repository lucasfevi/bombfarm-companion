import { describe, expect, it } from 'vitest';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import { buildTeamPlanInput } from './build-team-plan-input';
import { DEFAULT_TEAM_PLAN_CONTROLS } from './team-plan-controls';
import type { TeamPlanInputs } from './team-plan-inputs';
import type { TeamPlanControls } from './team-plan-controls';

const sheet = {
  attack: 10,
  energy: 10,
  speed: 10,
  critChance: 0,
  critDmg: 10,
  penetration: 0,
  cdr: 0,
  luck: 0,
};

function hero(id: string, battleAllowed?: boolean): HeroRecord {
  return {
    id,
    name: id,
    updatedAt: 1,
    rarity: 'Raro',
    level: 20,
    stars: 0,
    naked: sheet,
    loadout: {
      arma: null,
      elmo: null,
      anel: null,
      amuleto: null,
      peito: null,
      calca: null,
      luva: null,
      bota: null,
    },
    altLoadout: null,
    gearedOverride: sheet,
    abilities: {},
    pts: sheet,
    sourceId: `src-${id}`,
    ...(battleAllowed !== undefined ? { battleAllowed } : {}),
  };
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

describe('buildTeamPlanInput scope defaults', () => {
  // Regression: the scope board defaulted missing keys via battleAllowed (Donate), but the
  // solver input used `?? 'optimize'` — Donate-looking heroes were still scored.
  it('maps missing scope for battle-disabled heroes to donate, not optimize', () => {
    const input = buildTeamPlanInput(
      inputs({ heroes: [hero('opt', true), hero('bench', false)] }),
      controls({ scopeByHeroId: {} }),
    );
    expect(input.scopeByHeroId).toEqual({ 'src-opt': 'optimize', 'src-bench': 'donate' });
  });

  it('keeps an explicit store choice over the battleAllowed default', () => {
    const input = buildTeamPlanInput(
      inputs({ heroes: [hero('bench', false)] }),
      controls({ scopeByHeroId: { bench: 'optimize' } }),
    );
    expect(input.scopeByHeroId).toEqual({ 'src-bench': 'optimize' });
  });

  it.each(['both', 'points', 'gear'] as const)(
    'carries allowedChanges %s through to the solver input',
    (allowedChanges) => {
      const input = buildTeamPlanInput(
        inputs({ heroes: [hero('opt', true)] }),
        controls({ allowedChanges }),
      );
      expect(input.allowedChanges).toBe(allowedChanges);
    },
  );

  // The forge floor is NOT suppressed here — the domain drops it to 0 itself when gear is off the
  // table. Two places zeroing it is two places for one of them to stop.
  it('leaves the forge floor alone when the plan may not move gear', () => {
    const input = buildTeamPlanInput(
      inputs({ heroes: [hero('opt', true)] }),
      controls({ allowedChanges: 'points', forgeFloor: 10 }),
    );
    expect(input.forgeFloor).toBe(10);
  });

  it('falls fieldSlots back to slots when absent', () => {
    const input = buildTeamPlanInput(inputs({ slots: 3, fieldSlots: null }), controls());
    expect(input.account.fieldSlots).toBe(3);
  });

  it('composes treeSheet from the six tree fields', () => {
    const input = buildTeamPlanInput(
      inputs({
        treeDanoTotal: 1,
        treeEnergy: 2,
        treeSpeed: 3,
        treeCritChance: 4,
        treeCritDmg: 5,
        treeLuckFlatPct: 6,
      }),
      controls(),
    );
    expect(input.account.treeSheet).toEqual({
      danoStatic: 1,
      energyPct: 2,
      speedPct: 3,
      critChancePct: 4,
      critDmgPct: 5,
      luckFlatPct: 6,
    });
  });

  it('pins the full output for a fixture record', () => {
    const record = inputs({
      heroes: [hero('opt', true), hero('bench', false)],
      inventory: { version: 1, importedAt: 5, items: [] },
      treeDanoTotal: 10,
      treeEnergy: 20,
      treeSpeed: 30,
      treeCritChance: 40,
      treeCritDmg: 50,
      treeLuckFlatPct: 60,
      treeTeamCoinPct: 70,
      treeXpMult: 1.5,
      houseIdx: 2,
      houseLevel: 5,
      phase: 100,
      mitigationPct: 12,
      slots: 3,
      fieldSlots: 6,
      houseCycleSecs: 300,
      houseCycleSecsHouseIdx: 2,
      houseCycleSecsLevel: 5,
      maxPhase: 200,
      farmChosenPhase: null,
    });
    const control = controls({ scopeByHeroId: { opt: 'optimize' }, forgeFloor: 7 });

    const result = buildTeamPlanInput(record, control);

    expect(result).toEqual({
      heroes: [
        {
          heroId: 'src-opt',
          name: 'opt',
          level: 20,
          stars: 0,
          rarity: 'Raro',
          abilities: {},
          pts: sheet,
          loadout: {
            arma: null,
            elmo: null,
            anel: null,
            amuleto: null,
            peito: null,
            calca: null,
            luva: null,
            bota: null,
          },
          battleAllowed: true,
        },
        {
          heroId: 'src-bench',
          name: 'bench',
          level: 20,
          stars: 0,
          rarity: 'Raro',
          abilities: {},
          pts: sheet,
          loadout: {
            arma: null,
            elmo: null,
            anel: null,
            amuleto: null,
            peito: null,
            calca: null,
            luva: null,
            bota: null,
          },
          battleAllowed: false,
        },
      ],
      inventory: [],
      account: {
        treeSheet: {
          danoStatic: 10,
          energyPct: 20,
          speedPct: 30,
          critChancePct: 40,
          critDmgPct: 50,
          luckFlatPct: 60,
        },
        houseIdx: 2,
        houseLevel: 5,
        phase: 100,
        mitigationPct: 12,
        slots: 3,
        fieldSlots: 6,
        cycleSecs: 300,
        cycleSecsHouseIdx: 2,
        cycleSecsLevel: 5,
        teamCoinPct: 70,
        xpMult: 1.5,
        maxPhase: 200,
      },
      scopeByHeroId: { 'src-opt': 'optimize', 'src-bench': 'donate' },
      forgeFloor: 7,
      objective: 'farm',
      allowedChanges: 'both',
      ignoreFieldCrowding: false,
      aurasAtCap: [],
      targetPhase: 100,
    });
  });

  it('hands aurasAtCap to the domain by reference, as it stands on the controls', () => {
    const atCap = ['grito_guerra', 'passagem_bastao'] as const;
    expect(buildTeamPlanInput(inputs(), controls({ aurasAtCap: atCap })).aurasAtCap).toBe(atCap);
    expect(buildTeamPlanInput(inputs(), controls()).aurasAtCap).toEqual([]);
  });
});
