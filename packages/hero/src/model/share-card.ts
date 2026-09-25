import type { RarityKey } from '@bombfarm/domain/model';
import { compareRollQuality } from '@bombfarm/domain/roll-quality';
import { formatCompactNumber, type Lang } from '@bombfarm/ui';
import { isSquadHero, type RarityCount } from './roster-summary';
import type { RosterHeroRow } from './roster-rows';

/** What picks the card's three featured heroes. */
export type ShareFeature = 'power' | 'roll';

export const SHARE_FEATURES: readonly ShareFeature[] = ['power', 'roll'];

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

function compareByRoll(left: RosterHeroRow, right: RosterHeroRow): number {
  return compareRollQuality(
    { id: left.id, ...(left.report === undefined ? {} : { rollQuality: left.report.mean }) },
    { id: right.id, ...(right.report === undefined ? {} : { rollQuality: right.report.mean }) },
  );
}

export function featuredRows(
  picked: readonly RosterHeroRow[],
  feature: ShareFeature,
): readonly RosterHeroRow[] {
  const order = feature === 'roll' ? compareByRoll : compareByPower;
  return [...picked].sort(order).slice(0, SHARE_FEATURED_COUNT);
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
  feature: ShareFeature,
): ShareCardLayout {
  const picked = rows.filter((row) => pickedIds.has(row.id)).sort(compareByPower);
  const featured = featuredRows(picked, feature);
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
  readonly feature: ShareFeature;
  readonly phase: number;
  readonly picked: ReadonlySet<string>;
  readonly showGear: boolean;
  readonly showAuras: boolean;
  /** Off until the player turns it on: the number identifies the account to anyone shown it. */
  readonly showAccountNumber: boolean;
};

export function defaultShareCardSettings(
  rows: readonly RosterHeroRow[],
  accountPhase: number | null | undefined,
  lastKnownPhase: number,
): ShareCardSettings {
  return {
    feature: 'power',
    phase: initialSharePhase(accountPhase, lastKnownPhase),
    picked: sharePicksFor(rows, 'squad'),
    showGear: true,
    showAuras: true,
    showAccountNumber: false,
  };
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
