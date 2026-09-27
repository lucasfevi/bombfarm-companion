import { formatNumber, type Lang } from '@bombfarm/ui';
import { sub, type ShowcaseCopy } from '../copy';
import { gradePlacementFor } from './birth-roll-panel';
import { heroTypesFor, type HeroTypeId } from './hero-types';
import { highestRollsFor, type HighestRoll } from './highest-rolls';
import { equippedGearAverages, type EquippedGearAverages } from './roster-summary';
import type { RosterHeroRow } from './roster-rows';

export type ShowcaseBirthReading = {
  /** The mean percentile of every placed statistic — where the hero sits on the grade scale. */
  readonly mean: number;
  /** The grade the ladder lifts out: the game's own letter wherever it is recognised. */
  readonly railLetter: string;
};

export type ShowcaseCardReading = {
  readonly types: readonly HeroTypeId[];
  /** Absent when no birth statistic could be placed — never a 0%, which reads as the worst roll. */
  readonly birth?: ShowcaseBirthReading;
  /** Best first; empty when no statistic could be placed. */
  readonly highestRolls: readonly HighestRoll[];
  readonly gear: EquippedGearAverages;
};

export function showcaseCardReading(row: RosterHeroRow): ShowcaseCardReading {
  const placement = gradePlacementFor(row.report);
  return {
    types: heroTypesFor(row.hero.abilities),
    ...(placement === undefined ? {} : { birth: { mean: placement.mean, railLetter: placement.railLetter } }),
    highestRolls: highestRollsFor(row.hero),
    gear: equippedGearAverages([row.hero]),
  };
}

/** How the board of cards is being looked at: session-only, like the leaderboard's own view. */
export type ShowcaseView = {
  /** Every item level, forge `+N` and ability level on the cards, together. */
  readonly showLevels: boolean;
};

export const DEFAULT_SHOWCASE_VIEW: ShowcaseView = { showLevels: false };

export function percentText(pct: number, lang: Lang): string {
  return `${formatNumber(pct, lang, 0)}%`;
}

export type GearAverageFigures = {
  readonly level: string;
  readonly forge: string;
};

/** The card's "Avg Lv 124 · Forge +13" figures, whole numbers as the game prints an item's level
 *  and forge — `undefined` when nothing is worn, which is never averaged to zero. */
export function gearAverageFigures(gear: EquippedGearAverages, lang: Lang): GearAverageFigures | undefined {
  if (gear.averageLevel === undefined || gear.averageUpgrade === undefined) return undefined;
  return { level: formatNumber(gear.averageLevel, lang, 0), forge: formatNumber(gear.averageUpgrade, lang, 0) };
}

/** "Lv 102 · forged +13.1" — the squad's figure keeps one decimal, since across eighty items a
 *  whole-number forge would hide every change short of a full step. */
export function squadGearAveragesText(
  gear: EquippedGearAverages,
  copy: ShowcaseCopy,
  lang: Lang,
): string | undefined {
  if (gear.averageLevel === undefined || gear.averageUpgrade === undefined) return undefined;
  return sub(copy.summaryGearAverages, {
    level: formatNumber(gear.averageLevel, lang, 0),
    forge: formatNumber(gear.averageUpgrade, lang, 1),
  });
}

/**
 * The card's narrowest width, and what has to fit inside it on one row: all eight gear slots, and
 * a hero's whole ability pool — six on the rarest heroes — at the same tile size. The board is an
 * `auto-fill` grid of this minimum, so no card is ever drawn narrower; a wider card grows its tiles
 * instead of leaving the row short.
 */
export const SHOWCASE_CARD_MIN_WIDTH_PX = 296;
export const SHOWCASE_CARD_PADDING_PX = 12;
export const SHOWCASE_CARD_BORDER_PX = 1;
export const SHOWCASE_MAX_ABILITIES = 6;
/** Wide enough for the gold ring around Wide Blast not to touch its neighbour. */
export const SHOWCASE_ABILITY_GAP_PX = 8;
export const SHOWCASE_GEAR_SLOTS = 8;
/** The gap the gear strip draws between its tiles. */
export const SHOWCASE_GEAR_GAP_PX = 2;
/** The icon size step both rows are drawn at: one tile width, taken from the card's own width. */
export const SHOWCASE_TILE_SIZE = 'fluid';

export function rowWidthPx(count: number, tilePx: number, gapPx: number): number {
  return count * tilePx + Math.max(0, count - 1) * gapPx;
}

export function showcaseCardContentWidthPx(cardWidthPx = SHOWCASE_CARD_MIN_WIDTH_PX): number {
  return cardWidthPx - 2 * (SHOWCASE_CARD_PADDING_PX + SHOWCASE_CARD_BORDER_PX);
}

/** One tile's width, such that eight gear slots and their gaps fill the content width exactly. */
export function showcaseTileWidthPx(contentWidthPx: number): number {
  return (contentWidthPx - (SHOWCASE_GEAR_SLOTS - 1) * SHOWCASE_GEAR_GAP_PX) / SHOWCASE_GEAR_SLOTS;
}

/** {@link showcaseTileWidthPx} as CSS, measured against the card's content box as a container. */
export function showcaseTileWidthCss(): string {
  const gaps = (SHOWCASE_GEAR_SLOTS - 1) * SHOWCASE_GEAR_GAP_PX;
  return `calc((100cqi - ${String(gaps)}px) / ${String(SHOWCASE_GEAR_SLOTS)})`;
}
