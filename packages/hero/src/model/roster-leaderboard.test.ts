import { describe, expect, it } from 'vitest';
import { emptyLoadout, emptySheetOther } from '@bombfarm/domain/gear';
import { SHEET_KEYS } from '@bombfarm/domain/planner-constants';
import { peelSheetStages } from '@bombfarm/domain/sheet-stages';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import { showcaseEn } from '../copy';
import {
  LEADERBOARD_COLUMNS,
  filterLeaderboardRows,
  heroStatSheet,
  leaderboardRowsFor,
  sortLeaderboardRows,
  type LeaderboardRow,
} from './roster-leaderboard';
import { NEUTRAL_TREE, ZERO_SHEET, item, rowFixture } from './showcase.test-fixture';

const BIRTH = { ...ZERO_SHEET, attack: 180, energy: 200, speed: 50, critChance: 7, critDmg: 60, cdr: 2 };

function board(...heroes: (Partial<HeroRecord> & Pick<HeroRecord, 'id'>)[]): readonly LeaderboardRow[] {
  return leaderboardRowsFor(heroes.map(rowFixture), NEUTRAL_TREE);
}

const ids = (rows: readonly LeaderboardRow[]) => rows.map((row) => row.id);

describe('heroStatSheet', () => {
  it('matches the Total column of the hero panel’s statistic sheet', () => {
    const hero = rowFixture({
      id: 'a',
      birth: BIRTH,
      level: 80,
      stars: 2,
      abilities: { olho_clinico: 10, golpe_brutal: 5, ponta_diamante: 3 },
      loadout: { ...emptyLoadout(), arma: item(100, 4) },
      pts: { ...ZERO_SHEET, attack: 20, critDmg: 10 },
      runes: [{ axis: 'attack', strengthPct: 10, playSecondsLeft: 600, rarity: 1 }],
    }).hero;
    const tree = { ...NEUTRAL_TREE, danoStatic: 1.3, critChancePct: 8, luckFlatPct: 2 };
    const stages = peelSheetStages({
      birth: BIRTH,
      level: 80,
      stars: 2,
      sheetOther: { ...emptySheetOther(), critChanceFlat: 20, critDmgFlat: 20, penetration: 3 },
      loadout: hero.loadout,
      pts: hero.pts,
      tree,
      runes: hero.runes,
    });
    const sheet = heroStatSheet(hero, tree);
    for (const key of SHEET_KEYS) expect(sheet?.[key]).toBeCloseTo(stages[key].total, 9);
  });

  it('has no sheet for a hero without a birth roll, as the panel has no Total', () => {
    expect(heroStatSheet(rowFixture({ id: 'a' }).hero, NEUTRAL_TREE)).toBeUndefined();
  });
});

describe('leaderboardRowsFor', () => {
  it('counts the ability pool and the gear worn, with its average item level', () => {
    const [row] = board({
      id: 'a',
      abilities: { olho_clinico: 20, explosao_ampla: 0 },
      loadout: { ...emptyLoadout(), arma: item(100, 0), elmo: item(300, 0) },
    });
    expect(row).toMatchObject({ abilityCount: 2, gearCount: 2, gearAverageLevel: 200 });
  });
});

