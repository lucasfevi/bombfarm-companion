/**
 * BSPW5-02 (AD-BSP-19a, DEC-09) — the ONE shared save→planner unit-conversion site.
 * `stats` and `birth_stats` share the same key set and unit table — `saveSheetUnits` and
 * `birthFromSave` are the same function under two names, kept separate only so call sites
 * read clearly (`docs/architecture.md` ownership rule 2 — pure math, no React).
 *
 * Table: `dmg` / `energia` / `speed` are 1:1; `penetration` is already 1:1 despite looking
 * fractional; `crit_chance` / `luck` / `cooldown_reduction` are fractions in the save,
 * percent here (× 100); `crit_dmg` is a multiplier in the save, excess percentage points
 * here (`(x − 1) × 100`) — e.g. Bellatrix's `1.67344467136338` → `67.344467136338…`.
 */
import type { BirthStats, TreeSheetTotals } from './birth-sheet';
import type { SheetStats } from './gear';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function normalizeKeystones(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.map((keystone) => String(keystone).toLowerCase()) : [];
}

/**
 * Glass Cannon (C15) — `crit_dmg_mult >= 1.5` is the direct mechanical signal (the exporter
 * leaves it at `2` even under Abisso); `keystones` containing `c15` is the fallback. Shared by
 * {@link treeTotalsFromSave} (per-hero sheet composition) and `import-save.ts`'s
 * `mapAccountData` (account-level display/combat flags) so the two never drift apart.
 */
export function detectGlassCannon(totalsRaw: Record<string, unknown>): boolean {
  const keystones = normalizeKeystones(totalsRaw.keystones);
  return asNumber(totalsRaw.crit_dmg_mult, 1) >= 1.5 || keystones.some((keystone) => keystone === 'c15');
}

/**
 * Tempo Dobrado (V15) — no numeric signal in `skills.totals` (unlike Glass Cannon's
 * `crit_dmg_mult`), so only the `keystones` id lights it up; a save without a recognized id
 * defaults to off (the user can still tick it manually in the account editor).
 */
export function detectTempoDobrado(totalsRaw: Record<string, unknown>): boolean {
  const keystones = normalizeKeystones(totalsRaw.keystones);
  return keystones.some((keystone) => keystone.includes('tempo') || keystone === 'v15');
}

/** AD-BSP-19a — the single conversion table, shared by both `stats` and `birth_stats`. */
export function saveSheetUnits(raw: Record<string, unknown>): SheetStats {
  return {
    attack: asNumber(raw.dmg),
    energy: asNumber(raw.energia),
    speed: asNumber(raw.speed),
    penetration: asNumber(raw.penetration),
    critChance: asNumber(raw.crit_chance) * 100,
    cdr: asNumber(raw.cooldown_reduction) * 100,
    critDmg: (asNumber(raw.crit_dmg, 1) - 1) * 100,
    luck: asNumber(raw.luck) * 100,
  };
}

/** Same table as {@link saveSheetUnits} — named for `birth_stats` call sites (AC-08). */
export function birthFromSave(raw: Record<string, unknown>): BirthStats {
  return saveSheetUnits(raw);
}

/**
 * Map save `skills.totals` → {@link TreeSheetTotals} in planner units.
 *
 * `critDmgMult` is consumed directly by `applySkillTree` — it replaces the crit-damage shared
 * pool's implicit `1` (correction 1). `glassCannon`/`tempoDobrado` gate the two keystone
 * effects that have no per-account numeric field of their own (Glass Cannon's energy ×0.5,
 * Tempo Dobrado's speed ×1.33333) — both now applied at the sheet layer, never in combat.
 */
export function treeTotalsFromSave(totalsRaw: Record<string, unknown>): TreeSheetTotals {
  return {
    danoStatic: asNumber(totalsRaw.dmg_static, 1),
    energyPct: asNumber(totalsRaw.energia_add) * 100,
    speedPct: asNumber(totalsRaw.speed_add) * 100,
    critChancePct: asNumber(totalsRaw.crit_chance_add) * 100,
    critDmgPct: asNumber(totalsRaw.crit_dmg_add) * 100,
    luckFlatPct: asNumber(totalsRaw.luck_add) * 100,
    critDmgMult: asNumber(totalsRaw.crit_dmg_mult, 1),
    glassCannon: detectGlassCannon(totalsRaw),
    tempoDobrado: detectTempoDobrado(totalsRaw),
  };
}

/** The 8 save-side keys `birth_stats` must carry for a hero to compose a birth sheet. */
const BIRTH_STATS_KEYS = [
  'dmg',
  'energia',
  'speed',
  'penetration',
  'crit_chance',
  'cooldown_reduction',
  'crit_dmg',
  'luck',
] as const;

/**
 * WHEN a hero object carries a `birth_stats` block with all 8 save keys present and
 * finite THEN it can compose a birth sheet (`AD-BSP-05`). A partial block — missing key
 * or a non-finite value (NaN, Infinity, string, null) — is NOT usable; the whole save
 * rejects rather than composing from an invented default (spec.md edge cases).
 */
export function hasUsableBirthStats(hero: unknown): boolean {
  if (!isObject(hero)) return false;
  const birth = hero.birth_stats;
  if (!isObject(birth)) return false;
  return BIRTH_STATS_KEYS.every((key) => typeof birth[key] === 'number' && Number.isFinite(birth[key]));
}
