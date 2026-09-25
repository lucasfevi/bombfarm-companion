import { formatNumber, type Lang } from '@bombfarm/ui';
import { sub, type ShowcaseCopy } from '../copy';
import { heroTypesFor, wideBlastOf, type HeroTypeId } from './hero-types';
import { highestRollsFor, highestRollsText } from './highest-rolls';
import { equippedGearAverages, type EquippedGearAverages } from './roster-summary';
import type { RosterHeroRow } from './roster-rows';

export type ShowcaseCardReading = {
  readonly types: readonly HeroTypeId[];
  readonly hasWideBlast: boolean;
  /** Absent when no birth statistic could be placed — never a 0%, which reads as the worst roll. */
  readonly birthRollPct?: number;
  readonly highestRolls?: string;
  readonly gear: EquippedGearAverages;
};

export function showcaseCardReading(
  row: RosterHeroRow,
  copy: ShowcaseCopy,
  lang: Lang,
): ShowcaseCardReading {
  const { hero } = row;
  const highestRolls = highestRollsText(highestRollsFor(hero), copy, (pct) => percentText(pct, lang));
  return {
    types: heroTypesFor(hero.abilities),
    hasWideBlast: wideBlastOf(hero.abilities).has,
    ...(row.report === undefined ? {} : { birthRollPct: row.report.mean }),
    ...(highestRolls === undefined ? {} : { highestRolls }),
    gear: equippedGearAverages([hero]),
  };
}

export function percentText(pct: number, lang: Lang): string {
  return `${formatNumber(pct, lang, 0)}%`;
}

/** "Average item level 124 · +13", or the nothing-equipped line — whole numbers, as the game
 *  prints an item's level and forge. */
export function averageItemLevelText(gear: EquippedGearAverages, copy: ShowcaseCopy, lang: Lang): string {
  if (gear.averageLevel === undefined || gear.averageUpgrade === undefined) return copy.cardNothingEquipped;
  return sub(copy.cardAverageItemLevel, {
    level: formatNumber(gear.averageLevel, lang, 0),
    forge: formatNumber(gear.averageUpgrade, lang, 0),
  });
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
 * The card's narrowest width, and what has to fit inside it on one row: a hero's whole ability
 * pool — six on the rarest heroes — and all eight gear slots. The board is an `auto-fill` grid of
 * this minimum, so no card is ever drawn narrower.
 */
export const SHOWCASE_CARD_MIN_WIDTH_PX = 296;
export const SHOWCASE_CARD_PADDING_PX = 12;
export const SHOWCASE_MAX_ABILITIES = 6;
export const SHOWCASE_ABILITY_TILE_PX = 32;
/** Wide enough for the gold ring around Wide Blast not to touch its neighbour. */
export const SHOWCASE_ABILITY_GAP_PX = 8;
export const SHOWCASE_GEAR_SLOTS = 8;
export const SHOWCASE_GEAR_TILE_PX = 32;
export const SHOWCASE_GEAR_GAP_PX = 2;

export function rowWidthPx(count: number, tilePx: number, gapPx: number): number {
  return count * tilePx + Math.max(0, count - 1) * gapPx;
}

export function showcaseCardContentWidthPx(): number {
  return SHOWCASE_CARD_MIN_WIDTH_PX - 2 * SHOWCASE_CARD_PADDING_PX;
}
