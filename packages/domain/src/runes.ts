/**
 * Runes — the timed stat buffs a hero can carry (`heroes[].runas` on the account read).
 *
 * Each rune names one axis and a strength `p`, and it lasts a fixed span of PLAY time
 * (`WIKI_RUNES.durationPlaySecs`, extendable to `capPlaySecs` by applying the same axis again):
 * what the account read carries is the seconds still left, so the buff is real on today's sheet
 * and gone once the timer runs out. See `docs/hero-runes.md` for how every screen treats that.
 *
 * The form was fitted on a live read of six runed heroes (2026-09-13) by inverting each hero's
 * exported sheet back to a whole-number point vector landing exactly on its level:
 *
 * - attack, energy, speed, crit chance, cooldown — the rune multiplies the FINAL sheet value,
 *   after gear, points and the skill tree. Speed is the discriminating axis: the tree's speed
 *   term is a flat add, and only the post-tree placement recovers integer points (three heroes).
 * - crit damage — the rune multiplies the PRE-tree excess (birth ★ + Golpe Brutal + points), and
 *   the tree's flat `crit_dmg_add` lands on top of that (four heroes, tree term 68 pp — the two
 *   placements differ by ~3 points per hero).
 * - xp, gold — not sheet statistics; carried on the record, priced nowhere yet.
 *
 * Every carrier was rarity 0 (`p = 0.05`); a stronger rune is assumed to keep the same shape.
 * Two runes on one axis at once were never observed — applying the same axis again extends the
 * timer instead — so {@link runeSheetMultipliers} simply multiplies whatever it is handed.
 */
import type { TreeSheetTotals } from './birth-sheet';
import type { SheetStats } from './gear/types';
import { SHEET_KEYS, type SheetKey } from './planner-constants';

export const RUNE_AXES = ['attack', 'energy', 'speed', 'crit', 'critdmg', 'cdr', 'xp', 'gold'] as const;
export type RuneAxis = (typeof RUNE_AXES)[number];

export type HeroRune = {
  readonly axis: RuneAxis;
  /** Strength in percent of the stat it multiplies — `p × 100`, so a rarity-0 rune is `5`. */
  readonly strengthPct: number;
  /** Play-seconds left before the rune expires, never negative. */
  readonly playSecondsLeft: number;
  /** The rune's rarity index, 0–5 (`WIKI_RUNES.strengthByRarity` is indexed by it). */
  readonly rarity: number;
};

/** The sheet statistic each axis multiplies; `null` for the two that are not sheet statistics. */
export const RUNE_AXIS_SHEET_KEY: Record<RuneAxis, SheetKey | null> = {
  attack: 'attack',
  energy: 'energy',
  speed: 'speed',
  crit: 'critChance',
  critdmg: 'critDmg',
  cdr: 'cdr',
  xp: null,
  gold: null,
};

export type RuneSheetMultipliers = Record<SheetKey, number>;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isRuneAxis(value: unknown): value is RuneAxis {
  return typeof value === 'string' && (RUNE_AXES as readonly string[]).includes(value);
}

/**
 * `heroes[].runas` → the record's rune list. `null`, absent, or not a list is an empty list; an
 * entry that does not carry a known axis, a positive finite strength and finite seconds is
 * dropped on its own — the sheet is still correct without it, so a malformed rune never rejects
 * the hero.
 */
export function readHeroRunes(raw: unknown): HeroRune[] {
  if (!Array.isArray(raw)) return [];
  const runes: HeroRune[] = [];
  for (const entry of raw) {
    if (!isObject(entry)) continue;
    const { e, p, s, r } = entry;
    if (!isRuneAxis(e)) continue;
    if (typeof p !== 'number' || !Number.isFinite(p) || p <= 0) continue;
    if (typeof s !== 'number' || !Number.isFinite(s)) continue;
    const rarity = typeof r === 'number' && Number.isFinite(r) ? Math.max(0, Math.round(r)) : 0;
    runes.push({ axis: e, strengthPct: p * 100, playSecondsLeft: Math.max(0, s), rarity });
  }
  return runes;
}

/** Whichever way a record reached a consumer, its rune list is a list. */
export function runesOf(hero: { runes?: readonly HeroRune[] | null | undefined }): readonly HeroRune[] {
  return hero.runes ?? [];
}

/**
 * A stored record's `runes` field on load — the record shape, not the wire shape. Same
 * forgiveness as {@link readHeroRunes}: absent or malformed is the empty list, one bad entry
 * drops alone.
 */
export function normalizeHeroRunes(raw: unknown): HeroRune[] {
  if (!Array.isArray(raw)) return [];
  const runes: HeroRune[] = [];
  for (const entry of raw) {
    if (!isObject(entry)) continue;
    const { axis, strengthPct, playSecondsLeft, rarity } = entry;
    if (!isRuneAxis(axis)) continue;
    if (typeof strengthPct !== 'number' || !Number.isFinite(strengthPct) || strengthPct <= 0) continue;
    if (typeof playSecondsLeft !== 'number' || !Number.isFinite(playSecondsLeft)) continue;
    runes.push({
      axis,
      strengthPct,
      playSecondsLeft: Math.max(0, playSecondsLeft),
      rarity: typeof rarity === 'number' && Number.isFinite(rarity) ? Math.max(0, Math.round(rarity)) : 0,
    });
  }
  return runes;
}

/** `1` on every key, then `× (1 + p)` per rune on the key its axis names. */
export function runeSheetMultipliers(runes: readonly HeroRune[]): RuneSheetMultipliers {
  const mult = {} as RuneSheetMultipliers;
  for (const key of SHEET_KEYS) mult[key] = 1;
  for (const rune of runes) {
    const key = RUNE_AXIS_SHEET_KEY[rune.axis];
    if (key === null) continue;
    mult[key] *= 1 + rune.strengthPct / 100;
  }
  return mult;
}

export function hasRuneOnSheet(runes: readonly HeroRune[]): boolean {
  return runes.some((rune) => RUNE_AXIS_SHEET_KEY[rune.axis] !== null);
}

/** Composition order: the tree's flat crit-damage add sits OUTSIDE the rune, every other key inside. */
export function applyRuneMultipliers(
  sheet: SheetStats,
  tree: TreeSheetTotals,
  mult: RuneSheetMultipliers,
): SheetStats {
  return {
    attack: sheet.attack * mult.attack,
    energy: sheet.energy * mult.energy,
    speed: sheet.speed * mult.speed,
    critChance: sheet.critChance * mult.critChance,
    critDmg: (sheet.critDmg - tree.critDmgPct) * mult.critDmg + tree.critDmgPct,
    penetration: sheet.penetration,
    cdr: sheet.cdr * mult.cdr,
    luck: sheet.luck,
  };
}

/** Exact inverse of {@link applyRuneMultipliers} — the observed sheet with the runes taken back off. */
export function stripRuneMultipliers(
  sheet: SheetStats,
  tree: TreeSheetTotals,
  mult: RuneSheetMultipliers,
): SheetStats {
  return {
    attack: sheet.attack / mult.attack,
    energy: sheet.energy / mult.energy,
    speed: sheet.speed / mult.speed,
    critChance: sheet.critChance / mult.critChance,
    critDmg: (sheet.critDmg - tree.critDmgPct) / mult.critDmg + tree.critDmgPct,
    penetration: sheet.penetration,
    cdr: sheet.cdr / mult.cdr,
    luck: sheet.luck,
  };
}
