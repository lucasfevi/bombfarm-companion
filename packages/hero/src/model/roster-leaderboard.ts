import { composeSheetFromBirth, type TreeSheetTotals } from '@bombfarm/domain/birth-sheet';
import { SLOTS, emptySheetOther, type SheetStats } from '@bombfarm/domain/gear';
import { heroAbilitySlotsUsed } from '@bombfarm/domain/hero-abilities';
import { abilityMods } from '@bombfarm/domain/model';
import { RARITIES } from '@bombfarm/domain/planner-constants';
import type { HeroRecord, TreeState } from '@bombfarm/domain/shims/storage';
import { formatNumber, type Lang } from '@bombfarm/ui';
import { sub, type ShowcaseCopy } from '../copy';
import { gradePlacementFor } from './birth-roll-panel';
import { equippedGearAverages, isSquadHero } from './roster-summary';
import type { RosterHeroRow } from './roster-rows';

/**
 * The statistic sheet the hero panel's Total column prints: birth composed through level, stars,
 * abilities, gear, points, the account's skill tree and the hero's runes. Uncapped, as that
 * column is. `undefined` for a hero without a birth roll, where the panel has no Total either.
 */
export function heroStatSheet(hero: HeroRecord, tree: TreeSheetTotals): SheetStats | undefined {
  if (hero.birth === undefined) return undefined;
  const mods = abilityMods(hero.abilities);
  return composeSheetFromBirth({
    birth: hero.birth,
    level: hero.level,
    stars: hero.stars,
    sheetOther: {
      ...emptySheetOther(),
      critChanceFlat: mods.sheetCritChanceFlat,
      penetration: mods.sheetPenetrationFlat,
      critDmgFlat: mods.sheetCritDmgFlat,
    },
    loadout: hero.loadout,
    pts: hero.pts,
    tree,
    runes: hero.runes,
  });
}

/** The account's skill-tree totals as either host holds them. */
export type AccountTreeTotals = Pick<TreeState, 'danoTotal' | 'critChance' | 'critDmg' | 'speed' | 'energy'> & {
  readonly luckFlatPct?: number | undefined;
};

/** The same mapping the advisor pipeline makes from an account's tree to its `treeSheet`. */
export function treeSheetFromAccountTree(tree: AccountTreeTotals): TreeSheetTotals {
  return {
    danoStatic: tree.danoTotal,
    energyPct: tree.energy,
    speedPct: tree.speed,
    critChancePct: tree.critChance,
    critDmgPct: tree.critDmg,
    luckFlatPct: tree.luckFlatPct ?? 0,
  };
}

export type LeaderboardRow = RosterHeroRow & {
  readonly sheet: SheetStats | undefined;
  /** The game's letter where it recognises one, ours where it does not — as the birth panel reads. */
  readonly gradeLetter: string | undefined;
  readonly abilityCount: number;
  readonly gearCount: number;
  readonly gearAverageLevel: number | undefined;
};

/** `tree` is `null` while the account's skill tree is unread: every statistic is then absent,
 *  never composed against a tree of zeroes. */
export function leaderboardRowsFor(
  rows: readonly RosterHeroRow[],
  tree: TreeSheetTotals | null,
): readonly LeaderboardRow[] {
  return rows.map((row) => {
    const gear = equippedGearAverages([row.hero]);
    return {
      ...row,
      sheet: tree === null ? undefined : heroStatSheet(row.hero, tree),
      gradeLetter: gradePlacementFor(row.report)?.railLetter,
      abilityCount: heroAbilitySlotsUsed(row.hero.abilities),
      gearCount: gear.itemCount,
      gearAverageLevel: gear.averageLevel,
    };
  });
}

export const LEADERBOARD_COLUMN_IDS = [
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
] as const;

export type LeaderboardColumnId = (typeof LEADERBOARD_COLUMN_IDS)[number];
export type LeaderboardSortDirection = 'asc' | 'desc';

export type LeaderboardColumn = {
  readonly id: LeaderboardColumnId;
  readonly label: (typeof LABEL_BY_COLUMN)[LeaderboardColumnId];
  /** The position column numbers whatever order the table is in, so there is nothing to sort. */
  readonly sortable: boolean;
  /** Best first on a first press: descending for every figure, A to Z for a name. */
  readonly firstDirection: LeaderboardSortDirection;
};

const LABEL_BY_COLUMN = {
  position: 'columnPosition',
  name: 'columnName',
  rarity: 'columnRarity',
  level: 'columnLevel',
  birth: 'columnBirth',
  power: 'columnPower',
  attack: 'columnAttack',
  critChance: 'columnCritChance',
  critDmg: 'columnCritDmg',
  luck: 'columnLuck',
  speed: 'columnSpeed',
  abilities: 'columnAbilities',
  gear: 'columnGear',
} as const satisfies Record<LeaderboardColumnId, keyof ShowcaseCopy>;

export const LEADERBOARD_COLUMNS: readonly LeaderboardColumn[] = LEADERBOARD_COLUMN_IDS.map((id) => ({
  id,
  label: LABEL_BY_COLUMN[id],
  sortable: id !== 'position',
  firstDirection: id === 'name' ? 'asc' : 'desc',
}));

export type SortableLeaderboardColumnId = Exclude<LeaderboardColumnId, 'position'>;

export const LEADERBOARD_STAT_COLUMN_IDS = ['attack', 'critChance', 'critDmg', 'luck', 'speed'] as const;
export type LeaderboardStatColumnId = (typeof LEADERBOARD_STAT_COLUMN_IDS)[number];

