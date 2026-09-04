/**
 * How well a hero rolled inside its own birth windows.
 *
 * Each of the eight statistics is placed inside the window the game published for it
 * (`HeroRecord.statRanges`, beside the roll in `HeroRecord.birth`), and the eight positions are
 * averaged unweighted. Nothing else is read: no account, no phase, no gear, no team.
 *
 * Percentiles are computed from the stored PLANNER-unit values with no further conversion. All
 * eight save→planner conversions are affine with a positive slope (`saveSheetUnits`), and an
 * affine map with positive slope preserves the ratio `(v − min) / (max − min)` exactly — so the
 * position inside a band is identical in either unit system, not merely close.
 *
 * There is no fallback to the per-rarity roll table (`BASE_ROLLS`). That table holds rarity
 * MIDPOINTS, which cannot produce a position inside a band; a midpoint-derived number would look
 * computed and be fiction, and callers sort by this value. A hero whose bounds are missing
 * reports unavailable, with the reason, and never a number.
 */
import { SHEET_KEYS, type SheetKey } from './planner-constants';
import type { HeroRecord } from './shims/storage';

export type StatRollUnavailableReason = 'noBirthRoll' | 'noBand' | 'zeroWidthBand';

export type StatRoll = {
  readonly value?: number;
  readonly band?: { readonly min: number; readonly max: number };
  /** 0..100. Absent when there is no band, the band has zero width, or there is no roll. */
  readonly percentile?: number;
  readonly outOfBand?: true;
  readonly unavailableReason?: StatRollUnavailableReason;
};

export type PerStatRolls = { readonly [K in SheetKey]: StatRoll };

export type RollQualityReport = {
  readonly perStat: PerStatRolls;
  /** Unweighted mean of the percentiles that exist. */
  readonly mean: number;
  readonly contributingStats: number;
};

type Band = { readonly min: number; readonly max: number };

function placeInBand(value: number | undefined, band: Band | undefined): StatRoll {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return { unavailableReason: 'noBirthRoll' };
  }
  const usable =
    band !== undefined &&
    Number.isFinite(band.min) &&
    Number.isFinite(band.max) &&
    band.max >= band.min;
  if (!usable) {
    // An inverted band (min > max) means our reading of one endpoint is wrong; a negative or
    // above-100 position derived from it would be arithmetic on a premise we know is broken.
    return { value, unavailableReason: 'noBand' };
  }
  const width = band.max - band.min;
  if (width === 0) {
    // A zero-width band has no inside. Reporting 0 here would read as the worst possible roll.
    return { value, band, unavailableReason: 'zeroWidthBand' };
  }
  const raw = ((value - band.min) / width) * 100;
  const percentile = Math.min(100, Math.max(0, raw));
  if (raw < 0 || raw > 100) {
    // The band and the roll arrive in the same payload, so a roll outside its own window means
    // one of the two was read wrong. The clamp keeps the number sane; the flag keeps it visible.
    return { value, band, percentile, outOfBand: true };
  }
  return { value, band, percentile };
}

/**
 * Per-statistic placement without the aggregate — exported so the fully-unavailable cases, which
 * {@link rollQualityFor} deliberately collapses to `undefined`, stay observable.
 */
export function statRollsFor(hero: HeroRecord): PerStatRolls {
  const birth = hero.birth;
  const ranges = hero.statRanges;
  const rolls: { -readonly [K in SheetKey]?: StatRoll } = {};
  for (const key of SHEET_KEYS) {
    rolls[key] = placeInBand(birth?.[key], ranges?.[key]);
  }
  return rolls as PerStatRolls;
}

/**
 * `undefined` when not one statistic could be placed — a hero with no birth roll, or none of
 * whose bounds were ever imported. A zero mean would claim the worst possible roll about a hero
 * nothing is known of.
 */
export function rollQualityFor(hero: HeroRecord): RollQualityReport | undefined {
  const perStat = statRollsFor(hero);
  let total = 0;
  let contributingStats = 0;
  for (const key of SHEET_KEYS) {
    const percentile = perStat[key].percentile;
    if (percentile === undefined) continue;
    total += percentile;
    contributingStats += 1;
  }
  if (contributingStats === 0) return undefined;
  return { perStat, mean: total / contributingStats, contributingStats };
}
