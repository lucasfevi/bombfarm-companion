import { composeSheetFromBirth, type TreeSheetTotals } from '@bombfarm/domain/birth-sheet';
import { SLOTS, emptySheetOther, type SheetStats } from '@bombfarm/domain/gear';
import { heroAbilityIconEntries } from '@bombfarm/domain/hero-abilities';
import { abilityMods } from '@bombfarm/domain/model';
import { RARITIES } from '@bombfarm/domain/planner-constants';
import type { HeroRecord, TreeState } from '@bombfarm/domain/shims/storage';
import { formatNumber, type Lang } from '@bombfarm/ui';
import { sub, type ShowcaseCopy } from '../copy';
import { gradePlacementFor } from './birth-roll-panel';
import { equippedGearAverages, isSquadHero } from './roster-summary';
import type { RosterHeroRow } from './roster-rows';

/** What composing a hero's sheet reads — a whole record, or an import candidate without an id yet. */
export type StatSheetHero = Pick<HeroRecord, 'birth' | 'level' | 'stars' | 'abilities' | 'loadout' | 'pts' | 'runes'> & {
  readonly id?: string | undefined;
};

/**
 * The statistic sheet the hero panel's Total column prints: birth composed through level, stars,
 * abilities, gear, points, the account's skill tree and the hero's runes. Uncapped, as that
 * column is. `undefined` for a hero without a birth roll, where the panel has no Total either.
 */
export function heroStatSheet(hero: StatSheetHero, tree: TreeSheetTotals): SheetStats | undefined {
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
  readonly abilityLevelTotal: number;
  readonly gearCount: number;
  readonly gearAverageLevel: number | undefined;
};

/** Which heroes' statistics the host will not draw, and the tree the rest are composed against. */
export type HeroStatSource = {
  /** `null` while the account's skill tree is unread: every statistic is then absent, never
   *  composed against a tree of zeroes. */
  readonly tree: TreeSheetTotals | null;
  /** Heroes whose statistics the host withholds — a hero whose spent points were not read would
   *  otherwise be drawn as if it had spent none. */
  readonly withheldHeroIds?: ReadonlySet<string> | undefined;
};

export type LeaderboardStatSource = HeroStatSource;

/**
 * The sheet a hero's hover card prints — the detail panel's Total, or nothing where that panel
 * prints nothing: no tree read yet, no birth roll, or spent points the host could not read.
 * Never the import-time zero-points sheet, which would print every spent point as unspent.
 */
export function heroPeekStats(hero: StatSheetHero, { tree, withheldHeroIds }: HeroStatSource): SheetStats | undefined {
  if (tree === null) return undefined;
  if (hero.id !== undefined && withheldHeroIds?.has(hero.id) === true) return undefined;
  return heroStatSheet(hero, tree);
}

/** {@link heroPeekStats} bound to one source, as the hover cards' provider takes it. */
export function heroPeekStatsResolver(source: HeroStatSource): (hero: StatSheetHero) => SheetStats | undefined {
  return (hero) => heroPeekStats(hero, source);
}

