/**
 * The bag table's own filter over the inventory view's gear rows. Pure, no React import. The
 * inventory's shared filter is not reused because this screen narrows on two axes it does not
 * have — a slot and a forge floor — and shows one kind only. The order is the shared table's,
 * which sorts and virtualizes the rows this hands it.
 */
import type { InventoryViewItem } from '@bombfarm/domain/inventory-view';

export const FORGE_MIN_FORGE_OPTIONS = [0, 1, 8, 9, 12, 15] as const;
export type ForgeMinForge = (typeof FORGE_MIN_FORGE_OPTIONS)[number];

export type ForgeFilter = {
  /** The save's hero id; `null` is the whole bag. */
  readonly heroId: string | null;
  readonly text: string;
  readonly slot: string | null;
  readonly minForge: ForgeMinForge;
  readonly rarities: readonly number[];
};

export const EMPTY_FORGE_FILTER: ForgeFilter = { heroId: null, text: '', slot: null, minForge: 0, rarities: [] };

export function isEmptyForgeFilter(filter: ForgeFilter): boolean {
  return (
    filter.heroId === null &&
    filter.text.trim() === '' &&
    filter.slot === null &&
    filter.minForge === 0 &&
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
    if (filter.slot !== null && item.slot !== filter.slot) return false;
    if (item.upgrade < filter.minForge) return false;
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
