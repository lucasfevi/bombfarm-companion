/**
 * The bag table's own filter, order and cap over the inventory view's gear rows. Pure, no React
 * import. The inventory's shared filter is not reused because this table narrows on two axes it
 * does not have — a slot and a forge floor — and shows one kind only.
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

export type ForgeSortKey = 'item' | 'slot' | 'level' | 'forge' | 'power' | 'buys';
export type ForgeSortDirection = 'asc' | 'desc';
export type ForgeSort = { readonly key: ForgeSortKey; readonly direction: ForgeSortDirection };

export const DEFAULT_FORGE_SORT: ForgeSort = { key: 'forge', direction: 'desc' };

const TEXT_KEYS: ReadonlySet<ForgeSortKey> = new Set<ForgeSortKey>(['item', 'slot']);

/** Re-picking the leading column flips it; a new column opens the way a reader expects — words
 *  smallest-first, numbers largest-first. */
export function nextForgeSort(sort: ForgeSort, key: ForgeSortKey): ForgeSort {
  if (sort.key === key) return { key, direction: sort.direction === 'asc' ? 'desc' : 'asc' };
  return { key, direction: TEXT_KEYS.has(key) ? 'asc' : 'desc' };
}

export type ForgeRow = {
  item: InventoryViewItem;
  /** What the next rung buys the wearer, as a fraction; `null` for a row nobody wears. */
  buys: number | null;
};

function numberOf(row: ForgeRow, key: ForgeSortKey): number {
  switch (key) {
    case 'level':
      return row.item.level;
    case 'forge':
      return row.item.upgrade;
    case 'power':
      return row.item.power;
    case 'item':
    case 'slot':
    case 'buys':
      return 0;
  }
}

/** Ties break on power, then on the item id, so the order is the same on every render. */
function tieBreak(a: ForgeRow, b: ForgeRow): number {
  return b.item.power - a.item.power || a.item.id.localeCompare(b.item.id);
}

export function sortForgeRows(
  rows: readonly ForgeRow[],
  sort: ForgeSort,
  nameOf: (item: InventoryViewItem) => string,
  slotNameOf: (item: InventoryViewItem) => string,
): ForgeRow[] {
  const sign = sort.direction === 'asc' ? 1 : -1;
  const compare = (a: ForgeRow, b: ForgeRow): number => {
    if (sort.key === 'buys') {
      // An unworn row has nothing to buy and sinks in both directions, or cheapest-first would
      // open with every piece the figure cannot be computed for.
      if (a.buys === null && b.buys === null) return tieBreak(a, b);
      if (a.buys === null) return 1;
      if (b.buys === null) return -1;
      return sign * (a.buys - b.buys) || tieBreak(a, b);
    }
    if (TEXT_KEYS.has(sort.key)) {
      const text = sort.key === 'item' ? nameOf : slotNameOf;
      return sign * text(a.item).localeCompare(text(b.item)) || tieBreak(a, b);
    }
    return sign * (numberOf(a, sort.key) - numberOf(b, sort.key)) || tieBreak(a, b);
  };
  return [...rows].sort(compare);
}

export const FORGE_ROW_CAP = 400;

export function capForgeRows(rows: readonly ForgeRow[]): { rows: ForgeRow[]; hidden: number } {
  if (rows.length <= FORGE_ROW_CAP) return { rows: [...rows], hidden: 0 };
  return { rows: rows.slice(0, FORGE_ROW_CAP), hidden: rows.length - FORGE_ROW_CAP };
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
