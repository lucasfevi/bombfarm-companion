import catalog from '@/shared/domain/data/catalog.json';
import type { Lang } from '@/shared/i18n';
import { formatItemDisplay } from '@/shared/domain/game-labels';
import type {
  EquippedItem,
  GearBonuses,
  ItemStat,
  Loadout,
  SheetOtherPct,
  Slot,
} from '@/shared/domain/gear/types';

/** Forja upgrade: +0…+15. `upgrade_mult = 1 + 0.08 × N` (wiki itens.forja.bonus). */
export const FORJA_BONUS = 0.08;
export const FORJA_MAX = 15;
export const FORJA_LEVELS = Array.from({ length: FORJA_MAX + 1 }, (_, index) => index);

export const SLOTS: Slot[] = [...catalog.slots];
export const ITEM_LEVELS: number[] = [...catalog.levels];
export const ITEM_RARITIES = catalog.rarities;
export const SETS_BY_LEVEL: Record<string, string[]> = catalog.setsByLevel;

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
 * Flat Dano stays fractional (e.g. 137.5 × 1.8 = 247.5) — the sheet sums the
 * raw values; ceil was overstating attack by 0.5 per half-point piece.
 */
export function scaledValores(defId: string, rarityIdx: number, level: number, upgrade = 0) {
  const definition = defById.get(defId);
  if (!definition) return [] as { stat: ItemStat; valor: number }[];
  const nativeMult = (catalog.nivelMult as Record<string, number>)[String(definition.nativeLevel)] ?? 1;
  const itemMult = (catalog.nivelMult as Record<string, number>)[String(level)] ?? nativeMult;
  const scale = (itemMult / nativeMult) * upgradeMult(upgrade);
  const count = ITEM_RARITIES[rarityIdx]?.statCount ?? 1;
  return definition.valores.slice(0, count).map((roll) => ({
    stat: roll.stat,
    valor: roll.valor * scale,
  }));
}

export function sumGearBonuses(loadout: Loadout): GearBonuses {
  const totals: GearBonuses = {
    dmgFlat: 0,
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
    for (const { stat, valor } of scaledValores(equipped.defId, equipped.rarityIdx, equipped.level, equipped.upgrade ?? 0)) {
      switch (stat) {
        case 'dmg':
          totals.dmgFlat += valor;
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
 * Absolute clone−current deltas in the same units as {@link GearBonuses}
 * (flat damage; percent stats as fractions). Used for Totals · Clone diffs.
 */
export function gearBonusDeltas(current: GearBonuses, alt: GearBonuses): GearBonuses {
  return {
    dmgFlat: alt.dmgFlat - current.dmgFlat,
    energyPct: alt.energyPct - current.energyPct,
    speedPct: alt.speedPct - current.speedPct,
    luckPct: alt.luckPct - current.luckPct,
    critPct: alt.critPct - current.critPct,
    penPct: alt.penPct - current.penPct,
    cdrPct: alt.cdrPct - current.cdrPct,
  };
}

/** Scaled stat rolls for one equipped item (respects rarity stat count). */
export function itemValores(item: EquippedItem): { stat: ItemStat; valor: number }[] {
  return scaledValores(item.defId, item.rarityIdx, item.level, item.upgrade ?? 0);
}

export function emptySheetOther(): SheetOtherPct {
  return { speed: 0, critChance: 0, critDmg: 0, penetration: 0, cdr: 0 };
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