describe('sortLeaderboardRows', () => {
  it('orders by power, strongest first when descending', () => {
    const rows = board({ id: 'a', power: 10 }, { id: 'b', power: 30 }, { id: 'c', power: 20 });
    expect(ids(sortLeaderboardRows(rows, 'power', 'desc'))).toEqual(['b', 'c', 'a']);
    expect(ids(sortLeaderboardRows(rows, 'power', 'asc'))).toEqual(['a', 'c', 'b']);
  });

  it('orders a stat column by the composed sheet', () => {
    const rows = board(
      { id: 'weak', birth: { ...BIRTH, attack: 100 } },
      { id: 'strong', birth: { ...BIRTH, attack: 300 } },
    );
    expect(ids(sortLeaderboardRows(rows, 'attack', 'desc'))).toEqual(['strong', 'weak']);
  });

  it('breaks equal figures by name and then id, the same way in both directions', () => {
    const rows = board(
      { id: 'z', name: 'Bea', level: 60 },
      { id: 'y', name: 'Ann', level: 60 },
      { id: 'x', name: 'Ann', level: 60 },
    );
    expect(ids(sortLeaderboardRows(rows, 'level', 'desc'))).toEqual(['x', 'y', 'z']);
    expect(ids(sortLeaderboardRows(rows, 'level', 'asc'))).toEqual(['x', 'y', 'z']);
  });

  it('gives the same order however the roster arrived', () => {
    const rows = board(
      { id: 'a', rarity: 'Épico' },
      { id: 'b', rarity: 'Raro' },
      { id: 'c', rarity: 'Épico' },
      { id: 'd', rarity: 'Mítico' },
    );
    const expected = ids(sortLeaderboardRows(rows, 'rarity', 'desc'));
    expect(expected).toEqual(['d', 'a', 'c', 'b']);
    expect(ids(sortLeaderboardRows([...rows].reverse(), 'rarity', 'desc'))).toEqual(expected);
  });

  it('sorts a figure the read did not carry last in both directions', () => {
    const rows = board({ id: 'known', power: 1 }, { id: 'unknown' }, { id: 'high', power: 5 });
    expect(ids(sortLeaderboardRows(rows, 'power', 'desc'))).toEqual(['high', 'known', 'unknown']);
    expect(ids(sortLeaderboardRows(rows, 'power', 'asc'))).toEqual(['known', 'high', 'unknown']);
  });

  it('ranks gear by pieces worn, then by their average level', () => {
    const rows = board(
      { id: 'one-high', loadout: { arma: item(300, 0) } },
      { id: 'two-low', loadout: { arma: item(10, 0), elmo: item(10, 0) } },
      { id: 'two-high', loadout: { arma: item(200, 0), elmo: item(200, 0) } },
    );
    expect(ids(sortLeaderboardRows(rows, 'gear', 'desc'))).toEqual(['two-high', 'two-low', 'one-high']);
  });

  it('sorts names alphabetically, ignoring case', () => {
    const rows = board({ id: 'a', name: 'bruno' }, { id: 'b', name: 'Ana' }, { id: 'c', name: 'Carla' });
    expect(ids(sortLeaderboardRows(rows, 'name', 'asc'))).toEqual(['b', 'a', 'c']);
    expect(ids(sortLeaderboardRows(rows, 'name', 'desc'))).toEqual(['c', 'a', 'b']);
  });

  it('orders the birth column by the roll the grade is read from', () => {
    const window = { min: 0, max: 100 };
    const rows = board(
      { id: 'low', birth: { ...ZERO_SHEET, attack: 20 }, statRanges: { attack: window } },
      { id: 'high', birth: { ...ZERO_SHEET, attack: 90 }, statRanges: { attack: window } },
    );
    expect(ids(sortLeaderboardRows(rows, 'birth', 'desc'))).toEqual(['high', 'low']);
    expect(rows[1]?.gradeLetter).toEqual(expect.any(String));
  });
});

describe('filterLeaderboardRows', () => {
  const rows = board({ id: 'unset' }, { id: 'allowed', battleAllowed: true }, { id: 'off', battleAllowed: false });

  it('keeps everyone', () => {
    expect(ids(filterLeaderboardRows(rows, 'everyone'))).toEqual(['unset', 'allowed', 'off']);
  });

  it('keeps the squad, a hero never asked about included', () => {
    expect(ids(filterLeaderboardRows(rows, 'squad'))).toEqual(['unset', 'allowed']);
  });

  it('keeps the bench', () => {
    expect(ids(filterLeaderboardRows(rows, 'bench'))).toEqual(['off']);
  });
});

describe('LEADERBOARD_COLUMNS', () => {
  it('runs from the position to the gear, every one labelled', () => {
    expect(LEADERBOARD_COLUMNS.map((column) => showcaseEn[column.label])).toEqual([
      '#',
      'Hero',
      'Rarity',
      'Level',
      'Birth',
      'Power',
      'Attack',
      'Crit chance',
      'Crit damage',
      'Luck',
      'Speed',
      'Abilities',
      'Gear',
    ]);
  });

  it('sorts every column but the position, names A to Z and figures best first', () => {
    const unsortable = LEADERBOARD_COLUMNS.filter((column) => !column.sortable).map((c) => c.id);
    expect(unsortable).toEqual(['position']);
    const ascending = LEADERBOARD_COLUMNS.filter((column) => column.firstDirection === 'asc');
    expect(ascending.map((column) => column.id)).toEqual(['name']);
  });
});