export function isLeaderboardStatColumn(column: LeaderboardColumnId): column is LeaderboardStatColumnId {
  return (LEADERBOARD_STAT_COLUMN_IDS as readonly string[]).includes(column);
}

/**
 * The figure a statistic cell prints and sorts by — the uncapped sheet total, as the hero panel's
 * Total column reads, so crit chance can pass 100%. Every cell and the sort read it here: reading
 * `gameSheetView(row.sheet)[column]` instead would show the game's capped figures everywhere.
 */
export function leaderboardStatValue(row: LeaderboardRow, column: LeaderboardStatColumnId): number | undefined {
  return row.sheet?.[column];
}

export type LeaderboardSort = {
  readonly column: SortableLeaderboardColumnId;
  readonly direction: LeaderboardSortDirection;
};

export const DEFAULT_LEADERBOARD_SORT: LeaderboardSort = { column: 'power', direction: 'desc' };

/** A second press on the sorted column reverses it; a press on another sorts it best first. */
export function pressLeaderboardColumn(current: LeaderboardSort, column: SortableLeaderboardColumnId): LeaderboardSort {
  if (current.column === column) {
    return { column, direction: current.direction === 'asc' ? 'desc' : 'asc' };
  }
  const firstDirection = LEADERBOARD_COLUMNS.find((entry) => entry.id === column)?.firstDirection ?? 'desc';
  return { column, direction: firstDirection };
}

/** A lexicographic key: gear ranks by pieces worn, then by how high they are. */
function figuresFor(row: LeaderboardRow, column: SortableLeaderboardColumnId): readonly number[] | undefined {
  const { hero } = row;
  switch (column) {
    case 'name':
      return undefined;
    case 'rarity': {
      const index = RARITIES.indexOf(hero.rarity);
      return index < 0 ? undefined : [index];
    }
    case 'level':
      return [hero.level];
    case 'birth':
      return row.report === undefined ? undefined : [row.report.mean];
    case 'power':
      return hero.power == null ? undefined : [hero.power];
    case 'attack':
    case 'critChance':
    case 'critDmg':
    case 'luck':
    case 'speed': {
      const value = leaderboardStatValue(row, column);
      return value === undefined ? undefined : [value];
    }
    case 'abilities':
      return [row.abilityCount];
    case 'gear':
      return [row.gearCount, row.gearAverageLevel ?? 0];
  }
}

function compareFigures(left: readonly number[], right: readonly number[]): number {
  for (let index = 0; index < left.length; index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

function compareNames(left: LeaderboardRow, right: LeaderboardRow): number {
  return left.hero.name.localeCompare(right.hero.name, undefined, { sensitivity: 'base' });
}

/**
 * Total, so a re-read roster lists in the same order: equal figures fall back to the name, then
 * the id. A figure the read did not carry sorts last in both directions — it is an absence, not a
 * small number.
 */
export function sortLeaderboardRows(
  rows: readonly LeaderboardRow[],
  column: SortableLeaderboardColumnId,
  direction: LeaderboardSortDirection,
): readonly LeaderboardRow[] {
  const sign = direction === 'asc' ? 1 : -1;
  const tieBreak = (left: LeaderboardRow, right: LeaderboardRow) =>
    compareNames(left, right) || left.id.localeCompare(right.id);
  return [...rows].sort((left, right) => {
    if (column === 'name') return sign * tieBreak(left, right);
    const a = figuresFor(left, column);
    const b = figuresFor(right, column);
    if (a === undefined && b === undefined) return tieBreak(left, right);
    if (a === undefined) return 1;
    if (b === undefined) return -1;
    return sign * compareFigures(a, b) || tieBreak(left, right);
  });
}

export const LEADERBOARD_FILTERS = ['everyone', 'squad', 'bench'] as const;
export type LeaderboardFilter = (typeof LEADERBOARD_FILTERS)[number];

export function filterLeaderboardRows<Row extends { readonly hero: HeroRecord }>(
  rows: readonly Row[],
  filter: LeaderboardFilter,
): readonly Row[] {
  if (filter === 'everyone') return rows;
  const wantSquad = filter === 'squad';
  return rows.filter((row) => isSquadHero(row.hero) === wantSquad);
}

export const LEADERBOARD_FILTER_LABELS = {
  everyone: 'filterEveryone',
  squad: 'filterSquad',
  bench: 'filterBench',
} as const satisfies Record<LeaderboardFilter, keyof ShowcaseCopy>;

export type LeaderboardView = {
  readonly sort: LeaderboardSort;
  readonly filter: LeaderboardFilter;
};

export const DEFAULT_LEADERBOARD_VIEW: LeaderboardView = { sort: DEFAULT_LEADERBOARD_SORT, filter: 'everyone' };

const NOTHING_WORN = '—';

/** "8/8 · Lv 124" — pieces worn of every slot, and their average item level as a whole number. */
export function leaderboardGearText(row: LeaderboardRow, copy: ShowcaseCopy, lang: Lang): string {
  if (row.gearCount === 0 || row.gearAverageLevel === undefined) return NOTHING_WORN;
  return sub(copy.tableGear, {
    count: row.gearCount,
    slots: SLOTS.length,
    level: formatNumber(row.gearAverageLevel, lang, 0),
  });
}

/** How much of the strongest hero's power this one has, 0–100, for the bar under the figure. */
export function leaderboardPowerPercent(power: number | null | undefined, topPower: number): number {
  if (power == null || topPower <= 0) return 0;
  return Math.max(0, Math.min(100, (power / topPower) * 100));
}
