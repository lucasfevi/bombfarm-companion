import { describe, expect, it } from 'vitest';
import {
  isTeamBuffId,
  ownAbilityReadout,
  teamAuraReadout,
} from '@bombfarm/domain/ability-effect-readout';
import { ABILITIES, abilityMods } from '@bombfarm/domain/model';
import { TEAM_BUFF_ABILITY_IDS } from '@bombfarm/domain/team-buffs';

describe('teamAuraReadout — an aura at an amount, in the unit its effect kind names', () => {
  it('maps each modelled aura to its unit', () => {
    expect(teamAuraReadout('grito_guerra', 20)).toEqual({ kind: 'attackPct', value: 20 });
    expect(teamAuraReadout('marcha_acelerada', 3.7)).toEqual({ kind: 'speedPct', value: 3.7 });
    expect(teamAuraReadout('pressagio_mortal', 20)).toEqual({ kind: 'critPoints', value: 20 });
    expect(teamAuraReadout('folego_mineiro', 20)).toEqual({ kind: 'drainPct', value: 20 });
  });

  it('every aura in the modelled list has a unit, so an aura added to the list needs no edit here', () => {
    for (const buffId of TEAM_BUFF_ABILITY_IDS) {
      expect(teamAuraReadout(buffId, 1).kind, buffId).not.toBe('none');
    }
  });
});

describe('ownAbilityReadout — the model’s own arithmetic read back', () => {
  it('Bateria Extra at rank 12 is a 12% drain reduction', () => {
    expect(ownAbilityReadout('bateria_extra', 12)).toEqual({ kind: 'drainPct', value: 12 });
  });

  it('Explosão Ampla at rank 10 is one extra cell of radius', () => {
    const readout = ownAbilityReadout('explosao_ampla', 10);
    expect(readout.kind).toBe('rangeCells');
    expect(readout.kind === 'rangeCells' && readout.value).toBeCloseTo(1, 12);
  });

  it('Detonação Dupla and Misericórdia read as the damage multiplier abilityMods applies', () => {
    for (const abilityId of ['detonacao_dupla', 'misericordia']) {
      const readout = ownAbilityReadout(abilityId, 12);
      expect(readout).toEqual({ kind: 'dmgMult', value: abilityMods({ [abilityId]: 12 }).dmgMult });
      expect(readout.kind === 'dmgMult' && readout.value).toBeGreaterThan(1);
    }
  });

  it('Contra o Relógio reads as gate attack, never as attack', () => {
    const readout = ownAbilityReadout('contra_relogio', 8);
    expect(readout.kind).toBe('gateAttackPct');
    expect(readout.kind === 'gateAttackPct' && readout.value).toBeCloseTo(16, 9);
  });

  it('the on-sheet flat abilities read in points', () => {
    expect(ownAbilityReadout('olho_clinico', 10)).toEqual({ kind: 'critPoints', value: 20 });
    expect(ownAbilityReadout('ponta_diamante', 10)).toEqual({ kind: 'penetrationPoints', value: 10 });
    expect(ownAbilityReadout('golpe_brutal', 5)).toEqual({ kind: 'critDmgPct', value: 20 });
  });

  it('an unmodelled ability, or an unknown id, reads as none', () => {
    expect(ownAbilityReadout('passagem_bastao', 10)).toEqual({ kind: 'none' });
    expect(ownAbilityReadout('not_an_ability', 10)).toEqual({ kind: 'none' });
  });

  it('a team aura asked for as an own ability reads at its own rank in aura units', () => {
    expect(ownAbilityReadout('grito_guerra', 12)).toEqual({ kind: 'attackPct', value: 12 });
    expect(ownAbilityReadout('folego_mineiro', 12)).toEqual({ kind: 'drainPct', value: 12 });
  });

  it('every catalog ability with a modelled effect has a readout', () => {
    for (const ability of ABILITIES) {
      const readout = ownAbilityReadout(ability.id, 1);
      if (ability.effect.kind === 'none') expect(readout.kind, ability.id).toBe('none');
      else expect(readout.kind, ability.id).not.toBe('none');
    }
  });
});

describe('isTeamBuffId', () => {
  it('narrows exactly the modelled aura ids', () => {
    for (const buffId of TEAM_BUFF_ABILITY_IDS) expect(isTeamBuffId(buffId)).toBe(true);
    expect(isTeamBuffId('bateria_extra')).toBe(false);
  });
});
