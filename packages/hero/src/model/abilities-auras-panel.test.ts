import { describe, expect, it } from 'vitest';
import { wikiPhaseLine } from '@bombfarm/domain/phase-wiki';
import { TEAM_BUFF_ABILITY_IDS, TEAM_BUFF_CAP, noTeamAuraSwitches, zeroTeamBuffs } from '@bombfarm/domain/team-buffs';
import { drainNoteFor, ownAbilityRowsFor, teamAuraRowsFor } from './abilities-auras-panel';

const NO_DELTAS = zeroTeamBuffs();

function phaseWhere(gate: boolean): number {
  for (let phase = 1; phase <= 600; phase++) {
    const line = wikiPhaseLine(phase);
    if (line && line.gate === gate) return phase;
  }
  throw new Error(`no ${gate ? 'gate' : 'non-gate'} phase in the wiki bundle`);
}

describe('teamAuraRowsFor', () => {
  it('lists every team aura the game has, for a hero carrying none', () => {
    const rows = teamAuraRowsFor({ abilities: {} }, noTeamAuraSwitches(), NO_DELTAS);
    expect(rows.map((row) => row.buffId)).toEqual([...TEAM_BUFF_ABILITY_IDS]);
    for (const row of rows) {
      expect(row.carried).toBe(false);
      expect(row.on).toBe(false);
      expect(row.pricedAt).toBeNull();
    }
  });

  it('a carried aura is on at the hero’s rank and marked as the hero’s own', () => {
    const rows = teamAuraRowsFor({ abilities: { grito_guerra: 12 } }, noTeamAuraSwitches(), NO_DELTAS);
    const grito = rows.find((row) => row.buffId === 'grito_guerra');
    expect(grito).toMatchObject({ carried: true, on: true, pricedAt: { kind: 'attackPct', value: 12 } });
  });

  it('a switched-on aura the hero does not carry is priced at its cap', () => {
    const switches = { ...noTeamAuraSwitches(), folego_mineiro: true };
    const rows = teamAuraRowsFor({ abilities: {} }, switches, NO_DELTAS);
    const folego = rows.find((row) => row.buffId === 'folego_mineiro');
    expect(folego).toMatchObject({
      carried: false,
      on: true,
      pricedAt: { kind: 'drainPct', value: TEAM_BUFF_CAP.folego_mineiro },
      cap: { kind: 'drainPct', value: TEAM_BUFF_CAP.folego_mineiro },
    });
  });

  it('carries each aura’s delta through, and reads zero for one the deltas omit', () => {
    const rows = teamAuraRowsFor({ abilities: {} }, noTeamAuraSwitches(), { ...NO_DELTAS, grito_guerra: 12.7 });
    expect(rows.find((row) => row.buffId === 'grito_guerra')?.deltaPct).toBe(12.7);
    expect(rows.find((row) => row.buffId === 'pressagio_mortal')?.deltaPct).toBe(0);
  });
});

describe('ownAbilityRowsFor', () => {
  const abilities = {
    bateria_extra: 12,
    explosao_ampla: 10,
    detonacao_dupla: 12,
    contra_relogio: 8,
    passagem_bastao: 10,
    matilha: 6,
    caca_hero: 3,
    misericordia: 0,
    grito_guerra: 5,
  };

  it('lists every ability the hero has a rank in, its team auras and unspent slots excepted', () => {
    const rows = ownAbilityRowsFor({ abilities }, phaseWhere(false));
    expect(rows.map((row) => row.abilityId)).toEqual([
      'bateria_extra',
      'explosao_ampla',
      'detonacao_dupla',
      'contra_relogio',
      'passagem_bastao',
      'matilha',
      'caca_hero',
    ]);
  });

  it('reads each ability as priced, with its rank', () => {
    const rows = ownAbilityRowsFor({ abilities }, phaseWhere(false));
    expect(rows.find((row) => row.abilityId === 'bateria_extra')).toMatchObject({
      rank: 12,
      effect: { kind: 'drainPct', value: 12 },
      status: 'own',
    });
    expect(rows.find((row) => row.abilityId === 'detonacao_dupla')?.effect.kind).toBe('dmgMult');
  });

  it('Contra o Relógio is "not here" off a gate phase and the hero’s own on one', () => {
    const off = ownAbilityRowsFor({ abilities }, phaseWhere(false));
    const on = ownAbilityRowsFor({ abilities }, phaseWhere(true));
    expect(off.find((row) => row.abilityId === 'contra_relogio')?.status).toBe('notHere');
    expect(on.find((row) => row.abilityId === 'contra_relogio')?.status).toBe('own');
  });

  it('an ability the model carries no effect for is "not modelled"', () => {
    const rows = ownAbilityRowsFor({ abilities }, phaseWhere(false));
    expect(rows.find((row) => row.abilityId === 'caca_hero')).toMatchObject({
      effect: { kind: 'none' },
      status: 'notModelled',
    });
  });

  it("Matilha and Passagem de Bastão are the hero's own, read in their own units", () => {
    const rows = ownAbilityRowsFor({ abilities }, phaseWhere(false));
    expect(rows.find((row) => row.abilityId === 'matilha')).toMatchObject({
      effect: { kind: 'packDmgPctPerAlly', value: 3 },
      status: 'own',
    });
    expect(rows.find((row) => row.abilityId === 'passagem_bastao')).toMatchObject({
      effect: { kind: 'teamPulseDmgPct', value: 40 },
      status: 'own',
    });
  });
});

describe('drainNoteFor', () => {
  it('adds the hero’s own reduction to the team’s: −12% own and −20% team make −32%', () => {
    const switches = { ...noTeamAuraSwitches(), folego_mineiro: true };
    expect(drainNoteFor({ abilities: { bateria_extra: 12 } }, switches)).toEqual({ own: 12, team: 20, total: 32 });
  });

  it('reads the team half at the hero’s own Fôlego rank while its switch is off', () => {
    expect(drainNoteFor({ abilities: { folego_mineiro: 7 } }, noTeamAuraSwitches())).toEqual({ own: 0, team: 7, total: 7 });
  });

  it('is all zeros for a hero with neither', () => {
    expect(drainNoteFor({ abilities: {} }, noTeamAuraSwitches())).toEqual({ own: 0, team: 0, total: 0 });
  });
});
