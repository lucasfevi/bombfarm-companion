import { describe, expect, it } from 'vitest';
import { combineTeamAuraPct } from '@bombfarm/domain/derive';
import { TEAM_BUFF_CAP } from '@bombfarm/domain/team-buffs';
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

describe('computeRosterAuras', () => {
  it('sums perLevel × rank × duty across EVERY optimize hero, excluding nobody (issue #132)', () => {
    const contexts = [
      ctx('a', 'optimize', { grito_guerra: 10 }),
      ctx('b', 'optimize', { grito_guerra: 5 }),
    ];
    const duty = { a: 0.5, b: 0.8 };
    // 1 * 10 * 0.5 (a) + 1 * 5 * 0.8 (b) = 9. There is no per-hero exclusion any more — every
    // hero, including a carrier, reads this SAME total (see the regression test below).
    const auras = computeRosterAuras(contexts, duty);
    expect(auras.grito_guerra).toBe(1 * 10 * 0.5 + 1 * 5 * 0.8);
  });

  it('a carrier’s own rank counts toward the total exactly like every other carrier’s (issue #132)', () => {
    const contexts = [ctx('self', 'optimize', { grito_guerra: 20 })];
    const auras = computeRosterAuras(contexts, { self: 1 });
    // The OLD exclude-based signature returned 0 here (the sole carrier excluded from its own
    // total). Under the confirmed rule the field total includes every carrier, this one
    // included, so a lone rank-20 carrier now reads its own 20.
    expect(auras.grito_guerra).toBe(20);
  });

  it('donate and leaveAlone heroes contribute no aura', () => {
    const contexts = [
      ctx('opt', 'optimize', { grito_guerra: 10 }),
      ctx('don', 'donate', { grito_guerra: 10 }),
      ctx('leave', 'leaveAlone', { grito_guerra: 10 }),
    ];
    const auras = computeRosterAuras(contexts, { opt: 1, don: 1, leave: 1 });
    expect(auras.grito_guerra).toBe(1 * 10 * 1);
  });

  it('halving carrier duty halves aura contribution', () => {
    const contexts = [ctx('a', 'optimize', { folego_mineiro: 10 })];
    const full = computeRosterAuras(contexts, { a: 1 });
    const half = computeRosterAuras(contexts, { a: 0.5 });
    expect(half.folego_mineiro).toBe(full.folego_mineiro / 2);
  });

  it('raw sum can exceed the aura cap; combineTeamAuraPct applies the cap once (ASM-RGO-02, Fault 4)', () => {
    const contexts = [
      ctx('a', 'optimize', { grito_guerra: 60 }),
      ctx('b', 'optimize', { grito_guerra: 60 }),
    ];
    const auras = computeRosterAuras(contexts, { a: 1, b: 1 });
    expect(auras.grito_guerra).toBeGreaterThan(TEAM_BUFF_CAP.grito_guerra);
    const combined = combineTeamAuraPct(0, auras.grito_guerra, TEAM_BUFF_CAP.grito_guerra);
    expect(combined).toBe(TEAM_BUFF_CAP.grito_guerra);
  });

  it('covers all four TEAM_BUFF_ABILITY_IDS', () => {
    const contexts = [
      ctx('a', 'optimize', {
        grito_guerra: 1,
        pressagio_mortal: 1,
        marcha_acelerada: 1,
        folego_mineiro: 1,
      }),
    ];
    const auras = computeRosterAuras(contexts, { a: 1 });
    expect(auras.grito_guerra).toBeGreaterThan(0);
    expect(auras.pressagio_mortal).toBeGreaterThan(0);
    expect(auras.marcha_acelerada).toBeGreaterThan(0);
    expect(auras.folego_mineiro).toBeGreaterThan(0);
    expect('contra_relogio' in auras).toBe(false);
  });

  it('zero duty yields zero contribution', () => {
    const contexts = [ctx('a', 'optimize', { grito_guerra: 10 })];
    const auras = computeRosterAuras(contexts, { a: 0 });
    expect(auras.grito_guerra).toBe(0);
  });

  it('missing duty entry treated as zero', () => {
    const contexts = [ctx('a', 'optimize', { grito_guerra: 10 })];
    const auras = computeRosterAuras(contexts, {});
    expect(auras.grito_guerra).toBe(0);
  });

  it('rank 0 ability contributes nothing', () => {
    const contexts = [ctx('a', 'optimize', { grito_guerra: 0 })];
    const auras = computeRosterAuras(contexts, { a: 1 });
    expect(auras.grito_guerra).toBe(0);
  });
});
