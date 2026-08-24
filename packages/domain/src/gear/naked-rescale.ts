import { BASE_ROLLS, HERO_MAX_LEVEL, levelPowerMult, type AbilityEffect, type AbilityMods, type RarityKey } from '../model';
import { applyGear } from './apply';
import { emptySheetOther, starsMult } from './catalog';
import type {
  HeroSheetRescale,
  Loadout,
  SheetOtherPct,
  SheetStats,
} from './types';
import { SHEET_KEYS } from '../planner-constants';

/**
 * The naked (unequipped, in-game) sheet midpoints per rarity. Attack scales with level
 * and stars; Energy / Crit % / Crit Dmg / Pen / CDR / Luck scale with stars; Speed does not.
 * Luck has no `other` term and no level term (AD-BSP-19, ASM-02, ASM-04).
 * The two flat sheet-ability addends (Olho Clínico's crit points, Golpe Brutal's crit damage)
 * are added after the star factor rather than pooled, matching `nakedFromBirth`.
 */
export function defaultNaked(
  rarity: RarityKey,
  level = 0,
  other: SheetOtherPct = emptySheetOther(),
  stars = 0,
): SheetStats {
  const base = BASE_ROLLS[rarity];
  const otherClamped = (percent: number) => Math.max(0, percent);
  const mult = starsMult(stars);
  return {
    attack: base.attack * levelPowerMult(level) * mult,
    energy: base.energy * mult,
    speed: base.speed * (1 + otherClamped(other.speed)),
    // Flat sheet-ability addends, applied after the star factor — match `nakedFromBirth`.
    critChance: base.critChance * mult + otherClamped(other.critChanceFlat),
    critDmg: base.critDmg * mult + otherClamped(other.critDmgFlat),
    penetration: base.penetration * (1 + otherClamped(other.penetration)) * mult,
    cdr: base.cdr * (1 + otherClamped(other.cdr)) * mult,
    // AD-BSP-19: star-scaled, no `other` term (ASM-02) and level-independent (ASM-04).
    luck: base.luck * mult,
  };
}

/** Level-up only rescales Attack; every other naked stat (custom or formula) is untouched. */
export function rescaleNakedForLevel(
  naked: SheetStats,
  fromLevel: number,
  toLevel: number,
): SheetStats {
  const ratio = levelPowerMult(toLevel) / levelPowerMult(fromLevel);
  return ratio === 1 ? naked : { ...naked, attack: naked.attack * ratio };
}

/** Spending/removing a sheet pen ability (e.g. Ponta de Diamante) rescales naked pen by the other-ratio. */
export function rescaleNakedPen(
  naked: SheetStats,
  oldOtherRaw: number,
  newOtherRaw: number,
): SheetStats {
  const oldO = Math.max(0, oldOtherRaw);
  const newO = Math.max(0, newOtherRaw);
  if (oldO === newO) return naked;
  const ratio = (1 + newO) / (1 + oldO);
  return { ...naked, penetration: naked.penetration * ratio };
}

/**
 * Spending/removing a sheet crit-damage ability (Golpe Brutal) shifts naked crit dmg by the
 * FLAT difference in the ability's contribution — not a ratio, because crit damage is
 * flat-additive (`POINT_GAIN.critDmgFlat`). The hero's own roll is preserved exactly, which is
 * what `rescaleNakedPen` achieves by ratio for the pooled pen ability and what
 * a rarity-midpoint reset would not (DEC-06 / BSP-31a).
 *
 * Arguments are the previous/next ability Σ in planner percentage points
 * (`AbilityMods.sheetCritDmgFlat`), not fractions.
 */
export function rescaleNakedCritDmg(
  naked: SheetStats,
  oldFlat: number,
  newFlat: number,
): SheetStats {
  const oldF = Math.max(0, oldFlat);
  const newF = Math.max(0, newFlat);
  if (oldF === newF) return naked;
  return { ...naked, critDmg: naked.critDmg - oldF + newF };
}

/**
 * Spending/removing a sheet crit-chance ability (Olho Clínico) swaps its FLAT addend on the
 * naked sheet — the hero's own roll is preserved, exactly like `rescaleNakedCritDmg`. It was a
 * ratio rescale while the ability was a percentage of the roll; the 2026-08-23 patch made it
 * points (see the `critChanceFlat` ability kind).
 */
export function rescaleNakedCritChance(
  naked: SheetStats,
  oldFlat: number,
  newFlat: number,
): SheetStats {
  const oldF = Math.max(0, oldFlat);
  const newF = Math.max(0, newFlat);
  if (oldF === newF) return naked;
  return { ...naked, critChance: naked.critChance - oldF + newF };
}

/**
 * `DEC-04` / `BSP-31a` — picks and applies the correct sheet-ability rescaler for a level
 * change, dispatching on `AbilityEffect['kind']`. Moving the *decision* here makes it
 * unit-testable; `use-hero-build-actions.ts` (which has no test harness — no React component
 * test framework in this repo) becomes a one-line caller. Returns `naked` unchanged for every
 * non-sheet-ability kind.
 */
