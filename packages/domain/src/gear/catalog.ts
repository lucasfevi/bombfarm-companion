import catalog from '../data/catalog.json';
import type { Lang } from '../shims/i18n';
import { formatItemDisplay } from '../game-labels';
import type {
  EquippedItem,
  GearBonuses,
  Loadout,
  ScaledValor,
  SheetOtherPct,
  Slot,
} from './types';

/** Forja upgrade: +0…+15. `upgrade_mult = 1 + 0.08 × N` (wiki itens.forja.bonus). */
export const FORJA_BONUS = 0.08;
export const FORJA_MAX = 15;
export const FORJA_LEVELS = Array.from({ length: FORJA_MAX + 1 }, (_, index) => index);

export const SLOTS: Slot[] = [...catalog.slots];
export const ITEM_LEVELS: number[] = [...catalog.levels];
export const ITEM_RARITIES = catalog.rarities;
export const SETS_BY_LEVEL: Record<string, string[]> = catalog.setsByLevel;

/**
 * Catalog v4: Dano has two regimes. Below this item level it is a flat number
 * that scales on the `nivelMult` ladder; at or above it, the roll is a fraction
 * of the hero's Attack (`dmgPct`) and leaves the ladder entirely.
 * The regime follows the ITEM's level, not its def's `nativeLevel` — a def can
 * be scaled across the boundary.
 */
export const DMG_PCT_MIN_LEVEL = catalog.dmgPctMinLevel;
const DMG_PCT_BY_LEVEL = catalog.dmgPct as Record<string, number>;

export function isDmgPctLevel(level: number): boolean {
  return level >= DMG_PCT_MIN_LEVEL;
}

const defById = new Map(catalog.defs.map((definition) => [definition.id, definition]));

export function emptyLoadout(): Loadout {
  return Object.fromEntries(SLOTS.map((slot) => [slot, null]));
}

export function defsForSlot(slot: Slot, set?: string) {
  return catalog.defs.filter((definition) => definition.slot === slot && (set == null || definition.set === set));
}

export function setsForLevel(level: number): string[] {
  return SETS_BY_LEVEL[String(level)] ?? [];
}

export function upgradeMult(upgrade: number): number {
  const clampedUpgrade = Math.max(0, Math.min(FORJA_MAX, Math.round(upgrade)));
  return 1 + FORJA_BONUS * clampedUpgrade;
}

export function itemLabel(item: EquippedItem, lang: Lang = 'pt'): string {
  return formatItemDisplay(item, lang);
}

/**
 * Scale valores (stored at definition.nativeLevel) to item level, then apply forja upgrade.
 * Flat Dano stays fractional (e.g. 96.25 × 1.8 = 173.25) — the sheet sums the
 * raw values; ceil was overstating attack by 0.5 per half-point piece.
 *
 * Dano is the exception to plain ladder scaling: from {@link DMG_PCT_MIN_LEVEL}
 * up it is a fraction of Attack, read off `dmgPct` for the TARGET level rather
 * than rescaled from the def's stored roll. Every def shares one Dano base per
 * level, so the def only supplies which stats it rolls and in what order.
 * `unit` tells callers which regime a roll came back in.
 */
export function scaledValores(defId: string, rarityIdx: number, level: number, upgrade = 0) {
  const definition = defById.get(defId);
  if (!definition) return [] as ScaledValor[];
  const nativeMult = (catalog.nivelMult as Record<string, number>)[String(definition.nativeLevel)] ?? 1;
  const itemMult = (catalog.nivelMult as Record<string, number>)[String(level)] ?? nativeMult;
  const forja = upgradeMult(upgrade);
  const scale = (itemMult / nativeMult) * forja;
  const count = ITEM_RARITIES[rarityIdx]?.statCount ?? 1;
  return definition.valores.slice(0, count).map((roll): ScaledValor => {
    if (roll.stat !== 'dmg') return { stat: roll.stat, valor: roll.valor * scale, unit: 'pct' };
    if (isDmgPctLevel(level)) {
      return { stat: roll.stat, valor: (DMG_PCT_BY_LEVEL[String(level)] ?? 0) * forja, unit: 'pct' };
    }
    return { stat: roll.stat, valor: roll.valor * scale, unit: 'flat' };
  });
}

