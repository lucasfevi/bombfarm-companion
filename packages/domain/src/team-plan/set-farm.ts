import { ITEM_LEVELS, setsForLevel } from '../gear/catalog';
import { ITEM_POR_FASE, itemLevelsForPhase } from '../phase-wiki';

export type SetFarmBand = {
  setId: string;
  itemLevel: number;
  minPhase: number;
  maxPhase: number;
};

/** Every equipment set, ascending by the item level it drops at. */
export const SET_FARM_SETS: readonly string[] = ITEM_LEVELS.flatMap((level) => setsForLevel(level));

const bandBySet = new Map<string, SetFarmBand>(
  ITEM_POR_FASE.flatMap((band) =>
    setsForLevel(band.itemLevel).map((setId) => [
      setId,
      { setId, itemLevel: band.itemLevel, minPhase: band.min, maxPhase: band.max },
    ] as const),
  ),
);

/** The phases an item chest of this set can drop on; `null` for an unknown set id. */
export function setFarmBand(setId: string | null | undefined): SetFarmBand | null {
  if (setId == null) return null;
  return bandBySet.get(setId) ?? null;
}

/**
 * The share of a phase's item chests that belong to the level, 0 when the level cannot roll
 * there. Inside a band overlap the game draws the level uniformly, so each gets half.
 */
export function itemLevelShareOnPhase(phase: number, itemLevel: number): number {
  const levels = itemLevelsForPhase(phase);
  return levels.includes(itemLevel) ? 1 / levels.length : 0;
}
