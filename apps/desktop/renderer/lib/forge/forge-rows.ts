/**
 * The bag table's own filter over the inventory view's gear rows. Pure, no React import. The
 * inventory's shared filter is not reused because this screen narrows on two axes it does not
 * have — a slot and a stretch of the forge ladder — and shows one kind only. The order is the
 * shared table's, which sorts and virtualizes the rows this hands it.
 */
import type { InventoryViewItem } from '@bombfarm/domain/inventory-view';

/**
 * The stretches of the forge ladder the toolbar offers. The two lowest are single rungs because
 * they are the ones worth asking for exactly — `+0` is a piece nobody has touched and `+8` is the
 * safe floor, the last rung reachable without a roll that can wipe the piece; above the floor a
 * reader is choosing a stretch rather than a rung.
 *
 * The bands share their endpoints on purpose: a piece at `+10` is in both the band that ends
 * there and the band that starts there, because a reader looking at either stretch wants the
 * pieces sitting on its edge.
 */
export const FORGE_BANDS = ['at0', 'at8', '8to10', '10to12', '12to14', 'from14'] as const;

/** `null` is every rung — the filter off. */
export type ForgeBand = (typeof FORGE_BANDS)[number];

/** Inclusive at both ends; a `to` of `null` is a band that never closes. */
export const FORGE_BAND_RANGE: Record<ForgeBand, { readonly from: number; readonly to: number | null }> = {
  at0: { from: 0, to: 0 },
  at8: { from: 8, to: 8 },
  '8to10': { from: 8, to: 10 },
  '10to12': { from: 10, to: 12 },
  '12to14': { from: 12, to: 14 },
  from14: { from: 14, to: null },
};

export function forgeBandHolds(band: ForgeBand, upgrade: number): boolean {
  const { from, to } = FORGE_BAND_RANGE[band];
  return upgrade >= from && (to === null || upgrade <= to);
}

export type ForgeFilter = {
  /** The save's hero id; `null` is the whole bag. */
  readonly heroId: string | null;
  readonly text: string;
  readonly slot: string | null;
  /** On, only the pieces a hero is wearing right now. Off is the whole bag, worn or not — there
   *  is no third state, because "nobody wearing it" plus a chosen hero is a cut that can only
   *  ever show nothing. */
  readonly worn: boolean;
  /** The stretch of the ladder a row must already stand on; `null` is every rung. */
  readonly forge: ForgeBand | null;
  readonly rarities: readonly number[];
};

export const EMPTY_FORGE_FILTER: ForgeFilter = {
  heroId: null,
  text: '',
  slot: null,
  worn: false,
  forge: null,
  rarities: [],
};

export function isEmptyForgeFilter(filter: ForgeFilter): boolean {
  return (
    filter.heroId === null &&
    filter.text.trim() === '' &&
    filter.slot === null &&
    !filter.worn &&
    filter.forge === null &&
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
    if (filter.worn && item.equippedBy === null) return false;
    if (filter.slot !== null && item.slot !== filter.slot) return false;
    if (filter.forge !== null && !forgeBandHolds(filter.forge, item.upgrade)) return false;
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

/** Whether the Equipped chip has anything to narrow to — offered only when it has. */
export function forgeAnyEquipped(gear: readonly InventoryViewItem[]): boolean {
  return gear.some((item) => item.equippedBy !== null);
}

export function forgeRarities(gear: readonly InventoryViewItem[]): number[] {
  return [...new Set(gear.map((item) => item.rarityIdx))].sort((a, b) => a - b);
}
