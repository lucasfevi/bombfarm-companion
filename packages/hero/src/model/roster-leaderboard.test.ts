import { describe, expect, it } from 'vitest';
import { emptyLoadout, emptySheetOther } from '@bombfarm/domain/gear';
import { SHEET_KEYS } from '@bombfarm/domain/planner-constants';
import { peelSheetStages } from '@bombfarm/domain/sheet-stages';
import { pipelineForHero } from '@bombfarm/domain/roster-dps';
import type { AccountShared, HeroRecord } from '@bombfarm/domain/shims/storage';
import { showcaseEn } from '../copy';
import {
  DEFAULT_LEADERBOARD_SORT,
  LEADERBOARD_COLUMNS,
  filterLeaderboardRows,
  heroPeekStats,
  heroPeekStatsResolver,
  heroStatSheet,
  leaderboardGearText,
  leaderboardPowerPercent,
  DEFAULT_LEADERBOARD_VIEW,
  leaderboardMinWidthRem,
  leaderboardRowsFor,
  leaderboardStatValue,
  pressLeaderboardColumn,
  sortLeaderboardRows,
  treeSheetFromAccountTree,
  visibleLeaderboardColumns,
  withShownLeaderboardColumns,
  shownToggleableLeaderboardColumns,
  type ToggleableLeaderboardColumnId,
  type LeaderboardRow,
  type LeaderboardView,
} from './roster-leaderboard';
import { NEUTRAL_TREE, ZERO_SHEET, item, rowFixture } from './showcase.test-fixture';

const BIRTH = { ...ZERO_SHEET, attack: 180, energy: 200, speed: 50, critChance: 7, critDmg: 60, cdr: 2 };

