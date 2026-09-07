/**
 * The presentation decisions the birth-roll panel makes ON TOP of `rollQualityFor`.
 *
 * Nothing here re-derives a percentile, a band or a letter — the domain owns all three. What lives
 * here is every judgement the panel would otherwise take inside JSX, where no test in this
 * repository can reach it: whether the panel can draw at all, how certain its placement is, whether
 * a disagreement is worth printing, and where each letter's edge falls on the rail.
 */
import { SHEET_PANEL_KEYS, type SheetKey } from '@bombfarm/domain/planner-constants';
import {
  LETTER_BANDS,
  boundaryCutPoint,
  statRollsFor,
  type RollQualityReport,
} from '@bombfarm/domain/roll-quality';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import type { PanelAvailability } from '../core';

/** What a cell prints when the report could place nothing there. Never a zero, which would read
 *  as the worst possible roll about a statistic nothing is known of. */
const NOT_PLACED = '—';

/**
 * Available only when the domain produced a report. The two unavailable reasons are told apart by
 * evidence rather than assumption: a hero carrying rolls but no window has bounds missing, a hero
 * carrying no roll at all has nothing to place in the first place.
 */
export function birthRollAvailability(
  hero: HeroRecord,
  report: RollQualityReport | undefined,
): PanelAvailability {
  if (report !== undefined) return { kind: 'available' };
  const perStat = statRollsFor(hero);
  const anyRoll = SHEET_PANEL_KEYS.some((key) => perStat[key].value !== undefined);
  return { kind: 'unavailable', reason: anyRoll ? 'noRollBounds' : 'noBirthRoll' };
}

/**
 * Three states, not a boolean. Sitting near a bracketed edge is the model's own stated
 * uncertainty about where that edge is; a letter disagreement and an unrecognised stored letter
 * are statements about this hero. Collapsing them would print the same sentence for all three.
 */
export type PlacementCertainty =
  | { readonly kind: 'settled' }
  | { readonly kind: 'nearBoundary' }
  | { readonly kind: 'uncertain'; readonly cause: 'letterDisagreement' | 'unknownStoredLetter' };

export type GradePlacement = {
  readonly mean: number;
  readonly computedLetter: string | undefined;
  readonly storedLetter: string | undefined;
  /** The grade the rail is read against: the game's stored letter wherever this table recognises
   *  it, ours only where it does not. */
  readonly railLetter: string;
  readonly certainty: PlacementCertainty;
};

function certaintyOf(report: RollQualityReport): PlacementCertainty {
  if (report.disagrees) return { kind: 'uncertain', cause: 'letterDisagreement' };
  if (report.unknownLetter) return { kind: 'uncertain', cause: 'unknownStoredLetter' };
  if (report.nearBoundary) return { kind: 'nearBoundary' };
  return { kind: 'settled' };
}

export function gradePlacementFor(
  report: RollQualityReport | undefined,
): GradePlacement | undefined {
  if (report === undefined) return undefined;
  const stored = report.unknownLetter ? undefined : report.storedLetter;
  return {
    mean: report.mean,
    computedLetter: report.computedLetter,
    storedLetter: report.storedLetter,
    railLetter: stored ?? report.computedLetter ?? LETTER_BANDS.letters[0],
    certainty: certaintyOf(report),
  };
}

/** Both letters, never a winner: the stored letter is the game's answer and stands beside ours. */
export type LetterDisagreement = {
  readonly storedLetter: string;
  readonly computedLetter: string;
};

export function letterDisagreementFor(
  report: RollQualityReport | undefined,
): LetterDisagreement | undefined {
  if (report === undefined || !report.disagrees) return undefined;
  const { storedLetter, computedLetter } = report;
  if (storedLetter === undefined || computedLetter === undefined) return undefined;
  return { storedLetter, computedLetter };
}

export type NextLetterReadout = {
  readonly letter: string;
  /** Always two ends. The boundary being measured to is bracketed, so a midpoint would claim a
   *  precision the evidence does not have. */
  readonly range: string;
};

