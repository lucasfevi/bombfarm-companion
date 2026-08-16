import { describe, expect, it } from 'vitest';
import { ABILITIES } from '@bombfarm/domain/model';
import {
  PASSAGEM_BASTAO_WINDOW_SEC,
  passagemBastaoCatalogUnmodelled,
  passagemBastaoMult,
  unmodelledAbilitiesInScope,
} from '@bombfarm/domain/team-plan/ability-extras';
import type { HeroPlanContext } from '@bombfarm/domain/team-plan/types';

function ctx(name: string, abilities: Record<string, number>, scope: HeroPlanContext['scope'] = 'optimize'): HeroPlanContext {
  return {
    heroId: name,
    name,
    level: 50,
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
    sheetOther: { speed: 0, critChance: 0, critDmgFlat: 0, penetration: 0, cdr: 0 },
    mods: {
      drainMult: 1,
      combatCritChancePctOfBase: 0,
      penetrationPp: 0,
      rangeCells: 0,
      dmgMult: 1,
      attackMult: 1,
      speedMult: 1,
      gateAttackMult: 1,
      sheetCritChancePctOfBase: 0,
      sheetPenetrationRaw: 0,
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

describe('passagemBastaoMult', () => {
  it('exports PASSAGEM_BASTAO_WINDOW_SEC = 120', () => {
    expect(PASSAGEM_BASTAO_WINDOW_SEC).toBe(120);
  });

  it('returns 1 for rank 0', () => {
    expect(passagemBastaoMult(0, 60)).toBe(1);
  });

  it('returns 1 for F <= 0', () => {
    expect(passagemBastaoMult(20, 0)).toBe(1);
    expect(passagemBastaoMult(20, -5)).toBe(1);
  });

  it('returns 1 for non-finite F', () => {
    expect(passagemBastaoMult(20, NaN)).toBe(1);
    expect(passagemBastaoMult(20, Infinity)).toBe(1);
  });

  it('passagemBastaoMult(20, 60) === 1.8 when window covers whole field', () => {
    expect(passagemBastaoMult(20, 60)).toBe(1.8);
  });

  it('passagemBastaoMult(20, 240) === 1.4 when window covers half', () => {
    expect(passagemBastaoMult(20, 240)).toBe(1.4);
  });
});

describe('ASM-S03 boundary', () => {
  it('ABILITIES passagem_bastao stays kind none and helper implements formula', () => {
    // ASM-S03: planner catalog untouched; team-plan scorer models the effect separately.
    expect(ABILITIES.find((a) => a.id === 'passagem_bastao')?.effect.kind).toBe('none');
    expect(passagemBastaoCatalogUnmodelled()).toBe(true);
    expect(passagemBastaoMult(20, 60)).toBe(1.8);
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

  it('includes passagem_bastao as assumption-based', () => {
    const list = unmodelledAbilitiesInScope([ctx('Hero', { passagem_bastao: 10 })]);
    const entry = list.find((e) => e.abilityId === 'passagem_bastao');
    expect(entry?.heroNames).toEqual(['Hero']);
    expect(entry?.assumptionBased).toBe(true);
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
