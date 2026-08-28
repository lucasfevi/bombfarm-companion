/**
 * Display-time clamp matching the game's EXPORTED sheet: `critChance` at
 * `STAT_CAPS.critChance` (100), `cdr` at `STAT_CAPS.cdr` (80). Penetration is deliberately
 * excluded — see `STAT_CAPS.penetration`'s own doc comment (`model/rarity-constants.ts`):
 * the game does NOT clamp sheet penetration, and several real exports carry it well past 100
 * (e.g. Isolde at 286.85).
 *
 * `composeSheetFromBirth` (`birth-sheet.ts`) and the telescoping breakdowns that must agree
 * with it (`peelSheetStages` in `sheet-stages.ts`, `peelSheetSources` in `sheet-peel.ts`) are
 * all deliberately UNCAPPED — clamping inside any of them would desync the sum identities they
 * are required to preserve (`total` must equal `composeSheetFromBirth`'s output; the
 * telescoping/tooltip columns must sum to it). This module is the shared display-time seam
 * those doc comments promised: apply `gameSheetView` at the call site (Planner Stats panel,
 * Team Plan hero panel), never inside the model.
 */
import { STAT_CAPS } from './model/rarity-constants';
import type { SheetKey } from './planner-constants';
import type { SheetStats } from './gear/types';

/**
 * Per-key display cap. Only `critChance`/`cdr` are ever lowered; every other key (including
 * `penetration`) passes through unchanged. Shared by {@link gameSheetView} and
 * `peelSheetStages`'s `deltaCap`/`cappedTotal` columns so both stay a single source of truth.
 */
export function capSheetValue(key: SheetKey, value: number): number {
  if (key === 'critChance') return Math.min(value, STAT_CAPS.critChance);
  if (key === 'cdr') return Math.min(value, STAT_CAPS.cdr);
  return value;
}

/**
 * Apply the game's display clamp to a composed sheet. Matches what the game's own export
 * shows — verified exactly against every hero in `SaveFile_BombFarm.json`, including the
 * heroes whose ability+gear alone already exceed a cap.
 */
export function gameSheetView(sheet: SheetStats): SheetStats {
  return {
    ...sheet,
    critChance: capSheetValue('critChance', sheet.critChance),
    cdr: capSheetValue('cdr', sheet.cdr),
  };
}