/** `undefined` on the top grade, which has no next letter to reach. */
export function nextLetterReadout(
  report: RollQualityReport | undefined,
  formatPoints: (value: number) => string,
): NextLetterReadout | undefined {
  const distance = report?.toNextLetter;
  if (distance === undefined) return undefined;
  return {
    letter: distance.letter,
    range: `${formatPoints(distance.min)}–${formatPoints(distance.max)}`,
  };
}

export type GradeRailSegment = {
  readonly letter: string;
  readonly startPct: number;
  readonly endPct: number;
};

/** A boundary occupies WIDTH on the rail, because the evidence locates it in an interval and no
 *  closer. Drawn as a band across the two letters it separates, never as a line. */
export type GradeRailBoundary = {
  readonly below: string;
  readonly above: string;
  readonly startPct: number;
  readonly endPct: number;
};

export type GradeRail = {
  readonly domainMin: number;
  readonly domainMax: number;
  readonly segments: readonly GradeRailSegment[];
  readonly boundaries: readonly GradeRailBoundary[];
  readonly markerPct: number;
};

/**
 * Letter widths come from the measured table, so the rail is to scale: E spans far more of it than
 * C does, because that is what the corpus says. The domain stretches to hold a hero rolling
 * outside every observed extreme rather than clamping its marker onto the end.
 */
export function gradeRailFor(mean: number): GradeRail {
  const evidence = LETTER_BANDS.evidence;
  const domainMin = Math.min(evidence[0].observedMin, mean);
  const domainMax = Math.max(evidence[evidence.length - 1].observedMax, mean);
  const span = domainMax - domainMin;
  const at = (value: number) => ((value - domainMin) / span) * 100;
  const cuts = LETTER_BANDS.boundaries.map(boundaryCutPoint);

  return {
    domainMin,
    domainMax,
    segments: LETTER_BANDS.letters.map((letter, index) => ({
      letter,
      startPct: index === 0 ? 0 : at(cuts[index - 1]),
      endPct: index === cuts.length ? 100 : at(cuts[index]),
    })),
    boundaries: LETTER_BANDS.boundaries.map((boundary) => ({
      below: boundary.below,
      above: boundary.above,
      startPct: at(boundary.min),
      endPct: at(boundary.max),
    })),
    markerPct: at(mean),
  };
}

export type StatRollRow = {
  readonly key: SheetKey;
  readonly value: string;
  readonly band: string;
  readonly position: string;
  /** Absent whenever the domain could not place this statistic, so the rail has nothing to tint
   *  and no number is printed beside it. */
  readonly percentile?: number | undefined;
  readonly outOfBand: boolean;
};

export function statRollRowsFor(
  hero: HeroRecord,
  formatValue: (value: number) => string,
  formatPercent: (value: number) => string,
): readonly StatRollRow[] {
  const perStat = statRollsFor(hero);
  return SHEET_PANEL_KEYS.map((key) => {
    const roll = perStat[key];
    const band = roll.band;
    return {
      key,
      value: roll.value === undefined ? NOT_PLACED : formatValue(roll.value),
      band: band === undefined ? NOT_PLACED : `${formatValue(band.min)}–${formatValue(band.max)}`,
      position: roll.percentile === undefined ? NOT_PLACED : formatPercent(roll.percentile),
      percentile: roll.percentile,
      outOfBand: roll.outOfBand === true,
    };
  });
}

export type FlagReading = 'yes' | 'no' | 'unknown';

/**
 * Three flags with three different absence rules, which is why they are read here rather than
 * inline. `battleAllowed` defaults to allowed, matching every other roster surface. `marketable`
 * is genuinely three-state: absence means nobody has asked the game yet, and collapsing it into
 * `no` would report a whole roster as account-bound.
 */
export type IdentityFlags = {
  readonly deployed: boolean;
  readonly battleAllowed: boolean;
  readonly marketable: FlagReading;
};

export function identityFlagsFor(hero: HeroRecord): IdentityFlags {
  return {
    deployed: hero.deployed === true,
    battleAllowed: hero.battleAllowed ?? true,
    marketable: hero.marketable === undefined ? 'unknown' : hero.marketable ? 'yes' : 'no',
  };
}
