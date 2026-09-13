import { describe, expect, it } from 'vitest';
import { ABILITIES, abilityMods, passagemBastaoFieldPulse } from '@bombfarm/domain/model';
import { unmodelledAbilitiesInScope } from '@bombfarm/domain/team-plan/ability-extras';
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
      packDmgPctPerAlly: 0,
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
  it('passagem_bastao is a team pulse in the catalog and never reaches a carrier\'s own mods', () => {
    // The sheet never carries the pulse; the rotating surfaces and the hero's own screen price
    // it through `passagemBastaoFieldPulse` instead.
    expect(ABILITIES.find((a) => a.id === 'passagem_bastao')?.effect).toEqual({
      kind: 'teamPulseDmgPct',
      perLevel: 4,
    });
    expect(abilityMods({ passagem_bastao: 20 })).toEqual(abilityMods({}));
    expect(passagemBastaoFieldPulse([{ rank: 20, presence: 1 }]).expectedMult).toBe(1.8);
  });
});

describe('unmodelledAbilitiesInScope', () => {
  it('lists caca_hero and fantasma with carrier names', () => {
    const contexts = [ctx('C', { caca_hero: 1 }), ctx('D', { fantasma: 2 })];
    const list = unmodelledAbilitiesInScope(contexts);
    expect(list.find((e) => e.abilityId === 'caca_hero')?.heroNames).toEqual(['C']);
    expect(list.find((e) => e.abilityId === 'fantasma')?.heroNames).toEqual(['D']);
  });

  it('does not list the three abilities the objectives now price — matilha, brecha, passagem_bastao', () => {
    const list = unmodelledAbilitiesInScope([
      ctx('Pack', { matilha: 5 }),
      ctx('Breach', { brecha: 3 }),
      ctx('Baton', { passagem_bastao: 10 }),
    ]);
    expect(list).toEqual([]);
  });

  it('ignores donate and leaveAlone heroes', () => {
    const list = unmodelledAbilitiesInScope([
      ctx('Opt', { caca_hero: 1 }, 'optimize'),
      ctx('Don', { caca_hero: 1 }, 'donate'),
      ctx('Leave', { caca_hero: 1 }, 'leaveAlone'),
    ]);
    expect(list.find((e) => e.abilityId === 'caca_hero')?.heroNames).toEqual(['Opt']);
  });

  it('ignores rank 0 abilities', () => {
    const list = unmodelledAbilitiesInScope([ctx('Hero', { caca_hero: 0 })]);
    expect(list.find((e) => e.abilityId === 'caca_hero')).toBeUndefined();
  });
});
