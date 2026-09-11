/**
 * How a roster surface orders and narrows its heroes, in either presentation.
 *
 * One toolbar governs both: whichever question is being asked — which heroes are strongest, which
 * are furthest levelled, which own a given ability — is asked of the list and the board alike, so
 * switching between them never changes what is on screen, only its shape.
 *
 * Every comparator is TOTAL. Roll quality already had this rule for its own reason — heroes tie
 * on it constantly — and it applies to all six: rarity has six values across a roster of twenty,
 * stars has four, so ties are the common case and an order that left them to the array's own
 * order would reshuffle the board on every account read.
 */
import { ABILITIES } from '@bombfarm/domain/model';
import { RARITIES } from '@bombfarm/domain/planner-constants';
import { LETTER_BANDS } from '@bombfarm/domain/roll-quality';
import { heroAbilityIds } from '@bombfarm/domain/hero-abilities';
import type { RosterHeroRow } from './roster-rows';

export const ROSTER_BOARD_SORT_KEYS = ['roll', 'power', 'level', 'rarity', 'rank', 'stars'] as const;
export type RosterBoardSortKey = (typeof ROSTER_BOARD_SORT_KEYS)[number];
export type RosterBoardSortDirection = 'asc' | 'desc';

export type RosterBoardSort = {
  readonly key: RosterBoardSortKey;
  readonly direction: RosterBoardSortDirection;
};

/** Best first, which is what every one of the six keys means by "descending". */
export const DEFAULT_ROSTER_BOARD_SORT: RosterBoardSort = { key: 'roll', direction: 'desc' };

export type RosterBoardFilter = {
  /** Heroes owning ANY of these. Empty means every hero — never "no hero". */
  readonly abilityIds: readonly string[];
  /** Keep only heroes the account has enabled for battle. */
  readonly activeOnly: boolean;
};

export const EMPTY_ROSTER_BOARD_FILTER: RosterBoardFilter = { abilityIds: [], activeOnly: false };

/**
 * The sortable figure behind one key, or `undefined` when the account has not told us.
 *
 * Absence is not a low value. A hero whose power the read has not carried yet sorts to the END in
 * both directions below, rather than ranking as the weakest hero on the roster — the same reason
 * roll quality reports "not placed" instead of zero.
 */
function figureFor(row: RosterHeroRow, key: RosterBoardSortKey): number | undefined {
  const { hero } = row;
  switch (key) {
    case 'roll':
      return row.report?.mean;
    case 'power':
      return hero.power ?? undefined;
    case 'level':
      return hero.level;
    case 'rarity': {
      const index = RARITIES.indexOf(hero.rarity);
      return index < 0 ? undefined : index;
    }
    case 'rank': {
      const index = LETTER_BANDS.letters.indexOf(hero.rank?.trim() ?? '');
      return index < 0 ? undefined : index;
    }
    case 'stars':
      return hero.stars;
  }
}

export function sortRosterRows(
  rows: readonly RosterHeroRow[],
  sort: RosterBoardSort,
): readonly RosterHeroRow[] {
  const sign = sort.direction === 'asc' ? 1 : -1;
  return [...rows].sort((left, right) => {
    const a = figureFor(left, sort.key);
    const b = figureFor(right, sort.key);
    if (a === undefined && b === undefined) return left.id.localeCompare(right.id);
    // Unknown last in BOTH directions — it is an absence of evidence, not a small number.
    if (a === undefined) return 1;
    if (b === undefined) return -1;
    if (a !== b) return (a - b) * sign;
    return left.id.localeCompare(right.id);
  });
}

export type RosterAbilityFilterOption = {
  readonly id: string;
  /** False when no hero on this roster owns it — shown anyway, so the board says what exists in
   *  the game as well as what you have. */
  readonly owned: boolean;
  readonly selected: boolean;
};

/**
 * Every ability in the game, in catalog order, marked with whether this roster owns it and
 * whether it is currently being filtered on.
 *
 * All of them, not just the owned ones: "which of these do I have none of" is a question about
 * the roster that a list of only what you have cannot answer.
 */
export function abilityFilterOptions(
  rows: readonly RosterHeroRow[],
  selected: readonly string[],
): readonly RosterAbilityFilterOption[] {
  const owned = new Set<string>();
  for (const row of rows) {
    for (const id of heroAbilityIds(row.hero.abilities)) owned.add(id);
  }
  const chosen = new Set(selected);
  return ABILITIES.map((ability) => ({
    id: ability.id,
    owned: owned.has(ability.id),
    selected: chosen.has(ability.id),
  }));
}

/** Adds an ability to the filter, or takes it back out — the board's only filter gesture. */
export function toggleAbilityFilter(
  selected: readonly string[],
  abilityId: string,
): readonly string[] {
  return selected.includes(abilityId)
    ? selected.filter((id) => id !== abilityId)
    : [...selected, abilityId];
}

/**
 * What pressing one tile of the ability strip leaves — the toggle above, except on a tile no hero
 * owns, which changes nothing.
 *
 * The refusal is HERE rather than on the tile because the tile cannot refuse it. An unowned tile
 * is drawn dimmed and marked `disabled`, and the design-system tooltip drops that attribute on
 * purpose: a disabled element receives no hover, and the tooltip naming the ability is the whole
 * reason unowned abilities are shown at all. So the tile stays pressable in the DOM, and without
 * this the press went through — selecting an ability nobody owns, which is a filter that matches
 * no hero and empties the roster to a screen with no way back but the same dimmed tile.
 */
export function pressAbilityFilter(
  selected: readonly string[],
  option: RosterAbilityFilterOption,
): readonly string[] {
  return option.owned ? toggleAbilityFilter(selected, option.id) : selected;
}

/**
 * The rows a filter leaves.
 *
 * Abilities narrow by ANY rather than ALL. A hero owns at most six of twenty, so intersecting two
 * selections almost always answers nothing, which reads as a broken control rather than as a true
 * answer about the roster.
 */
export function filterRosterRows(
  rows: readonly RosterHeroRow[],
  filter: RosterBoardFilter,
): readonly RosterHeroRow[] {
  const wanted = new Set(filter.abilityIds);
  return rows.filter((row) => {
    if (filter.activeOnly && row.hero.battleAllowed === false) return false;
    if (wanted.size === 0) return true;
    return heroAbilityIds(row.hero.abilities).some((id) => wanted.has(id));
  });
}

/** Filter first, then order what survived — both presentations draw exactly this. */
export function rosterRowsShown(
  rows: readonly RosterHeroRow[],
  filter: RosterBoardFilter,
  sort: RosterBoardSort,
): readonly RosterHeroRow[] {
  return sortRosterRows(filterRosterRows(rows, filter), sort);
}
