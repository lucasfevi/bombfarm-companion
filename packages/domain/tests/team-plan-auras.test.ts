import { describe, expect, it } from 'vitest';
import { stackTeamBonusMult, TEAM_MULT_BONUS_CAP } from '@bombfarm/domain/derive';
import { computeRosterAuras } from '@bombfarm/domain/team-plan/auras';
import type { HeroPlanContext } from '@bombfarm/domain/team-plan/types';

function ctx(
  heroId: string,
  scope: HeroPlanContext['scope'],
  abilities: Record<string, number>,
): HeroPlanContext {
  return {
    heroId,
    name: heroId,
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

describe('computeRosterAuras', () => {
  it('sums perLevel × rank × duty for optimize heroes excluding self', () => {
    const contexts = [
      ctx('a', 'optimize', { grito_guerra: 10 }),
      ctx('b', 'optimize', { grito_guerra: 5 }),
    ];
    const duty = { a: 0.5, b: 0.8 };
    const forA = computeRosterAuras(contexts, duty, 'a');
    expect(forA.grito_guerra).toBe(1 * 5 * 0.8);
    const forB = computeRosterAuras(contexts, duty, 'b');
    expect(forB.grito_guerra).toBe(1 * 10 * 0.5);
  });

  it('excluded hero never contributes to its own aura vector', () => {
    const contexts = [ctx('self', 'optimize', { grito_guerra: 20 })];
    const auras = computeRosterAuras(contexts, { self: 1 }, 'self');
    expect(auras.grito_guerra).toBe(0);
  });

  it('donate and leaveAlone heroes contribute no aura', () => {
    const contexts = [
      ctx('opt', 'optimize', { grito_guerra: 10 }),
      ctx('don', 'donate', { grito_guerra: 10 }),
      ctx('leave', 'leaveAlone', { grito_guerra: 10 }),
    ];
    const auras = computeRosterAuras(contexts, { opt: 1, don: 1, leave: 1 }, 'none');
    expect(auras.grito_guerra).toBe(1 * 10 * 1);
  });

  it('halving carrier duty halves aura contribution', () => {
    const contexts = [ctx('a', 'optimize', { folego_mineiro: 10 })];
    const full = computeRosterAuras(contexts, { a: 1 }, 'b');
    const half = computeRosterAuras(contexts, { a: 0.5 }, 'b');
    expect(half.folego_mineiro).toBe(full.folego_mineiro / 2);
  });

  it('raw sum can exceed 100; stackTeamBonusMult applies cap once (ASM-RGO-02)', () => {
    const contexts = [
      ctx('a', 'optimize', { grito_guerra: 60 }),
      ctx('b', 'optimize', { grito_guerra: 60 }),
    ];
    const auras = computeRosterAuras(contexts, { a: 1, b: 1 }, 'c');
    expect(auras.grito_guerra).toBeGreaterThan(100);
    const mult = stackTeamBonusMult(1, auras.grito_guerra);
    expect(mult).toBeLessThanOrEqual(1 + TEAM_MULT_BONUS_CAP);
  });

  it('covers all five TEAM_BUFF_ABILITY_IDS', () => {
    const contexts = [
      ctx('a', 'optimize', {
        grito_guerra: 1,
        pressagio_mortal: 1,
        marcha_acelerada: 1,
        folego_mineiro: 1,
        contra_relogio: 1,
      }),
    ];
    const auras = computeRosterAuras(contexts, { a: 1 }, 'b');
    expect(auras.grito_guerra).toBeGreaterThan(0);
    expect(auras.pressagio_mortal).toBeGreaterThan(0);
    expect(auras.marcha_acelerada).toBeGreaterThan(0);
    expect(auras.folego_mineiro).toBeGreaterThan(0);
    expect(auras.contra_relogio).toBeGreaterThan(0);
  });

  it('zero duty yields zero contribution', () => {
    const contexts = [ctx('a', 'optimize', { grito_guerra: 10 })];
    const auras = computeRosterAuras(contexts, { a: 0 }, 'b');
    expect(auras.grito_guerra).toBe(0);
  });

  it('missing duty entry treated as zero', () => {
    const contexts = [ctx('a', 'optimize', { grito_guerra: 10 })];
    const auras = computeRosterAuras(contexts, {}, 'b');
    expect(auras.grito_guerra).toBe(0);
  });

  it('rank 0 ability contributes nothing', () => {
    const contexts = [ctx('a', 'optimize', { grito_guerra: 0 })];
    const auras = computeRosterAuras(contexts, { a: 1 }, 'b');
    expect(auras.grito_guerra).toBe(0);
  });
});