export function leaderboardRowsFor(rows: readonly RosterHeroRow[], source: HeroStatSource): readonly LeaderboardRow[] {
  return rows.map((row) => {
    const gear = equippedGearAverages([row.hero]);
    const abilities = heroAbilityIconEntries(row.hero.abilities);
    return {
      ...row,
      sheet: heroPeekStats(row.hero, source),
      gradeLetter: gradePlacementFor(row.report)?.railLetter,
      abilityCount: abilities.length,
      abilityLevelTotal: abilities.reduce((total, ability) => total + ability.level, 0),
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
  'energy',
  'critChance',
  'critDmg',
  'penetration',
  'cdr',
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
  energy: 'columnEnergy',
  critChance: 'columnCritChance',
  critDmg: 'columnCritDmg',
  penetration: 'columnPenetration',
  cdr: 'columnCdr',
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

export const LEADERBOARD_STAT_COLUMN_IDS = [
  'attack',
  'energy',
  'critChance',
  'critDmg',
  'penetration',
  'cdr',
  'luck',
  'speed',
] as const;
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

/** A lexicographic key: abilities and gear rank by how many, then by how high they are. */
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
    case 'energy':
    case 'critChance':
    case 'critDmg':
    case 'penetration':
    case 'cdr':
    case 'luck':
    case 'speed': {
      const value = leaderboardStatValue(row, column);
      return value === undefined ? undefined : [value];
    }
    case 'abilities':
      return [row.abilityCount, row.abilityLevelTotal];
    case 'gear':
      return row.gearCount === 0 || row.gearAverageLevel === undefined
        ? undefined
        : [row.gearCount, row.gearAverageLevel];
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

/** The position and the hero say which row is which, so they cannot be hidden. */
export type ToggleableLeaderboardColumnId = Exclude<LeaderboardColumnId, 'position' | 'name'>;

export const TOGGLEABLE_LEADERBOARD_COLUMN_IDS: readonly ToggleableLeaderboardColumnId[] = LEADERBOARD_COLUMN_IDS.filter(
  (id): id is ToggleableLeaderboardColumnId => id !== 'position' && id !== 'name',
);

export type LeaderboardView = {
  readonly sort: LeaderboardSort;
  readonly filter: LeaderboardFilter;
  readonly hiddenColumns: readonly ToggleableLeaderboardColumnId[];
};

/** The three statistics nobody ranks a roster by start hidden; the rest of the sheet shows. */
export const DEFAULT_HIDDEN_LEADERBOARD_COLUMNS: readonly ToggleableLeaderboardColumnId[] = [
  'energy',
  'penetration',
  'cdr',
];

export const DEFAULT_LEADERBOARD_VIEW: LeaderboardView = {
  sort: DEFAULT_LEADERBOARD_SORT,
  filter: 'everyone',
  hiddenColumns: DEFAULT_HIDDEN_LEADERBOARD_COLUMNS,
};

const NAME_SORT: LeaderboardSort = { column: 'name', direction: 'asc' };

export function isLeaderboardColumnShown(view: LeaderboardView, column: LeaderboardColumnId): boolean {
  return !(view.hiddenColumns as readonly LeaderboardColumnId[]).includes(column);
}

export function visibleLeaderboardColumns(view: LeaderboardView): readonly LeaderboardColumn[] {
  return LEADERBOARD_COLUMNS.filter((column) => isLeaderboardColumnShown(view, column.id));
}

/**
 * Shows exactly the toggleable columns listed and hides the rest. Hiding the column the table is
 * sorted by drops the order back to the default — an order by a column nobody can see is not one a
 * reader can follow — and to the hero's name when the default's own column is hidden too.
 */
export function withShownLeaderboardColumns(
  view: LeaderboardView,
  shown: readonly ToggleableLeaderboardColumnId[],
): LeaderboardView {
  const hiddenColumns = TOGGLEABLE_LEADERBOARD_COLUMN_IDS.filter((id) => !shown.includes(id));
  const next = { ...view, hiddenColumns };
  if (isLeaderboardColumnShown(next, view.sort.column)) return next;
  const sort = isLeaderboardColumnShown(next, DEFAULT_LEADERBOARD_SORT.column) ? DEFAULT_LEADERBOARD_SORT : NAME_SORT;
  return { ...next, sort };
}

export function shownToggleableLeaderboardColumns(view: LeaderboardView): readonly ToggleableLeaderboardColumnId[] {
  return TOGGLEABLE_LEADERBOARD_COLUMN_IDS.filter((id) => isLeaderboardColumnShown(view, id));
}

export function isToggleableLeaderboardColumn(id: string): id is ToggleableLeaderboardColumnId {
  return (TOGGLEABLE_LEADERBOARD_COLUMN_IDS as readonly string[]).includes(id);
}

/** Six 1.75rem icons with their 0.125rem gaps, and the cell's own padding either side. */
const ABILITIES_COLUMN_MIN_REM = 12.5;

/** Enough room per column that no header or figure is squeezed; the frame scrolls past this. */
const COLUMN_MIN_REM: Record<LeaderboardColumnId, number> = {
  position: 2,
  name: 9,
  rarity: 5,
  level: 3.5,
  birth: 5,
  power: 9,
  attack: 5.5,
  energy: 4.5,
  critChance: 5,
  critDmg: 5.5,
  penetration: 5.5,
  cdr: 7,
  luck: 4,
  speed: 4,
  abilities: ABILITIES_COLUMN_MIN_REM,
  gear: 5.5,
};

export function leaderboardMinWidthRem(columns: readonly LeaderboardColumn[]): number {
  return columns.reduce((total, column) => total + COLUMN_MIN_REM[column.id], 0);
}

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
