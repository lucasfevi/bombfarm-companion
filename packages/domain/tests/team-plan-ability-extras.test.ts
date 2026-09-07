import { describe, expect, it } from 'vitest';
import { ABILITIES, HOUSES, HOUSE_MAX_LEVEL, houseRestSeconds } from '@bombfarm/domain/model';
import {
  PASSAGEM_BASTAO_COOLDOWN_SEC,
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
    sheetOther: { speed: 0, critChanceFlat: 0, critDmgFlat: 0, penetration: 0, cdr: 0 },
    mods: {
      drainMult: 1,
      penetrationPp: 0,
      rangeCells: 0,
      dmgMult: 1,
      gateAttackMult: 1,
      sheetCritChanceFlat: 0,
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
  it('exports the pulse window and the pulse cooldown', () => {
    expect(PASSAGEM_BASTAO_WINDOW_SEC).toBe(120);
    expect(PASSAGEM_BASTAO_COOLDOWN_SEC).toBe(600);
  });

  it('returns 1 for rank 0', () => {
    expect(passagemBastaoMult(0, 60, 0.1)).toBe(1);
  });

  it('returns 1 for F <= 0', () => {
    expect(passagemBastaoMult(20, 0, 0.1)).toBe(1);
    expect(passagemBastaoMult(20, -5, 0.1)).toBe(1);
  });

  it('returns 1 for non-finite F', () => {
    expect(passagemBastaoMult(20, NaN, 0.1)).toBe(1);
    expect(passagemBastaoMult(20, Infinity, 0.1)).toBe(1);
  });

  it('throws rather than guessing when duty cannot give a rotation cycle', () => {
    expect(() => passagemBastaoMult(20, 60, 0)).toThrow(RangeError);
    expect(() => passagemBastaoMult(20, 60, 1.5)).toThrow(RangeError);
    expect(() => passagemBastaoMult(20, 60, NaN)).toThrow(RangeError);
    // The signature grew a third argument; domain tests are not typechecked, so a call site left
    // at two arguments has to fail loudly instead of silently scoring without the cooldown.
    expect(() => (passagemBastaoMult as unknown as (r: number, f: number) => number)(20, 60)).toThrow(
      RangeError,
    );
  });

  it('is 1.8 when the window covers the whole deployment and every entry pulses', () => {
    // F = 60 s on field, duty 0.1 → a 600 s cycle, exactly the cooldown.
    expect(passagemBastaoMult(20, 60, 0.1)).toBe(1.8);
  });

  it('is 1.4 when the window covers half the deployment and every entry pulses', () => {
    // F = 240 s on field, duty 0.4 → a 600 s cycle, exactly the cooldown.
    expect(passagemBastaoMult(20, 240, 0.4)).toBe(1.4);
  });

  it('halves the bonus when the carrier re-enters twice per cooldown', () => {
    // Same 120 s deployment, but duty 0.4 → a 300 s cycle, so only every other entry pulses.
    expect(passagemBastaoMult(20, 120, 0.2)).toBe(1.8);
    expect(passagemBastaoMult(20, 120, 0.4)).toBeCloseTo(1.4, 10);
  });

  it('a busier rotation is worth strictly less to the same carrier', () => {
    const slow = passagemBastaoMult(20, 120, 0.2);
    const busy = passagemBastaoMult(20, 120, 0.8);
    expect(busy).toBeLessThan(slow);
    expect(busy).toBeCloseTo(1.2, 10);
  });
});

describe('the pulse cooldown cannot bind while the House stays this slow', () => {
  // The whole reason the cooldown term reads as dead code. A hero re-enters the field once per
  // (field seconds + one House recovery), so the cooldown only starts costing pulses once some
  // House recovers faster than it. Today none does, and this is the assertion that notices when
  // one finally does — at which point the term below stops being inert and someone owes this
  // model a second look.
  it('the fastest House in the game recovers no faster than the pulse cooldown', () => {
    const fastest = Math.min(
      ...HOUSES.map((_, index) => houseRestSeconds(index, HOUSE_MAX_LEVEL)),
    );
    expect(fastest).toBe(600);
    expect(fastest).toBeGreaterThanOrEqual(PASSAGEM_BASTAO_COOLDOWN_SEC);
  });

  it('so every reachable carrier pulses on every entry, whatever their energy', () => {
    const fastestRest = Math.min(
      ...HOUSES.map((_, index) => houseRestSeconds(index, HOUSE_MAX_LEVEL)),
    );
    for (const fieldSecondsValue of [1, 30, 120, 400, 1200]) {
      const duty = fieldSecondsValue / (fieldSecondsValue + fastestRest);
      const withCooldown = passagemBastaoMult(20, fieldSecondsValue, duty);
      const share = Math.min(PASSAGEM_BASTAO_WINDOW_SEC, fieldSecondsValue) / fieldSecondsValue;
      expect(withCooldown).toBeCloseTo(1 + 0.04 * 20 * share, 12);
    }
  });
});

describe('the boundary against the shared catalog', () => {
  it('ABILITIES passagem_bastao stays kind none and helper implements formula', () => {
    // Planner catalog untouched; the team-plan scorer models the effect separately.
    expect(ABILITIES.find((a) => a.id === 'passagem_bastao')?.effect.kind).toBe('none');
    expect(passagemBastaoCatalogUnmodelled()).toBe(true);
    expect(passagemBastaoMult(20, 60, 0.1)).toBe(1.8);
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
