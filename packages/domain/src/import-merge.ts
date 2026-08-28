import { applyGear, emptySheetOther, type SheetStats } from './gear';
import { abilityMods } from './model';
import type { HeroRecord } from './shims/storage';

/** Rebuild the pre-points geared sheet from preserved naked + (new) loadout. */
export function recomputeGearedSheet(
  hero: Pick<HeroRecord, 'naked' | 'loadout' | 'abilities'>,
): SheetStats {
  const mods = abilityMods(hero.abilities);
  const sheetOther = {
    ...emptySheetOther(),
    critChanceFlat: mods.sheetCritChanceFlat,
    penetration: mods.sheetPenetrationRaw,
    critDmgFlat: mods.sheetCritDmgFlat,
  };
  return applyGear(hero.naked, hero.loadout, sheetOther);
}

/**
 * BSPW5-07 (AD-BSP-13): re-import OVERWRITE, not a gear-refresh merge. The incoming
 * birth-backed record (naked, gearedOverride, pts, level, stars, abilities, rarity, loadout,
 * name, skin, rank, power, deployed, battleAllowed) is authoritative — re-deriving
 * `gearedOverride` from `applyGear` (via `recomputeGearedSheet`) would drop the tree
 * `composeSheetFromBirth` already applied once (AC-21). Only `id`, `sourceId` and
 * `altLoadout` — the three planner-only / identity fields the save knows nothing about —
 * are preserved from `existing`.
 *
 * Spread direction is deliberate (`incoming` first, then the three preserved fields): any
 * `HeroRecord` field added later is overwritten by default (the correct default for a
 * save-sourced record), not silently missed by a hand-written field list (AC-17/AC-22).
 */
export function mergeImportedHero(
  existing: HeroRecord,
  incoming: Omit<HeroRecord, 'id' | 'updatedAt'>,
): HeroRecord {
  return {
    ...incoming,
    id: existing.id,
    sourceId: existing.sourceId,
    altLoadout: existing.altLoadout,
    updatedAt: Date.now(),
  };
}
