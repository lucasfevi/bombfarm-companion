import { describe, expect, it } from 'vitest';
import { rankRosterByDps } from '@bombfarm/domain/roster-dps';
import type { AccountShared, HeroRecord } from '@bombfarm/domain/shims/storage';

function hero(id: string, dpsSeed: number): HeroRecord {
  return {
    id,
    name: id,
    updatedAt: 1,
    rarity: 'Raro',
    level: 20,
    stars: 0,
    naked: {
      attack: dpsSeed,
      energy: 100,
      speed: 50,
      critChance: 0,
      critDmg: 1,
      penetration: 0,
      cdr: 0,
      luck: 0,
    },
    loadout: {},
    altLoadout: null,
    gearedOverride: {
      attack: dpsSeed,
      energy: 100,
      speed: 50,
      critChance: 0,
      critDmg: 1,
      penetration: 0,
      cdr: 0,
      luck: 0,
    },
    abilities: {},
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
    sourceId: id,
  };
}

const account = (slots?: number): AccountShared => ({
  tree: {
    danoTotal: 1,
    critChance: 0,
    critDmg: 0,
    speed: 0,
    energy: 0,
    teamCoinPct: 0,
    glassCannon: false,
    tempoDobrado: false,
  },
  teamBuffs: {},
  context: {
    houseIdx: 0,
    houseLevel: 1,
    phase: 1,
    mitigationPct: 1,
    rankMode: 'dps',
    targetProp: 'stone',
  },
  slots,
});

describe('rankRosterByDps slots', () => {
  const heroes = Array.from({ length: 11 }, (_, index) => hero(`h${index}`, 100 - index));

  it('uses DEFAULT_CASA_SLOTS when account.slots is absent and limit is not passed', () => {
    const rows = rankRosterByDps({ heroes, account: account(), phase: 1, mitigationPct: 1 });
    expect(rows).toHaveLength(9);
  });

  it('prefers account.slots over the default limit when limit is omitted', () => {
    const rows = rankRosterByDps({
      heroes,
      account: account(6),
      phase: 1,
      mitigationPct: 1,
    });
    expect(rows).toHaveLength(6);
  });

  it('honours an explicit limit parameter over account.slots', () => {
    const rows = rankRosterByDps(
      { heroes, account: account(6), phase: 1, mitigationPct: 1 },
      4,
    );
    expect(rows).toHaveLength(4);
  });

  it('returns highest DPS first with limit 6 on an 11-hero roster', () => {
    const rows = rankRosterByDps(
      { heroes, account: account(), phase: 1, mitigationPct: 1 },
      6,
    );
    expect(rows).toHaveLength(6);
    expect(rows[0]?.heroId).toBe('h0');
    expect(rows[5]?.heroId).toBe('h5');
    for (let index = 1; index < rows.length; index++) {
      expect(rows[index - 1]!.dps).toBeGreaterThanOrEqual(rows[index]!.dps);
    }
  });

  it('does not pad when the roster is smaller than the limit', () => {
    const small = heroes.slice(0, 3);
    const rows = rankRosterByDps(
      { heroes: small, account: account(9), phase: 1, mitigationPct: 1 },
    );
    expect(rows).toHaveLength(3);
  });

  it('clamps limit <= 0 to one row', () => {
    const rows = rankRosterByDps(
      { heroes, account: account(), phase: 1, mitigationPct: 1 },
      0,
    );
    expect(rows).toHaveLength(1);
  });
});
