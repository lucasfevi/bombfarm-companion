/**
 * The ONE shared save→planner unit-conversion site.
 * `stats` and `birth_stats` share the same key set and unit table — `saveSheetUnits` and
 * `birthFromSave` are the same function under two names, kept separate only so call sites
 * read clearly (`docs/architecture.md` ownership rule 2 — pure math, no React).
 *
 * Table: `dmg` / `energia` / `speed` are 1:1; `penetration` is already 1:1 despite looking
 * fractional; `crit_chance` / `luck` / `cooldown_reduction` are fractions in the save,
 * percent here (× 100); `crit_dmg` is a multiplier in the save, excess percentage points
 * here (`(x − 1) × 100`) — e.g. Bellatrix's `1.67344467136338` → `67.344467136338…`.
 */
import type { BirthStats, StatRanges, TreeSheetTotals } from './birth-sheet';
import type { SheetStats } from './gear';
import type { SheetKey } from './planner-constants';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** The single conversion table, shared by both `stats` and `birth_stats`. */
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

/** Same table as {@link saveSheetUnits} — named for `birth_stats` call sites. */
export function birthFromSave(raw: Record<string, unknown>): BirthStats {
  return saveSheetUnits(raw);
}

/** Map save `skills.totals` → {@link TreeSheetTotals} in planner units. */
export function treeTotalsFromSave(totalsRaw: Record<string, unknown>): TreeSheetTotals {
  return {
    danoStatic: asNumber(totalsRaw.dmg_static, 1),
    energyPct: asNumber(totalsRaw.energia_add) * 100,
    speedPct: asNumber(totalsRaw.speed_add) * 100,
    critChancePct: asNumber(totalsRaw.crit_chance_add) * 100,
    critDmgPct: asNumber(totalsRaw.crit_dmg_add) * 100,
    luckFlatPct: asNumber(totalsRaw.luck_add) * 100,
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
 * finite THEN it can compose a birth sheet. A partial block — missing key
 * or a non-finite value (NaN, Infinity, string, null) — is NOT usable; the whole save
 * rejects rather than composing from an invented default.
 */
export function hasUsableBirthStats(hero: unknown): boolean {
  if (!isObject(hero)) return false;
  const birth = hero.birth_stats;
  if (!isObject(birth)) return false;
  return BIRTH_STATS_KEYS.every((key) => typeof birth[key] === 'number' && Number.isFinite(birth[key]));
}

type BirthStatsKey = (typeof BIRTH_STATS_KEYS)[number];

/**
 * Save key → planner key, NAMES ONLY. The arithmetic stays in {@link saveSheetUnits}, which is
 * still the one conversion site. Typed over {@link BIRTH_STATS_KEYS} so a key added there fails
 * to compile until it is projected here too.
 */
const SHEET_KEY_BY_SAVE_KEY: Record<BirthStatsKey, SheetKey> = {
  dmg: 'attack',
  energia: 'energy',
  speed: 'speed',
  penetration: 'penetration',
  crit_chance: 'critChance',
  cooldown_reduction: 'cdr',
  crit_dmg: 'critDmg',
  luck: 'luck',
};

/**
 * The save's `stat_ranges` block — the window each birth value was rolled inside — in planner
 * units. Per statistic and independently forgiving: a band that is not an object, is missing
 * either endpoint, carries a non-finite endpoint, or does not satisfy `max > min` is DROPPED and
 * the surviving statistics are still returned. An unknown key is ignored. Nothing survives, or
 * the block is not an object at all, and the answer is `undefined`.
 *
 * Purely additive enrichment: unlike a birth roll, an unreadable block must never reject the
 * hero or the file — no sheet mathematics depends on these bounds.
 *
 * Endpoint presence is established BEFORE conversion, and that ordering is the whole reason the
 * surviving keys are tracked separately: {@link saveSheetUnits} substitutes `1` for an absent
 * `crit_dmg` and converts it to `0`, so a key that was never in the payload would otherwise come
 * back as a computed-looking `0 … 0` band that is fiction.
 */
export function readStatRanges(raw: unknown): StatRanges | undefined {
  if (!isObject(raw)) return undefined;

  const lows: Record<string, unknown> = {};
  const highs: Record<string, unknown> = {};
  const usable: BirthStatsKey[] = [];
  for (const key of BIRTH_STATS_KEYS) {
    const band = raw[key];
    if (!isObject(band)) continue;
    const { min, max } = band;
    if (typeof min !== 'number' || !Number.isFinite(min)) continue;
    if (typeof max !== 'number' || !Number.isFinite(max)) continue;
    if (!(max > min)) continue;
    lows[key] = min;
    highs[key] = max;
    usable.push(key);
  }
  if (usable.length === 0) return undefined;

  const low = saveSheetUnits(lows);
  const high = saveSheetUnits(highs);
  const ranges: { -readonly [K in SheetKey]?: { min: number; max: number } } = {};
  for (const key of usable) {
    const sheetKey = SHEET_KEY_BY_SAVE_KEY[key];
    ranges[sheetKey] = { min: low[sheetKey], max: high[sheetKey] };
  }
  return ranges;
}
