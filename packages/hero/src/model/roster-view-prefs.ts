/**
 * How a player last looked at their roster — the presentation, its order and narrowing, and the
 * board's and table's own switches — so a host can bring them back on the next visit.
 *
 * The reader here is a stored value from any earlier build, so every field is read on its own and
 * falls back to its own default: one unrecognised field never costs the player the others.
 */
import { ABILITIES } from '@bombfarm/domain/model';
import { heroAbilityIds } from '@bombfarm/domain/hero-abilities';
import {
  DEFAULT_ROSTER_BOARD_SORT,
  EMPTY_ROSTER_BOARD_FILTER,
  ROSTER_BOARD_SORT_KEYS,
  type RosterBoardFilter,
  type RosterBoardSort,
} from './roster-board-order';
import {
  DEFAULT_LEADERBOARD_VIEW,
  LEADERBOARD_COLUMN_IDS,
  LEADERBOARD_FILTERS,
  TOGGLEABLE_LEADERBOARD_COLUMN_IDS,
  isToggleableLeaderboardColumn,
  withShownLeaderboardColumns,
  type LeaderboardSort,
  type LeaderboardView,
} from './roster-leaderboard';
import type { RosterHeroRow } from './roster-rows';
import { ROSTER_VIEW_MODES, type RosterViewMode } from './roster-view-mode';
import { DEFAULT_SHOWCASE_VIEW, type ShowcaseView } from './showcase-card';

export type RosterViewPrefs = {
  readonly viewMode: RosterViewMode;
  readonly sort: RosterBoardSort;
  readonly filter: RosterBoardFilter;
  readonly leaderboardView: LeaderboardView;
  readonly showcaseView: ShowcaseView;
};

export const DEFAULT_ROSTER_VIEW_PREFS: RosterViewPrefs = {
  viewMode: 'list',
  sort: DEFAULT_ROSTER_BOARD_SORT,
  filter: EMPTY_ROSTER_BOARD_FILTER,
  leaderboardView: DEFAULT_LEADERBOARD_VIEW,
  showcaseView: DEFAULT_SHOWCASE_VIEW,
};

type Raw = Record<string, unknown>;

function asRecord(value: unknown): Raw | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Raw) : null;
}

function isDirection(value: unknown): value is 'asc' | 'desc' {
  return value === 'asc' || value === 'desc';
}

function readViewMode(value: unknown): RosterViewMode {
  return ROSTER_VIEW_MODES.find((mode) => mode === value) ?? DEFAULT_ROSTER_VIEW_PREFS.viewMode;
}

function readSort(value: unknown): RosterBoardSort {
  const raw = asRecord(value);
  const key = ROSTER_BOARD_SORT_KEYS.find((candidate) => candidate === raw?.key);
  if (raw === null || key === undefined || !isDirection(raw.direction)) return DEFAULT_ROSTER_BOARD_SORT;
  return { key, direction: raw.direction };
}

const ABILITY_IDS = new Set(ABILITIES.map((ability) => ability.id));

function readFilter(value: unknown): RosterBoardFilter {
  const raw = asRecord(value);
  if (raw === null) return EMPTY_ROSTER_BOARD_FILTER;
  const abilityIds = Array.isArray(raw.abilityIds)
    ? [...new Set(raw.abilityIds.filter((id): id is string => typeof id === 'string' && ABILITY_IDS.has(id)))]
    : [];
  return { abilityIds, activeOnly: raw.activeOnly === true };
}

function readLeaderboardSort(value: unknown): LeaderboardSort {
  const raw = asRecord(value);
  const column = LEADERBOARD_COLUMN_IDS.find((id) => id !== 'position' && id === raw?.column);
  if (raw === null || column === undefined || column === 'position' || !isDirection(raw.direction)) {
    return DEFAULT_LEADERBOARD_VIEW.sort;
  }
  return { column, direction: raw.direction };
}

function readLeaderboardView(value: unknown): LeaderboardView {
  const raw = asRecord(value);
  if (raw === null) return DEFAULT_LEADERBOARD_VIEW;
  const filter = LEADERBOARD_FILTERS.find((candidate) => candidate === raw.filter) ?? DEFAULT_LEADERBOARD_VIEW.filter;
  const hidden = Array.isArray(raw.hiddenColumns)
    ? raw.hiddenColumns.filter((id): id is string => typeof id === 'string' && isToggleableLeaderboardColumn(id))
    : DEFAULT_LEADERBOARD_VIEW.hiddenColumns;
  const shown = TOGGLEABLE_LEADERBOARD_COLUMN_IDS.filter((id) => !hidden.includes(id));
  // Through the table's own rule, so a stored order by a column that is also stored hidden reads
  // back the way hiding that column would have left it.
  return withShownLeaderboardColumns({ ...DEFAULT_LEADERBOARD_VIEW, sort: readLeaderboardSort(raw.sort), filter }, shown);
}

function readShowcaseView(value: unknown): ShowcaseView {
  const raw = asRecord(value);
  return raw === null ? DEFAULT_SHOWCASE_VIEW : { showLevels: raw.showLevels === true };
}

export function normalizeRosterViewPrefs(value: unknown): RosterViewPrefs {
  const raw = asRecord(value);
  if (raw === null) return DEFAULT_ROSTER_VIEW_PREFS;
  return {
    viewMode: readViewMode(raw.viewMode),
    sort: readSort(raw.sort),
    filter: readFilter(raw.filter),
    leaderboardView: readLeaderboardView(raw.leaderboardView),
    showcaseView: readShowcaseView(raw.showcaseView),
  };
}

/**
 * The filter with every ability this roster owns none of taken out.
 *
 * A remembered filter can outlive the heroes it was chosen against — a hero sold, another account
 * loaded — and the ability strip refuses a press on a tile nobody owns, so a stale selection would
 * empty the roster with no way to take it back. Returns the same filter when nothing is dropped.
 */
export function ownedRosterBoardFilter(
  rows: readonly RosterHeroRow[],
  filter: RosterBoardFilter,
): RosterBoardFilter {
  if (filter.abilityIds.length === 0) return filter;
  const owned = new Set<string>();
  for (const row of rows) {
    for (const id of heroAbilityIds(row.hero.abilities)) owned.add(id);
  }
  const abilityIds = filter.abilityIds.filter((id) => owned.has(id));
  return abilityIds.length === filter.abilityIds.length ? filter : { ...filter, abilityIds };
}
