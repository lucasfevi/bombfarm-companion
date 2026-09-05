/**
 * The bag table's own filter over the inventory view's gear rows. Pure, no React import. The
 * inventory's shared filter is not reused because this screen narrows on two axes it does not
 * have — a slot and a forge ceiling — and shows one kind only. The order is the shared table's,
 * which sorts and virtualizes the rows this hands it.
 */
import type { InventoryViewItem } from '@bombfarm/domain/inventory-view';

/**
 * The ceiling rungs the toolbar offers, chosen against the ladder rather than spread evenly:
 * `+0` is a piece nobody has touched, `+8` is the safe floor and so the last rung reachable
 * without a roll that can wipe the piece, and `+14` is everything short of a maxed piece. `+4`
 * and `+11` halve the two spans those three leave.
 */
export const FORGE_MAX_FORGE_RUNGS = [0, 4, 8, 11, 14] as const;

/** `null` is every rung — the filter off. */
export type ForgeMaxForge = (typeof FORGE_MAX_FORGE_RUNGS)[number] | null;

/** Whether a piece is on a hero right now. */
export type ForgeWorn = 'all' | 'worn' | 'spare';

export type ForgeFilter = {
  /** The save's hero id; `null` is the whole bag. */
  readonly heroId: string | null;
  readonly text: string;
  readonly slot: string | null;
  readonly worn: ForgeWorn;
  /** The highest forge level a row may already stand at; `null` is every rung. */
  readonly maxForge: ForgeMaxForge;
  readonly rarities: readonly number[];
};

export const EMPTY_FORGE_FILTER: ForgeFilter = {
  heroId: null,
  text: '',
  slot: null,
  worn: 'all',
  maxForge: null,
  rarities: [],
};

export function isEmptyForgeFilter(filter: ForgeFilter): boolean {
  return (
    filter.heroId === null &&
    filter.text.trim() === '' &&
    filter.slot === null &&
    filter.worn === 'all' &&
    filter.maxForge === null &&
    filter.rarities.length === 0
  );
}

function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
}

export function gearOf(items: readonly InventoryViewItem[]): InventoryViewItem[] {
  return items.filter((item) => item.kind === 'equipment');
}

export function filterForgeItems(
  gear: readonly InventoryViewItem[],
  filter: ForgeFilter,
  searchText: (item: InventoryViewItem) => string,
): InventoryViewItem[] {
  const needles = fold(filter.text).split(/\s+/).filter(Boolean);
  const rarities = filter.rarities.length > 0 ? new Set(filter.rarities) : null;

  return gear.filter((item) => {
    if (filter.heroId !== null && item.equippedBy !== filter.heroId) return false;
    if (filter.worn === 'worn' && item.equippedBy === null) return false;
    if (filter.worn === 'spare' && item.equippedBy !== null) return false;
    if (filter.slot !== null && item.slot !== filter.slot) return false;
    if (filter.maxForge !== null && item.upgrade > filter.maxForge) return false;
    if (rarities && !rarities.has(item.rarityIdx)) return false;
    if (needles.length === 0) return true;
    const haystack = fold(searchText(item));
    return needles.every((needle) => haystack.includes(needle));
  });
}

/** Hero ids that wear gear in the bag, field heroes first, then by the caller's name. */
export function forgeHeroIds(
  gear: readonly InventoryViewItem[],
  inField: (heroId: string) => boolean,
  nameOf: (heroId: string) => string,
): string[] {
  const ids = [...new Set(gear.flatMap((item) => (item.equippedBy === null ? [] : [item.equippedBy])))];
  return ids.sort((a, b) => Number(inField(b)) - Number(inField(a)) || nameOf(a).localeCompare(nameOf(b)));
}

export function forgeSlots(gear: readonly InventoryViewItem[], order: readonly string[]): string[] {
  const present = new Set(gear.flatMap((item) => (item.slot === null ? [] : [item.slot])));
  return order.filter((slot) => present.has(slot));
}

export function forgeRarities(gear: readonly InventoryViewItem[]): number[] {
  return [...new Set(gear.map((item) => item.rarityIdx))].sort((a, b) => a - b);
}
