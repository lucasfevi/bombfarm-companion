import { describe, expect, it } from 'vitest';
import {
  TEAM_ABILITY_IDS,
  UNMODELLED_READOUT_PER_LEVEL,
  isPricedReadout,
  isTeamAbilityId,
  isTeamAuraId,
  isTeamBuffId,
  ownAbilityReadout,
  teamAuraReadout,
} from '@bombfarm/domain/ability-effect-readout';
import { ABILITIES, abilityMods } from '@bombfarm/domain/model';
import { TEAM_AURA_SWITCH_IDS, TEAM_BUFF_ABILITY_IDS } from '@bombfarm/domain/team-buffs';

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

  it('Detonação Dupla reads as its chance and the multiplier abilityMods applies', () => {
    expect(ownAbilityReadout('detonacao_dupla', 20)).toEqual({
      kind: 'secondBlast',
      chancePct: 30,
      dmgMult: abilityMods({ detonacao_dupla: 20 }).dmgMult,
    });
  });

  it('Misericórdia reads as its execute threshold and the multiplier abilityMods applies', () => {
    const readout = ownAbilityReadout('misericordia', 20);
    expect(readout.kind).toBe('execute');
    expect(readout.kind === 'execute' && readout.thresholdPct).toBeCloseTo(15, 9);
    expect(readout.kind === 'execute' && readout.dmgMult).toBe(abilityMods({ misericordia: 20 }).dmgMult);
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

  it('an unknown id reads as none', () => {
    expect(ownAbilityReadout('not_an_ability', 10)).toEqual({ kind: 'none' });
  });

  it('the abilities the combat model never prices still read their published per-level figure', () => {
    expect(ownAbilityReadout('caca_hero', 10)).toEqual({ kind: 'cageDmgPct', value: 50 });
    expect(ownAbilityReadout('fantasma', 20)).toEqual({ kind: 'passageAttackPct', value: 1 });
    expect(ownAbilityReadout('olho_lapidador', 20)).toEqual({ kind: 'dropTierPct', value: 50 });
    expect(ownAbilityReadout('veia_ouro', 20)).toEqual({ kind: 'goldPct', value: 40 });
    expect(ownAbilityReadout('fortuna', 20)).toEqual({ kind: 'goldPct', value: 10 });
  });

  it('every ability whose effect the model skips has a published figure, and it matches its effect text', () => {
    for (const ability of ABILITIES.filter((entry) => entry.effect.kind === 'none')) {
      const published = UNMODELLED_READOUT_PER_LEVEL[ability.id];
      expect(published, ability.id).toBeDefined();
      expect(ability.effectText, ability.id).toContain(`${published?.perLevel}%`);
    }
  });

  it("Matilha reads as damage per ally, Passagem de Bastão as team damage on entering — neither off abilityMods' dmgMult", () => {
    expect(ownAbilityReadout('matilha', 10)).toEqual({ kind: 'packDmgPctPerAlly', value: 5 });
    expect(ownAbilityReadout('passagem_bastao', 10)).toEqual({ kind: 'teamPulseDmgPct', value: 40 });
    expect(abilityMods({ matilha: 10, passagem_bastao: 10 }).dmgMult).toBe(1);
  });

  it('Brecha as a team aura reads in penetration points at the amount asked for', () => {
    expect(teamAuraReadout('brecha', 20)).toEqual({ kind: 'penetrationPoints', value: 20 });
  });

  it('a team aura asked for as an own ability reads at its own rank in aura units', () => {
    expect(ownAbilityReadout('grito_guerra', 12)).toEqual({ kind: 'attackPct', value: 12 });
    expect(ownAbilityReadout('folego_mineiro', 12)).toEqual({ kind: 'drainPct', value: 12 });
  });

  it('every catalog ability has a readout — priced by the model, or published and marked as such', () => {
    for (const ability of ABILITIES) {
      const readout = ownAbilityReadout(ability.id, 1);
      expect(readout.kind, ability.id).not.toBe('none');
      expect(isPricedReadout(readout), ability.id).toBe(ability.effect.kind !== 'none');
    }
  });
});

describe('isTeamBuffId', () => {
  it('narrows exactly the modelled aura ids', () => {
    for (const buffId of TEAM_BUFF_ABILITY_IDS) expect(isTeamBuffId(buffId)).toBe(true);
    expect(isTeamBuffId('bateria_extra')).toBe(false);
  });
});

describe('isTeamAbilityId — every ability the catalog scopes to the TEAM, switched or not', () => {
  const catalogTeamIds = ABILITIES.filter((ability) => /\bTIME\b/.test(ability.effectText)).map(
    (ability) => ability.id,
  );

  it('agrees with the effect texts, so a team ability added to the catalog cannot go untagged', () => {
    expect([...TEAM_ABILITY_IDS].sort()).toEqual([...catalogTeamIds].sort());
    for (const ability of ABILITIES) {
      expect(isTeamAbilityId(ability.id), ability.id).toBe(catalogTeamIds.includes(ability.id));
    }
  });

  it('is the switched auras plus Fortuna, which the combat model leaves to the loot layer', () => {
    for (const auraId of TEAM_AURA_SWITCH_IDS) expect(isTeamAbilityId(auraId), auraId).toBe(true);
    expect(isTeamAbilityId('fortuna')).toBe(true);
    expect(isTeamAuraId('fortuna')).toBe(false);
    expect(isTeamBuffId('fortuna')).toBe(false);
  });

  it('a self-scoped ability is not one, even when its effect mentions allies', () => {
    expect(isTeamAbilityId('matilha')).toBe(false);
    expect(isTeamAbilityId('contra_relogio')).toBe(false);
    expect(isTeamAbilityId('veia_ouro')).toBe(false);
    expect(isTeamAbilityId('not_an_ability')).toBe(false);
  });
});
