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
  /** `hero.rank` verbatim — the game's answer, which this model reports against and never edits. */
  readonly storedLetter?: string;
  readonly computedLetter?: string;
  /** True only when the computed band and the stored letter are not adjacent across one boundary. */
  readonly disagrees: boolean;
  /** The mean sits inside a boundary interval — near an edge, not a disagreement. */
  readonly nearBoundary: boolean;
  /** The stored letter is not one this table knows. Never a disagreement. */
  readonly unknownLetter: boolean;
  /** Absent on the top band, which has no next letter. */
  readonly toNextLetter?: LetterDistance;
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

export type LetterEvidence = {
  readonly letter: string;
  /** Distinct heroes carrying this letter in the corpus below. */
  readonly heroes: number;
  readonly observedMin: number;
  readonly observedMax: number;
};

export type LetterBoundary = {
  readonly below: string;
  readonly above: string;
  /** The boundary lies somewhere in `[min, max]`. Nothing in the evidence narrows it further. */
  readonly min: number;
  readonly max: number;
};

export type LetterBandTable = {
  /** Lowest grade first. */
  readonly letters: readonly string[];
  readonly evidence: readonly LetterEvidence[];
  /** `boundaries[i]` separates `letters[i]` from `letters[i + 1]`. */
  readonly boundaries: readonly LetterBoundary[];
};

/**
 * Where each stored letter grade sits on the roll-quality scale.
 *
 * INFERRED, and the only constant in this package that cites no source, because there is none:
 * the game stamps every hero with a letter and publishes both the roll and its bounds, but never
 * a boundary between letters. Everything below is read back off the committed captures.
 *
 * DERIVATION. Score every hero by {@link rollQualityFor} — the unweighted mean of its eight roll
 * percentiles — then group by the letter the game stored. Across the 19 committed captures in
 * this repository (175 hero entries, 65 distinct heroes after de-duplicating on the birth-roll
 * signature) the letters order by that mean with ZERO inversions: every hero of a letter scores
 * above every hero of the letter below. De-duplication is on the roll and not on the hero,
 * because the eight-float roll is unique within every capture and never contradicts a stored
 * letter, where hero ids are re-sequenced between captures and players rename heroes.
 *
 * OBSERVED EXTREMES, distinct heroes per letter:
 *
 * | letter | heroes | min     | max     |
 * | ------ | ------ | ------- | ------- |
 * | E      | 7      | 24.3417 | 41.1645 |
 * | D      | 20     | 41.4892 | 47.1106 |
 * | C      | 6      | 47.7858 | 51.7274 |
 * | B      | 11     | 53.3387 | 57.8162 |
 * | A      | 13     | 58.9236 | 62.9655 |
 * | S      | 8      | 63.7207 | 72.6844 |
 *
 * Each boundary therefore carries the EMPTY INTERVAL between two adjacent letters rather than a
 * cut point: the evidence locates it somewhere in that gap and no closer. Interval endpoints are
 * the observed extremes rounded inward to four decimals, so every observed hero sits strictly
 * outside every interval. A runtime cut point is derived from the interval (its midpoint); the
 * interval is what is actually known.
 *
 * THE HONEST LIMIT. C/B is the least-located boundary: its gap is 1.61 points wide — the widest
 * of the five, against 0.32 for E/D — and rests on just 6 C-graded heroes on its lower side. One
 * C hero rolling near 52 would move it. The outermost bands are open-ended at runtime: 24.3417
 * and 72.6844 are the worst and best rolls yet seen, not limits, and a hero rolling better than
 * any hero so far is still S.
 */
