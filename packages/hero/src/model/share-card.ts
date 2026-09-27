import type { RarityKey } from '@bombfarm/domain/model';
import { RARITIES } from '@bombfarm/domain/planner-constants';
import { formatCompactNumber, type Lang } from '@bombfarm/ui';
import { isSquadHero, type RarityCount } from './roster-summary';
import type { RosterHeroRow } from './roster-rows';

export const SHARE_FEATURED_COUNT = 3;

/** The tiers the card counts. A common hero is on nobody's list of things to show off. */
const COUNTED_TIERS: readonly RarityKey[] = ['Mítico', 'Lendária', 'Épico'];

export type SharePickShortcut = 'squad' | 'everyone' | 'none';

export type ShareCardTotals = {
  readonly heroCount: number;
  /** Over the heroes whose power the read carried. */
  readonly totalPower: number;
  /** Mythic, Legendary, Epic — in that order, a tier nobody on the card holds left out. */
  readonly tierCounts: readonly RarityCount[];
};

export type ShareCardLayout = {
  /** Every picked hero, strongest first. */
  readonly picked: readonly RosterHeroRow[];
  readonly featured: readonly RosterHeroRow[];
  /** The picked heroes the featured three leave, strongest first. */
  readonly rest: readonly RosterHeroRow[];
  readonly totals: ShareCardTotals;
};

/** Strongest first, a hero with no power read last, ties by id — the same roster always lays out
 *  the same card. */
export function compareByPower(left: RosterHeroRow, right: RosterHeroRow): number {
  const leftPower = left.hero.power;
  const rightPower = right.hero.power;
  if (leftPower !== rightPower) {
    if (leftPower == null) return 1;
    if (rightPower == null) return -1;
    return rightPower - leftPower;
  }
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}

export function featuredRows(picked: readonly RosterHeroRow[]): readonly RosterHeroRow[] {
  return [...picked].sort(compareByPower).slice(0, SHARE_FEATURED_COUNT);
}

export function shareCardTotals(picked: readonly RosterHeroRow[]): ShareCardTotals {
  return {
    heroCount: picked.length,
    totalPower: picked.reduce((total, row) => total + (row.hero.power ?? 0), 0),
    tierCounts: COUNTED_TIERS.map((rarity) => ({
      rarity,
      count: picked.filter((row) => row.hero.rarity === rarity).length,
    })).filter((entry) => entry.count > 0),
  };
}

export function shareCardLayout(
  rows: readonly RosterHeroRow[],
  pickedIds: ReadonlySet<string>,
): ShareCardLayout {
  const picked = rows.filter((row) => pickedIds.has(row.id)).sort(compareByPower);
  const featured = featuredRows(picked);
  const featuredIds = new Set(featured.map((row) => row.id));
  return {
    picked,
    featured,
    rest: picked.filter((row) => !featuredIds.has(row.id)),
    totals: shareCardTotals(picked),
  };
}

/** The card opens on the squad: the heroes the account lets into battle. */
export function sharePicksFor(
  rows: readonly RosterHeroRow[],
  shortcut: SharePickShortcut,
): ReadonlySet<string> {
  if (shortcut === 'none') return new Set();
  const chosen = shortcut === 'squad' ? rows.filter((row) => isSquadHero(row.hero)) : rows;
  return new Set(chosen.map((row) => row.id));
}

export function togglePick(picked: ReadonlySet<string>, heroId: string, on: boolean): ReadonlySet<string> {
  if (picked.has(heroId) === on) return picked;
  const next = new Set(picked);
  if (on) next.add(heroId);
  else next.delete(heroId);
  return next;
}

/**
 * A phase the card's DPS can be worked out at, or `null` for something that is not a phase. A
 * finite number outside the known run is pulled into it, as the Heroes screen's own phase pick is.
 */
export function clampSharePhase(value: number, lastKnownPhase: number): number | null {
  if (!Number.isFinite(value) || lastKnownPhase < 1) return null;
  return Math.min(lastKnownPhase, Math.max(1, Math.round(value)));
}

/** The phase the card opens on: the account's own, when it has one the tables know. */
export function initialSharePhase(accountPhase: number | null | undefined, lastKnownPhase: number): number {
  return clampSharePhase(accountPhase ?? 1, lastKnownPhase) ?? 1;
}

export type ShareCardSettings = {
  readonly phase: number;
  readonly picked: ReadonlySet<string>;
  readonly showGear: boolean;
  readonly showAuras: boolean;
  /** Off until the player turns it on: the number identifies the account to anyone shown it. */
  readonly showAccountNumber: boolean;
  /** Item level and forge on the featured gear, and ability levels on the featured abilities. */
  readonly showLevels: boolean;
};

export function defaultShareCardSettings(
  rows: readonly RosterHeroRow[],
  accountPhase: number | null | undefined,
  lastKnownPhase: number,
): ShareCardSettings {
  return {
    phase: initialSharePhase(accountPhase, lastKnownPhase),
    picked: sharePicksFor(rows, 'squad'),
    showGear: true,
    showAuras: true,
    showAccountNumber: false,
    showLevels: false,
  };
}

/** What narrows the hero picker's list. It never changes who is on the card. */
export type SharePickerFilter = {
  readonly text: string;
  /** Rarity indices; none means every rarity. */
  readonly rarities: readonly number[];
};

export const EMPTY_SHARE_PICKER_FILTER: SharePickerFilter = { text: '', rarities: [] };

function foldForSearch(value: string): string {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
}

export function shareRarityIndex(rarity: RarityKey): number {
  return Math.max(0, RARITIES.indexOf(rarity));
}

/** The rarities the roster holds, commonest first — the inventory's chip order. */
export function sharePickerRarities(rows: readonly RosterHeroRow[]): readonly number[] {
  return [...new Set(rows.map((row) => shareRarityIndex(row.hero.rarity)))].sort((a, b) => a - b);
}

export function filterSharePickerRows(
  rows: readonly RosterHeroRow[],
  filter: SharePickerFilter,
): readonly RosterHeroRow[] {
  const needle = foldForSearch(filter.text);
  return rows.filter(
    (row) =>
      (needle === '' || foldForSearch(row.hero.name).includes(needle)) &&
      (filter.rarities.length === 0 || filter.rarities.includes(shareRarityIndex(row.hero.rarity))),
  );
}

export function toggleSharePickerRarity(filter: SharePickerFilter, rarityIdx: number): SharePickerFilter {
  const rarities = filter.rarities.includes(rarityIdx)
    ? filter.rarities.filter((entry) => entry !== rarityIdx)
    : [...filter.rarities, rarityIdx];
  return { ...filter, rarities };
}

const NOT_PLACED = '—';

/** A DPS figure as the card prints it: compact and whole, or the dash for a hero the host could
 *  not work one out for. */
export function shareDpsText(dps: number | undefined, lang: Lang): string {
  return dps === undefined || !Number.isFinite(dps) ? NOT_PLACED : formatCompactNumber(Math.round(dps), lang);
}

export const SHARE_MAX_STARS = 3;

export function shareStars(stars: number): { readonly filled: number; readonly empty: number } {
  const filled = Math.max(0, Math.min(SHARE_MAX_STARS, Math.round(stars)));
  return { filled, empty: filled === 0 ? 0 : SHARE_MAX_STARS - filled };
}