export function nakedAfterSheetAbilityChange(
  naked: SheetStats,
  kind: AbilityEffect['kind'],
  prevMods: AbilityMods,
  nextMods: AbilityMods,
): SheetStats {
  switch (kind) {
    case 'critChanceFlat':
      return rescaleNakedCritChance(naked, prevMods.sheetCritChanceFlat, nextMods.sheetCritChanceFlat);
    case 'penetrationPp':
      return rescaleNakedPen(naked, prevMods.sheetPenetrationRaw, nextMods.sheetPenetrationRaw);
    case 'critDmgFlat':
      return rescaleNakedCritDmg(naked, prevMods.sheetCritDmgFlat, nextMods.sheetCritDmgFlat);
    default:
      return naked;
  }
}

/**
 * Adding/removing a ★ (gems ritual) rescales every naked sheet stat except Speed
 * (Attack, Energy, Crit %, Crit Dmg, Penetration, CDR, Luck).
 *
 * `critChanceFlat` / `critDmgFlat` are the two sheet-ability addends already inside `naked`
 * (`SheetOtherPct`). Both are held OUT of the ★ ratio so this stays the algebraic inverse of
 * `nakedFromBirth` (`birth × star + flat`); leaving them in would silently star-scale Olho
 * Clínico's and Golpe Brutal's contributions. Both default to `0`, which is exactly the old
 * behaviour for every hero without the abilities. Whether the game itself star-scales those
 * terms is unobserved — no capture pairs ★>0 with either contribution — so this follows
 * `nakedFromBirth` rather than inventing a second answer.
 */
export function rescaleNakedForStars(
  naked: SheetStats,
  fromStars: number,
  toStars: number,
  critDmgFlat = 0,
  critChanceFlat = 0,
): SheetStats {
  const ratio = starsMult(toStars) / starsMult(fromStars);
  if (ratio === 1) return naked;
  const flat = Math.max(0, critDmgFlat);
  const critFlat = Math.max(0, critChanceFlat);
  return {
    ...naked,
    attack: naked.attack * ratio,
    energy: naked.energy * ratio,
    critChance: (naked.critChance - critFlat) * ratio + critFlat,
    critDmg: (naked.critDmg - flat) * ratio + flat,
    penetration: naked.penetration * ratio,
    cdr: naked.cdr * ratio,
    luck: naked.luck * ratio,
  };
}

/**
 * Spyable catalog apply for hero rescale. Same-module `applyGear` calls are not
 * interceptable via `vi.spyOn(module, 'applyGear')`; tests spy this object instead
 * to assert both catalog calls receive non-empty sheetOther (LVL-06).
 */
export const rescaleCatalogApply = { applyGear };

/**
 * Re-apply catalog gear after a naked rescale, preserving per-stat residual
 * (typed geared − old catalog). Both applyGear calls must receive sheetOther.
 */
function rescaleHeroSheets(
  naked: SheetStats,
  geared: SheetStats,
  loadout: Loadout,
  sheetOther: SheetOtherPct,
  newNaked: SheetStats,
): HeroSheetRescale {
  if (newNaked === naked) return { naked, geared };
  const oldCatalog = rescaleCatalogApply.applyGear(naked, loadout, sheetOther);
  const newCatalog = rescaleCatalogApply.applyGear(newNaked, loadout, sheetOther);
  const next: SheetStats = { ...newCatalog };
  for (const key of SHEET_KEYS) {
    next[key] = newCatalog[key] + (geared[key] - oldCatalog[key]);
  }
  return { naked: newNaked, geared: next };
}

/** Level change: rescale naked attack, then residual + re-apply geared. */
export function rescaleHeroForLevel(
  naked: SheetStats,
  geared: SheetStats,
  loadout: Loadout,
  sheetOther: SheetOtherPct,
  fromLevel: number,
  toLevel: number,
): HeroSheetRescale {
  if (fromLevel === toLevel) return { naked, geared };
  return rescaleHeroSheets(
    naked,
    geared,
    loadout,
    sheetOther,
    rescaleNakedForLevel(naked, fromLevel, toLevel),
  );
}

/** Stars change: rescale naked (all starred stats; Speed exempt), then residual + re-apply geared. */
export function rescaleHeroForStars(
  naked: SheetStats,
  geared: SheetStats,
  loadout: Loadout,
  sheetOther: SheetOtherPct,
  fromStars: number,
  toStars: number,
): HeroSheetRescale {
  if (fromStars === toStars) return { naked, geared };
  return rescaleHeroSheets(
    naked,
    geared,
    loadout,
    sheetOther,
    rescaleNakedForStars(naked, fromStars, toStars, sheetOther.critDmgFlat, sheetOther.critChanceFlat),
  );
}

/** Level-up CTA: enabled below the game's hero level ceiling ({@link HERO_MAX_LEVEL}). */
export function canLevelUp(level: number): boolean {
  return level < HERO_MAX_LEVEL;
}

/** Star-upgrade CTA: enabled when stars < 3. */
export function canStarUp(stars: number): boolean {
  return stars < 3;
}

/** +1 level target for Level-up CTA (clamped). */
export function nextLevelStep(level: number): number {
  return Math.min(HERO_MAX_LEVEL, Math.max(0, Math.round(level)) + 1);
}

/** +1 star target for Star-upgrade CTA (clamped). */
export function nextStarsStep(stars: number): number {
  return Math.min(3, Math.max(0, Math.round(stars)) + 1);
}
