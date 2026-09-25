import { describe, expect, it } from 'vitest';
import { ABILITIES } from '@bombfarm/domain/model';
import { TEAM_ABILITY_IDS } from '@bombfarm/domain/ability-effect-readout';
import { showcaseEn, showcasePtBR } from '../copy';
import {
  HERO_TYPE_IDS,
  HERO_TYPE_VOTERS,
  WIDE_BLAST_ABILITY_ID,
  heroTypeLabels,
  heroTypeOfAbility,
  heroTypesFor,
  wideBlastOf,
} from './hero-types';

describe('heroTypesFor', () => {
  it('names the type whose abilities hold the most levels first', () => {
    expect(heroTypesFor({ olho_clinico: 11, ponta_diamante: 20 })).toEqual(['pierce']);
  });

  it('adds the levels of every ability voting for the same type', () => {
    expect(heroTypesFor({ olho_clinico: 10, golpe_brutal: 10, ponta_diamante: 19 })).toEqual([
      'crit',
      'pierce',
    ]);
  });

  it('ignores an ability below level 10', () => {
    expect(heroTypesFor({ olho_clinico: 9, ponta_diamante: 10 })).toEqual(['pierce']);
  });

  it('gives no type to a hero whose every typed ability sits below level 10', () => {
    expect(heroTypesFor({ olho_clinico: 9, matilha: 5, fortuna: 0 })).toEqual([]);
  });

  it('names a runner-up scoring exactly 60% of the leader', () => {
    expect(heroTypesFor({ misericordia: 20, contra_relogio: 12 })).toEqual(['finish', 'gate']);
  });

  it('leaves out a runner-up scoring under 60% of the leader', () => {
    expect(heroTypesFor({ misericordia: 20, contra_relogio: 11 })).toEqual(['finish']);
  });

  it('never names more than two types', () => {
    expect(
      heroTypesFor({ olho_clinico: 20, detonacao_dupla: 20, ponta_diamante: 20, misericordia: 20 }),
    ).toHaveLength(2);
  });

  it('breaks a tie in the fixed order crit, heavy, pierce, finish, gate, loot, buff, endure', () => {
    expect(heroTypesFor({ bateria_extra: 15, grito_guerra: 15 })).toEqual(['buff', 'endure']);
    expect(heroTypesFor({ ponta_diamante: 15, matilha: 15 })).toEqual(['heavy', 'pierce']);
    expect(heroTypesFor({ veia_ouro: 15, olho_clinico: 15, caca_hero: 15 })).toEqual([
      'crit',
      'gate',
    ]);
  });

  it('never counts Wide Blast, whatever its level', () => {
    expect(heroTypesFor({ [WIDE_BLAST_ABILITY_ID]: 20 })).toEqual([]);
    expect(heroTypesFor({ [WIDE_BLAST_ABILITY_ID]: 20, fantasma: 10 })).toEqual(['endure']);
  });

  it('calls Pack a heavy hitter, since it scales its carrier, not the team', () => {
    expect(heroTypesFor({ matilha: 20 })).toEqual(['heavy']);
  });

  it('calls Fortune a looter, the one team aura that votes outside the squad buffers', () => {
    expect(heroTypesFor({ fortuna: 20 })).toEqual(['loot']);
  });
});

describe('ability classification', () => {
  it('classifies every ability in the game, Wide Blast as the one deliberate exception', () => {
    const unclassified = ABILITIES.map((ability) => ability.id).filter(
      (id) => id !== WIDE_BLAST_ABILITY_ID && heroTypeOfAbility(id) === undefined,
    );
    expect(unclassified).toEqual([]);
    expect(heroTypeOfAbility(WIDE_BLAST_ABILITY_ID)).toBeUndefined();
  });

  it('names only abilities the game has, each under one type', () => {
    const known = new Set(ABILITIES.map((ability) => ability.id));
    const voters = HERO_TYPE_IDS.flatMap((type) => HERO_TYPE_VOTERS[type]);
    expect(voters.filter((id) => !known.has(id))).toEqual([]);
    expect(new Set(voters).size).toBe(voters.length);
  });

  it('files every combat team aura under the squad buffers', () => {
    const combatAuras = TEAM_ABILITY_IDS.filter((id) => id !== 'fortuna');
    expect(combatAuras.map(heroTypeOfAbility)).toEqual(combatAuras.map(() => 'buff'));
  });
});

describe('wideBlastOf', () => {
  it('reports the level of a hero carrying Wide Blast', () => {
    expect(wideBlastOf({ explosao_ampla: 14 })).toEqual({ has: true, level: 14 });
  });

  it('counts an unspent Wide Blast slot as carried', () => {
    expect(wideBlastOf({ explosao_ampla: 0 })).toEqual({ has: true, level: 0 });
  });

  it('reports absence for a hero without it', () => {
    expect(wideBlastOf({ olho_clinico: 20 })).toEqual({ has: false });
  });
});

describe('heroTypeLabels', () => {
  it('prints the word for an unspecialised hero when there is no type', () => {
    expect(heroTypeLabels([], showcaseEn)).toEqual(['Unspecialised']);
    expect(heroTypeLabels([], showcasePtBR)).toEqual(['Sem especialidade']);
  });

  it('prints both names, leader first', () => {
    expect(heroTypeLabels(['gate', 'loot'], showcaseEn)).toEqual(['Gate hunter', 'Looter']);
  });

  it('has a name in both languages for every type', () => {
    for (const copy of [showcaseEn, showcasePtBR]) {
      const labels = heroTypeLabels(HERO_TYPE_IDS, copy);
      expect(new Set(labels).size).toBe(HERO_TYPE_IDS.length);
    }
  });
});