export function sumGearBonuses(loadout: Loadout): GearBonuses {
  const totals: GearBonuses = {
    dmgFlat: 0,
    dmgPct: 0,
    energyPct: 0,
    speedPct: 0,
    luckPct: 0,
    critPct: 0,
    penPct: 0,
    cdrPct: 0,
  };
  for (const slot of SLOTS) {
    const equipped = loadout[slot];
    if (!equipped) continue;
    for (const { stat, valor, unit } of scaledValores(equipped.defId, equipped.rarityIdx, equipped.level, equipped.upgrade ?? 0)) {
      switch (stat) {
        case 'dmg':
          if (unit === 'pct') totals.dmgPct += valor;
          else totals.dmgFlat += valor;
          break;
        case 'energia':
          totals.energyPct += valor;
          break;
        case 'velocidade':
          totals.speedPct += valor;
          break;
        case 'sorte':
          totals.luckPct += valor;
          break;
        case 'crit':
          totals.critPct += valor;
          break;
        case 'penetracao':
          totals.penPct += valor;
          break;
        case 'cooldown':
          totals.cdrPct += valor;
          break;
      }
    }
  }
  return totals;
}

/**
 * ⚠ UNCONFIRMED ASSUMPTION (catalog v4, 2026-08-11). The wiki states only that a
 * nv50+ item's Dano is "% da Ataque do herói" and never says which Attack. We
 * assume it multiplies the NAKED attack, with flat gear Dano and spent attack
 * points added outside the product:
 *
 *   attack = naked × (1 + Σ dmgPct) + Σ dmgFlat + points × atkPt
 *
 * Chosen because it matches how this codebase already treats every other percent
 * stat (`sharedForward` multiplies the naked base; flat gains sit outside).
 * The live alternative is that points fall INSIDE the product.
 *
 * This could not be settled empirically: the server wipe destroyed the save
 * exports, so re-capture needs a hero re-levelled to nv50+ gear. To flip the
 * assumption, change only these two functions — every caller routes through them.
 */
export function composeAttack(nakedAttack: number, bonuses: GearBonuses, flatPoints = 0): number {
  return nakedAttack * (1 + bonuses.dmgPct) + bonuses.dmgFlat + flatPoints;
}

/** Exact inverse of {@link composeAttack}; recovers naked attack from a sheet. */
export function decomposeAttack(attack: number, bonuses: GearBonuses, flatPoints = 0): number {
  const den = 1 + bonuses.dmgPct;
  const stripped = attack - bonuses.dmgFlat - flatPoints;
  return den > 1e-9 ? stripped / den : stripped;
}

/**
 * Absolute clone−current deltas in the same units as {@link GearBonuses}
 * (flat damage; percent stats as fractions). Used for Totals · Clone diffs.
 */
export function gearBonusDeltas(current: GearBonuses, alt: GearBonuses): GearBonuses {
  return {
    dmgFlat: alt.dmgFlat - current.dmgFlat,
    dmgPct: alt.dmgPct - current.dmgPct,
    energyPct: alt.energyPct - current.energyPct,
    speedPct: alt.speedPct - current.speedPct,
    luckPct: alt.luckPct - current.luckPct,
    critPct: alt.critPct - current.critPct,
    penPct: alt.penPct - current.penPct,
    cdrPct: alt.cdrPct - current.cdrPct,
  };
}

/** Scaled stat rolls for one equipped item (respects rarity stat count). */
export function itemValores(item: EquippedItem): ScaledValor[] {
  return scaledValores(item.defId, item.rarityIdx, item.level, item.upgrade ?? 0);
}

export function emptySheetOther(): SheetOtherPct {
  return { speed: 0, critChance: 0, critDmgFlat: 0, penetration: 0, cdr: 0 };
}

/**
 * Gems→stars ritual (wiki "Gemas & Estrelas" + in-game capture 2026-07-23): each ★
 * multiplies intrinsic sheet stats by 1 + 0.5×★ before items — Attack, Energy, Crit %,
 * Crit Dmg, Penetration, CDR, Luck. Speed is exempt (unequipped + geared sheets stay
 * flat across ★).
 *
 * Lives here (not naked-rescale.ts, its design "ships" home) because both `apply.ts`
 * and `naked-rescale.ts` call it; putting it in either would force the other to import
 * across the apply↔naked-rescale boundary the `rescaleCatalogApply` indirection exists
 * to avoid. `catalog.ts` is a shared downward dependency of both, so it stays cycle-free.
 */
export function starsMult(stars: number): number {
  return 1 + 0.5 * Math.max(0, Math.min(3, Math.round(stars)));
}
