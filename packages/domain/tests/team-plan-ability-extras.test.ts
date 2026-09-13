import { describe, expect, it } from 'vitest';
import { ABILITIES, passagemBastaoFieldPulse } from '@bombfarm/domain/model';
import {
  passagemBastaoCatalogUnmodelled,
  unmodelledAbilitiesInScope,
} from '@bombfarm/domain/team-plan/ability-extras';
import type { HeroPlanContext } from '@bombfarm/domain/team-plan/types';

function ctx(name: string, abilities: Record<string, number>, scope: HeroPlanContext['scope'] = 'optimize'): HeroPlanContext {
  return {
    heroId: name,
    name,
    level: 50,
    runes: [],
    stars: 0,
    rarity: 'Raro',
    birth: {
      attack: 100,
      energy: 100,
      speed: 50,
      critChance: 10,
      critDmg: 50,
      penetration: 0,
      cdr: 0,
      luck: 0,
    },
    sheetOther: { speed: 0, critChanceFlat: 0, critDmgFlat: 0, penetration: 0, cdr: 0 },
    mods: {
      drainMult: 1,
      penetrationPp: 0,
      rangeCells: 0,
      dmgMult: 1,
      gateAttackMult: 1,
      sheetCritChanceFlat: 0,
      sheetPenetrationFlat: 0,
      sheetCritDmgFlat: 0,
    },
    treeSheet: {
      danoStatic: 1,
      energyPct: 0,
      speedPct: 0,
      critChancePct: 0,
      critDmgPct: 0,
      luckFlatPct: 0,
    },
    scope,
    abilities,
    pts: {
      attack: 0,
      energy: 0,
      speed: 0,
      critChance: 0,
      critDmg: 0,
      penetration: 0,
      cdr: 0,
      luck: 0,
    },
  };
}

describe('the boundary against the shared catalog', () => {
  it('ABILITIES passagem_bastao stays kind none while the rule prices the pulse on rates', () => {
    // The sheet never carries the pulse; the Farm board and the Optimizer price it themselves.
    expect(ABILITIES.find((a) => a.id === 'passagem_bastao')?.effect.kind).toBe('none');
    expect(passagemBastaoCatalogUnmodelled()).toBe(true);
    expect(passagemBastaoFieldPulse([{ rank: 20, presence: 1 }]).expectedMult).toBe(1.8);
  });
});

describe('unmodelledAbilitiesInScope', () => {
  it('lists matilha, brecha, caca_hero, fantasma with carrier names', () => {
    const contexts = [
      ctx('A', { matilha: 5 }),
      ctx('B', { brecha: 3 }),
      ctx('C', { caca_hero: 1 }),
      ctx('D', { fantasma: 2 }),
    ];
    const list = unmodelledAbilitiesInScope(contexts);
    expect(list.find((e) => e.abilityId === 'matilha')?.heroNames).toEqual(['A']);
    expect(list.find((e) => e.abilityId === 'brecha')?.heroNames).toEqual(['B']);
    expect(list.find((e) => e.abilityId === 'caca_hero')?.heroNames).toEqual(['C']);
    expect(list.find((e) => e.abilityId === 'fantasma')?.heroNames).toEqual(['D']);
  });

  it('does not list passagem_bastao — it is priced over the rotation like the team auras', () => {
    const list = unmodelledAbilitiesInScope([ctx('Hero', { passagem_bastao: 10 })]);
    expect(list.find((e) => e.abilityId === 'passagem_bastao')).toBeUndefined();
  });

  it('ignores donate and leaveAlone heroes', () => {
    const list = unmodelledAbilitiesInScope([
      ctx('Opt', { matilha: 1 }, 'optimize'),
      ctx('Don', { matilha: 1 }, 'donate'),
      ctx('Leave', { matilha: 1 }, 'leaveAlone'),
    ]);
    expect(list.find((e) => e.abilityId === 'matilha')?.heroNames).toEqual(['Opt']);
  });

  it('ignores rank 0 abilities', () => {
    const list = unmodelledAbilitiesInScope([ctx('Hero', { matilha: 0 })]);
    expect(list.find((e) => e.abilityId === 'matilha')).toBeUndefined();
  });
});