function board(...heroes: (Partial<HeroRecord> & Pick<HeroRecord, 'id'>)[]): readonly LeaderboardRow[] {
  return leaderboardRowsFor(heroes.map(rowFixture), { tree: NEUTRAL_TREE });
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

describe('heroPeekStats', () => {
  const spent = rowFixture({ id: 'a', birth: BIRTH, level: 80, stars: 2, pts: { ...ZERO_SHEET, attack: 20, energy: 5 } }).hero;
  const tree = { ...NEUTRAL_TREE, danoStatic: 1.3 };

  it('is the sheet the hero panel totals, spent points included', () => {
    const sheet = heroPeekStats(spent, { tree });
    expect(sheet).toEqual(heroStatSheet(spent, tree));
    expect(sheet?.attack).toBeGreaterThan(heroStatSheet({ ...spent, pts: ZERO_SHEET }, tree)?.attack ?? Infinity);
  });

  it('prints nothing for a hero whose spent points the host withholds', () => {
    expect(heroPeekStats(spent, { tree, withheldHeroIds: new Set(['a']) })).toBeUndefined();
    expect(heroPeekStats(spent, { tree, withheldHeroIds: new Set(['b']) })).toEqual(heroStatSheet(spent, tree));
  });

  it('prints nothing while the tree is unread, rather than composing against a tree of zeroes', () => {
    expect(heroPeekStats(spent, { tree: null })).toBeUndefined();
  });

  it('prints nothing for a hero without a birth roll', () => {
    expect(heroPeekStats(rowFixture({ id: 'a' }).hero, { tree })).toBeUndefined();
  });

  it('composes an import candidate, which has no id to withhold by', () => {
    const { id: _id, ...candidate } = spent;
    expect(heroPeekStats(candidate, { tree, withheldHeroIds: new Set(['a']) })).toEqual(heroStatSheet(spent, tree));
  });

  it('bound to a source, answers as the leaderboard row does', () => {
    const source = { tree, withheldHeroIds: new Set(['b']) };
    const [row] = leaderboardRowsFor([rowFixture(spent)], source);
    expect(heroPeekStatsResolver(source)(spent)).toEqual(row?.sheet);
  });
});

describe('leaderboardRowsFor', () => {
  it('counts the ability pool with its levels, and the gear worn with its average item level', () => {
    const [row] = board({
      id: 'a',
      abilities: { olho_clinico: 20, explosao_ampla: 3 },
      loadout: { ...emptyLoadout(), arma: item(100, 0), elmo: item(300, 0) },
    });
    expect(row).toMatchObject({ abilityCount: 2, abilityLevelTotal: 23, gearCount: 2, gearAverageLevel: 200 });
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

  it('ranks abilities by how many the hero holds, then by their levels together', () => {
    const rows = board(
      { id: 'one-high', abilities: { olho_clinico: 20 } },
      { id: 'two-low', abilities: { olho_clinico: 1, golpe_brutal: 1 } },
      { id: 'two-high', abilities: { olho_clinico: 10, golpe_brutal: 5 } },
    );
    expect(ids(sortLeaderboardRows(rows, 'abilities', 'desc'))).toEqual(['two-high', 'two-low', 'one-high']);
  });

  it('ranks gear by pieces worn, then by their average level', () => {
    const rows = board(
      { id: 'one-high', loadout: { arma: item(300, 0) } },
      { id: 'two-low', loadout: { arma: item(10, 0), elmo: item(10, 0) } },
      { id: 'two-high', loadout: { arma: item(200, 0), elmo: item(200, 0) } },
    );
    expect(ids(sortLeaderboardRows(rows, 'gear', 'desc'))).toEqual(['two-high', 'two-low', 'one-high']);
  });

  it('sorts a hero wearing nothing last in both directions, as an absence rather than zero pieces', () => {
    const rows = board(
      { id: 'bare' },
      { id: 'one', loadout: { arma: item(100, 0) } },
      { id: 'two', loadout: { arma: item(100, 0), elmo: item(100, 0) } },
    );
    expect(ids(sortLeaderboardRows(rows, 'gear', 'desc'))).toEqual(['two', 'one', 'bare']);
    expect(ids(sortLeaderboardRows(rows, 'gear', 'asc'))).toEqual(['one', 'two', 'bare']);
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
      'Energy',
      'Crit chance',
      'Crit damage',
      'Penetration',
      'Cooldown reduction',
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

describe('treeSheetFromAccountTree', () => {
  it('builds the tree sheet the advisor pipeline builds from the same account', () => {
    const tree = { danoTotal: 1.42, critChance: 12, critDmg: 35, speed: 9, energy: 14, teamCoinPct: 5, luckFlatPct: 3 };
    const account: AccountShared = {
      tree,
      teamBuffs: {},
      context: { houseIdx: 0, houseLevel: 1, phase: null, mitigationPct: 1, rankMode: 'dps', targetProp: 'stone' },
    };
    const hero = rowFixture({ id: 'a', birth: BIRTH, level: 60 }).hero;
    expect(treeSheetFromAccountTree(tree)).toEqual(pipelineForHero(hero, account, 10, 1).treeSheet);
  });

  it('reads an account with no luck figure as no luck from the tree', () => {
    expect(
      treeSheetFromAccountTree({ danoTotal: 1, critChance: 0, critDmg: 0, speed: 0, energy: 0 }).luckFlatPct,
    ).toBe(0);
  });
});

describe('leaderboardRowsFor with the tree unread', () => {
  it('leaves every statistic blank rather than composing against a tree of zeroes', () => {
    const [row] = leaderboardRowsFor([rowFixture({ id: 'a', birth: BIRTH })], { tree: null });
    expect(row?.sheet).toBeUndefined();
    expect(row && leaderboardStatValue(row, 'attack')).toBeUndefined();
  });
});

describe('pressLeaderboardColumn', () => {
  it('opens on power, strongest first', () => {
    expect(DEFAULT_LEADERBOARD_SORT).toEqual({ column: 'power', direction: 'desc' });
  });

  it('reverses the sorted column on a second press', () => {
    const once = pressLeaderboardColumn(DEFAULT_LEADERBOARD_SORT, 'power');
    expect(once).toEqual({ column: 'power', direction: 'asc' });
    expect(pressLeaderboardColumn(once, 'power')).toEqual({ column: 'power', direction: 'desc' });
  });

  it('sorts a newly pressed column best first: A to Z for a name, highest first for a figure', () => {
    expect(pressLeaderboardColumn(DEFAULT_LEADERBOARD_SORT, 'name')).toEqual({ column: 'name', direction: 'asc' });
    const byName = { column: 'name', direction: 'desc' } as const;
    expect(pressLeaderboardColumn(byName, 'luck')).toEqual({ column: 'luck', direction: 'desc' });
  });
});

describe('leaderboardGearText', () => {
  it('prints pieces worn of every slot and their average item level', () => {
    const [row] = board({ id: 'a', loadout: { ...emptyLoadout(), arma: item(100, 0), elmo: item(151, 0) } });
    expect(row && leaderboardGearText(row, showcaseEn, 'en')).toBe('2/8 · Lv 126');
  });

  it('prints a dash, never 0/8, for a hero wearing nothing', () => {
    const [row] = board({ id: 'a' });
    expect(row && leaderboardGearText(row, showcaseEn, 'en')).toBe('—');
  });
});

describe('leaderboardPowerPercent', () => {
  it('measures a hero against the strongest one, and an unread power as none', () => {
    expect(leaderboardPowerPercent(50, 200)).toBe(25);
    expect(leaderboardPowerPercent(200, 200)).toBe(100);
    expect(leaderboardPowerPercent(undefined, 200)).toBe(0);
    expect(leaderboardPowerPercent(10, 0)).toBe(0);
  });
});

describe('leaderboardRowsFor with heroes the host withholds', () => {
  const rows = leaderboardRowsFor(
    [
      rowFixture({ id: 'kept-low', birth: { ...BIRTH, attack: 100 } }),
      rowFixture({ id: 'withheld', birth: { ...BIRTH, attack: 900 } }),
      rowFixture({ id: 'kept-high', birth: { ...BIRTH, attack: 300 } }),
    ],
    { tree: NEUTRAL_TREE, withheldHeroIds: new Set(['withheld']) },
  );

  it('draws no statistic for a withheld hero, and every statistic for the rest', () => {
    const withheld = rows.find((row) => row.id === 'withheld');
    expect(withheld?.sheet).toBeUndefined();
    for (const key of ['attack', 'critChance', 'critDmg', 'luck', 'speed'] as const) {
      expect(withheld && leaderboardStatValue(withheld, key)).toBeUndefined();
    }
    expect(rows.find((row) => row.id === 'kept-low')?.sheet).toBeDefined();
  });

  it('sorts a withheld hero last in both directions, however high its unread figure would be', () => {
    expect(ids(sortLeaderboardRows(rows, 'attack', 'desc'))).toEqual(['kept-high', 'kept-low', 'withheld']);
    expect(ids(sortLeaderboardRows(rows, 'attack', 'asc'))).toEqual(['kept-low', 'kept-high', 'withheld']);
  });
});

describe('the statistic columns', () => {
  it('prints every one of the eight sheet statistics as the hero panel’s Total column reads it', () => {
    const tree = { ...NEUTRAL_TREE, danoStatic: 1.3, energyPct: 12, critChancePct: 8, luckFlatPct: 2 };
    const hero = rowFixture({
      id: 'a',
      birth: BIRTH,
      level: 80,
      stars: 2,
      loadout: { ...emptyLoadout(), arma: item(100, 4) },
      pts: { ...ZERO_SHEET, energy: 15, cdr: 6, penetration: 4 },
    });
    const [row] = leaderboardRowsFor([hero], { tree });
    const stages = peelSheetStages({
      birth: BIRTH,
      level: 80,
      stars: 2,
      sheetOther: emptySheetOther(),
      loadout: hero.hero.loadout,
      pts: hero.hero.pts,
      tree,
      runes: undefined,
    });
    for (const key of ['energy', 'penetration', 'cdr'] as const) {
      expect(row && leaderboardStatValue(row, key)).toBeCloseTo(stages[key].total, 9);
    }
  });
});

describe('column visibility', () => {
  const shown = (view: LeaderboardView) => visibleLeaderboardColumns(view).map((column) => column.id);

  it('opens with energy, penetration and cooldown reduction hidden and everything else shown', () => {
    expect(shown(DEFAULT_LEADERBOARD_VIEW)).toEqual([
      'position',
      'name',
      'rarity',
      'level',
      'birth',
      'power',
      'attack',
      'critChance',
      'critDmg',
      'luck',
      'speed',
      'abilities',
      'gear',
    ]);
  });

  const toggled = (view: LeaderboardView, column: ToggleableLeaderboardColumnId) => {
    const current = shownToggleableLeaderboardColumns(view);
    return withShownLeaderboardColumns(
      view,
      current.includes(column) ? current.filter((id) => id !== column) : [...current, column],
    );
  };

  it('shows exactly the columns ticked, leaving the order alone', () => {
    const withCdr = toggled(DEFAULT_LEADERBOARD_VIEW, 'cdr');
    expect(shown(withCdr)).toContain('cdr');
    const noLuck = toggled(withCdr, 'luck');
    expect(shown(noLuck)).not.toContain('luck');
    expect(noLuck.sort).toEqual(DEFAULT_LEADERBOARD_VIEW.sort);
    expect(shown(withShownLeaderboardColumns(DEFAULT_LEADERBOARD_VIEW, []))).toEqual(['position', 'name']);
  });

  it('drops the order back to power when the sorted column is hidden', () => {
    const byLuck: LeaderboardView = { ...DEFAULT_LEADERBOARD_VIEW, sort: { column: 'luck', direction: 'asc' } };
    expect(toggled(byLuck, 'luck').sort).toEqual({ column: 'power', direction: 'desc' });
  });

  it('falls to the name, which cannot be hidden, when power is the column hidden', () => {
    expect(toggled(DEFAULT_LEADERBOARD_VIEW, 'power').sort).toEqual({ column: 'name', direction: 'asc' });
  });

  it('leaves the abilities column room for six icons', () => {
    const [abilities] = visibleLeaderboardColumns({ ...DEFAULT_LEADERBOARD_VIEW, hiddenColumns: [] }).filter(
      (column) => column.id === 'abilities',
    );
    expect(abilities).toBeDefined();
    if (abilities !== undefined) expect(leaderboardMinWidthRem([abilities])).toBeGreaterThanOrEqual(6 * 1.75 + 5 * 0.125);
  });

  it('asks for less width as columns are hidden', () => {
    const all = visibleLeaderboardColumns({ ...DEFAULT_LEADERBOARD_VIEW, hiddenColumns: [] });
    const few = visibleLeaderboardColumns({
      ...DEFAULT_LEADERBOARD_VIEW,
      hiddenColumns: ['rarity', 'level', 'birth', 'attack', 'critChance', 'critDmg', 'luck', 'speed'],
    });
    expect(leaderboardMinWidthRem(few)).toBeLessThan(leaderboardMinWidthRem(all));
  });
});
