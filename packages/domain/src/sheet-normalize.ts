import { emptySheet, type PointAlloc, type SheetStats } from '@/shared/domain/gear';
import { ZERO_PTS } from '@/shared/domain/planner-constants';

/** Coerce a stored value to a finite number, defaulting a missing/invalid value to `fallback`. */
function finite(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/**
 * Rebuild a stored sheet from the fixed `SheetStats` key list (via `emptySheet()`), so a
 * missing, non-finite or non-numeric key becomes `0` instead of reaching arithmetic as
 * `undefined` (`docs/local-data-compat.md` rule 3). Never spreads `raw` — an unknown future
 * key is dropped, matching `normalizeHero`'s existing contract.
 */
export function normalizeSheetStats(raw?: Partial<SheetStats> | null): SheetStats {
  const out = emptySheet();
  for (const key of Object.keys(out) as (keyof SheetStats)[]) {
    out[key] = finite(raw?.[key]);
  }
  return out;
}

/** Same rebuild-from-a-fixed-list normalization, for a stored point allocation. */
export function normalizePointAlloc(raw?: Partial<PointAlloc> | null): PointAlloc {
  const out = ZERO_PTS();
  for (const key of Object.keys(out) as (keyof PointAlloc)[]) {
    out[key] = finite(raw?.[key]);
  }
  return out;
}
