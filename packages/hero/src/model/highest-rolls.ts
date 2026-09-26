import { SHEET_PANEL_KEYS, type SheetKey } from '@bombfarm/domain/planner-constants';
import { statRollsFor } from '@bombfarm/domain/roll-quality';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';

export type HighestRoll = {
  readonly key: SheetKey;
  /** 0–100: where the birth roll landed inside the window the game rolled it from. */
  readonly percentile: number;
};

/**
 * The birth statistics that rolled closest to the top of their window, best first — the same
 * placement the birth-roll panel's bars draw. Ties keep the sheet's own order.
 *
 * A roll outside its own window is left out: the domain clamps it to 100 to keep the bar sane,
 * and naming a misread statistic as a hero's best would turn that clamp into a boast.
 */
export function highestRollsFor(hero: HeroRecord, count = 2): readonly HighestRoll[] {
  const perStat = statRollsFor(hero);
  const placed: HighestRoll[] = [];
  for (const key of SHEET_PANEL_KEYS) {
    const roll = perStat[key];
    if (roll.percentile === undefined || roll.outOfBand === true) continue;
    placed.push({ key, percentile: roll.percentile });
  }
  return placed.sort((left, right) => right.percentile - left.percentile).slice(0, count);
}
