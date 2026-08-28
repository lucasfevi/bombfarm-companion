import { BASE_ROLLS, type RarityKey } from './model';
import type { SheetStats } from './gear';

export const RARITIES = Object.keys(BASE_ROLLS) as RarityKey[];

export const GATES = [
  { name: 'Normal', secs: 600 },
  { name: 'Nightmare', secs: 540 },
  { name: 'Hell', secs: 480 },
  { name: 'Torment', secs: 420 },
  { name: 'Inferno', secs: 360 },
] as const;

/** Model / persistence iteration order (luck last — storage round-trip stable). */
export const SHEET_KEYS = [
  'attack',
  'energy',
  'speed',
  'critChance',
  'critDmg',
  'penetration',
  'cdr',
  'luck',
] as const;

export type SheetKey = (typeof SHEET_KEYS)[number];

/**
 * In-game hero-sheet row order for display surfaces (sheet table, Points table,
 * Effective panel sheet group): Attack → Energy → Speed → Luck → Crit % → …
 * Same eight keys as `SHEET_KEYS`, different order (Bellatrix sheet).
 */
export const SHEET_PANEL_KEYS: readonly SheetKey[] = [
  'attack',
  'energy',
  'speed',
  'luck',
  'critChance',
  'critDmg',
  'penetration',
  'cdr',
];

export type SheetPanelKey = SheetKey;

/**
 * The seven sheet stats scored for DPS and consumed by `sheetsClose` and the
 * mismatch tab-status predicate. Equals `SHEET_KEYS` minus `luck`, which is modelled
 * and stored but excluded from combat scoring. Wave 6
 * added `SHEET_PANEL_KEYS` above for the eight-key display surfaces — this list stays
 * scoped to the combat / mismatch consumers named above.
 */
export const SHEET_DISPLAY_KEYS = [
  'attack',
  'energy',
  'speed',
  'critChance',
  'critDmg',
  'penetration',
  'cdr',
] as const;

export type SheetDisplayKey = (typeof SHEET_DISPLAY_KEYS)[number];

/** Fresh zeroed point allocation (factory — never share a mutable singleton). */
export function ZERO_PTS(): Record<SheetKey, number> {
  return {
    attack: 0,
    energy: 0,
    speed: 0,
    critChance: 0,
    critDmg: 0,
    penetration: 0,
    cdr: 0,
    luck: 0,
  };
}

/** Static zero template for spreads (e.g. import defaults). */
export const ZERO_PTS_TEMPLATE: Record<keyof SheetStats, number> = {
  attack: 0,
  energy: 0,
  speed: 0,
  critChance: 0,
  critDmg: 0,
  penetration: 0,
  cdr: 0,
  luck: 0,
};

export const RANK_ORDER = ['S', 'A', 'B', 'C', 'D', 'E', 'F'] as const;

/**
 * Apply a partial point step to a single stat (full form — the user's Q-1 decision
 * widens the old floor-only rule: ±1 shares the **same** clamp as ±5, not just its floor). Two rules,
 * expressed once so every stepper shares them (`clampPointStep` takes `delta`, not a sign):
 *
 * - **Floor** — `pts[key]` never goes below 0, for any `delta` (positive or negative). A
 *   `-5` step at `pts[key] = 3` becomes a partial `-3`, landing at 0 rather than `-2`. This
 *   also fixes today's defect: `setPts` clamps nothing, so `-1` at 0 used to write `-1`.
 * - **Ceiling** — applied for every positive `delta` (±1 **and** ±5): the total spend across
 *   all eight `SHEET_KEYS` (matching `spentDelta`'s own accounting, luck included) may not
 *   exceed `level` after the change. A `+5` step is trimmed to whatever budget remains (the
 *   "remaining-unspent" branch); a `+1` at the budget ceiling is refused outright (a no-op).
 *   Overspend is no longer reachable via either stepper — only by lowering a hero's level
 *   while points are already spent (the `text-warn` counter stays live for that path).
 */
export function clampPointStep(
  pts: Record<SheetKey, number>,
  key: SheetKey,
  delta: number,
  level: number,
): Record<SheetKey, number> {
  const current = pts[key];
  let step = delta;
  if (step < 0) {
    step = Math.max(step, -current);
  } else if (step > 0) {
    const spent = SHEET_KEYS.reduce((sum, sheetKey) => sum + pts[sheetKey], 0);
    const room = Math.max(0, level - spent);
    step = Math.min(step, room);
  }
  if (step === 0) return pts;
  return { ...pts, [key]: current + step };
}