export const LETTER_BANDS: LetterBandTable = {
  letters: ['E', 'D', 'C', 'B', 'A', 'S'],
  evidence: [
    { letter: 'E', heroes: 7, observedMin: 24.3417, observedMax: 41.1645 },
    { letter: 'D', heroes: 20, observedMin: 41.4892, observedMax: 47.1106 },
    { letter: 'C', heroes: 6, observedMin: 47.7858, observedMax: 51.7274 },
    { letter: 'B', heroes: 11, observedMin: 53.3387, observedMax: 57.8162 },
    { letter: 'A', heroes: 13, observedMin: 58.9236, observedMax: 62.9655 },
    { letter: 'S', heroes: 8, observedMin: 63.7207, observedMax: 72.6844 },
  ],
  boundaries: [
    { below: 'E', above: 'D', min: 41.1645, max: 41.4891 },
    { below: 'D', above: 'C', min: 47.1107, max: 47.7857 },
    { below: 'C', above: 'B', min: 51.7275, max: 53.3387 },
    { below: 'B', above: 'A', min: 57.8162, max: 58.9235 },
    { below: 'A', above: 'S', min: 62.9655, max: 63.7206 },
  ],
};

export type LetterDistance = {
  readonly letter: string;
  /** Points the mean must gain to reach the near edge of that boundary's interval. */
  readonly min: number;
  /** Points to its far edge. The two differ because the boundary itself is bracketed, not known. */
  readonly max: number;
};

export function boundaryCutPoint(boundary: LetterBoundary): number {
  return (boundary.min + boundary.max) / 2;
}

/** Open-ended at both ends: below every cut point is the lowest letter, above every one the highest. */
export function letterForRollQuality(mean: number): string {
  const index = LETTER_BANDS.boundaries.findIndex((b) => mean < boundaryCutPoint(b));
  return index === -1
    ? LETTER_BANDS.letters[LETTER_BANDS.letters.length - 1]
    : LETTER_BANDS.letters[index];
}

/** Strictly inside, so a hero that itself defines an interval endpoint is not flagged by its own evidence. */
export function isNearBoundary(mean: number): boolean {
  return LETTER_BANDS.boundaries.some((b) => mean > b.min && mean < b.max);
}

/** A range, never a single number — the edge it measures to is bracketed. */
export function distanceToNextLetter(mean: number): LetterDistance | undefined {
  const index = LETTER_BANDS.letters.indexOf(letterForRollQuality(mean));
  const boundary = LETTER_BANDS.boundaries[index];
  if (boundary === undefined) return undefined;
  return {
    letter: boundary.above,
    min: Math.max(0, boundary.min - mean),
    max: Math.max(0, boundary.max - mean),
  };
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

  const mean = total / contributingStats;
  const computedLetter = letterForRollQuality(mean);
  const storedIndex = hero.rank === undefined ? -1 : LETTER_BANDS.letters.indexOf(hero.rank);
  const unknownLetter = storedIndex === -1;
  const lettersApart = unknownLetter
    ? 0
    : Math.abs(LETTER_BANDS.letters.indexOf(computedLetter) - storedIndex);
  return {
    perStat,
    mean,
    contributingStats,
    storedLetter: hero.rank,
    computedLetter,
    // One letter apart is the model and the game landing on either side of a boundary whose
    // position is only bracketed — that is the model's own stated uncertainty, not a conflict.
    disagrees: lettersApart >= 2,
    nearBoundary: isNearBoundary(mean),
    unknownLetter,
    toNextLetter: distanceToNextLetter(mean),
  };
}

/** The minimum a roster row must expose to be ordered by roll quality. */
export type RollQualityRanked = {
  readonly id: string;
  /** {@link RollQualityReport.mean}, absent when the hero reports unavailable. */
  readonly rollQuality?: number;
};

/**
 * Best roll first, unavailable last, ties broken by hero id — a total order, so two heroes with
 * identical roll quality hold their places across renders however the sort itself is implemented.
 */
export function compareRollQuality(a: RollQualityRanked, b: RollQualityRanked): number {
  const left = a.rollQuality;
  const right = b.rollQuality;
  if (left !== right) {
    if (left === undefined) return 1;
    if (right === undefined) return -1;
    return right - left;
  }
  if (a.id === b.id) return 0;
  return a.id < b.id ? -1 : 1;
}
