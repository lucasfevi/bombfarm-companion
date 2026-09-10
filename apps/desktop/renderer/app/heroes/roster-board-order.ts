/**
 * How the card board orders and narrows the roster.
 *
 * The rail has exactly one order — best birth roll first — because it answers "who am I looking
 * at". The board is a comparison surface, so it answers whichever question is being asked: which
 * heroes are strongest, which are furthest levelled, which own a given ability. That is the whole
 * reason these live here and not on the rail.
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
import type { RosterHeroRow } from './hero-roster-order';

export const ROSTER_SORT_KEYS = ['roll', 'power', 'level', 'rarity', 'rank', 'stars'] as const;
export type RosterSortKey = (typeof ROSTER_SORT_KEYS)[number];
export type RosterSortDirection = 'asc' | 'desc';

export type RosterSort = {
  readonly key: RosterSortKey;
  readonly direction: RosterSortDirection;
};

/** Best first, which is what every one of the six keys means by "descending". */
export const DEFAULT_ROSTER_SORT: RosterSort = { key: 'roll', direction: 'desc' };

export type RosterBoardFilter = {
  /** Heroes owning ANY of these. Empty means every hero — never "no hero". */
  readonly abilityIds: readonly string[];
  readonly hideDisabled: boolean;
};

export const EMPTY_ROSTER_FILTER: RosterBoardFilter = { abilityIds: [], hideDisabled: false };

/**
 * The sortable figure behind one key, or `undefined` when the account has not told us.
 *
 * Absence is not a low value. A hero whose power the read has not carried yet sorts to the END in
 * both directions below, rather than ranking as the weakest hero on the roster — the same reason
 * roll quality reports "not placed" instead of zero.
 */
function figureFor(row: RosterHeroRow, key: RosterSortKey): number | undefined {
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
  sort: RosterSort,
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

export type AbilityFilterOption = {
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
): readonly AbilityFilterOption[] {
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
    if (filter.hideDisabled && row.hero.battleAllowed === false) return false;
    if (wanted.size === 0) return true;
    return heroAbilityIds(row.hero.abilities).some((id) => wanted.has(id));
  });
}

/** Filter first, then order what survived — the board draws exactly this. */
export function rosterBoardRows(
  rows: readonly RosterHeroRow[],
  filter: RosterBoardFilter,
  sort: RosterSort,
): readonly RosterHeroRow[] {
  return sortRosterRows(filterRosterRows(rows, filter), sort);
}
