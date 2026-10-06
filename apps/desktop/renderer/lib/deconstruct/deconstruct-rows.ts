import { deconstructBlockReason } from '@bombfarm/domain/deconstruct';
import {
  ITEM_KINDS,
  sortInventoryView,
  type InventorySetGroup,
  type InventorySort,
  type InventorySortDirection,
  type InventoryView,
  type InventoryViewItem,
  type ItemKind,
} from '@bombfarm/domain/inventory-view';
import { sortInventoryViewByValue } from '@bombfarm/game-art';
import { forgeSets, forgeSlots } from '../forge/forge-rows';

export const DECONSTRUCT_LOCATIONS = ['any', 'bag', 'stash'] as const;

export type DeconstructLocation = (typeof DECONSTRUCT_LOCATIONS)[number];

export type DeconstructFilter = {
  readonly text: string;
  /** Empty is every kind. */
  readonly kinds: readonly ItemKind[];
  /** Empty is every rarity. */
  readonly rarities: readonly number[];
  /** Catalog set slugs; `null` is every set and the empty list is a real state that matches
   *  nothing — what the picker holds once every box is unticked. */
  readonly sets: readonly string[] | null;
  readonly slot: string | null;
  /** Item level bounds, inclusive; `null` is open. */
  readonly minLevel: number | null;
  readonly maxLevel: number | null;
  readonly hideForged: boolean;
  /** Highest forge level a row may stand on; `null` is no limit. */
  readonly maxForge: number | null;
  readonly location: DeconstructLocation;
  /** On by default, as in the game: an item that cannot be ticked is out of the way. */
  readonly hideUnburnable: boolean;
  /** Only what is ticked, to read a batch back before burning it. */
  readonly selectedOnly: boolean;
};

export const EMPTY_DECONSTRUCT_FILTER: DeconstructFilter = {
  text: '',
  kinds: [],
  rarities: [],
  sets: null,
  slot: null,
  minLevel: null,
  maxLevel: null,
  hideForged: false,
  maxForge: null,
  location: 'any',
  hideUnburnable: true,
  selectedOnly: false,
};

/** Hiding what cannot be burned is part of the opening filter, so showing everything counts as a
 *  change the clear control undoes. */
export function isEmptyDeconstructFilter(filter: DeconstructFilter): boolean {
  return (
    filter.text.trim() === '' &&
    filter.kinds.length === 0 &&
    filter.rarities.length === 0 &&
    filter.sets === null &&
    filter.slot === null &&
    filter.minLevel === null &&
    filter.maxLevel === null &&
    !filter.hideForged &&
    filter.maxForge === null &&
    filter.location === 'any' &&
    filter.hideUnburnable &&
    !filter.selectedOnly
  );
}

function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
}

/** A chest or a skin package is never listed; an equipped piece is, and cannot be ticked. */
export function deconstructCandidates(items: readonly InventoryViewItem[]): InventoryViewItem[] {
  return items.filter((item) => deconstructBlockReason(item) !== 'not_burnable');
}

/**
 * Set, slot and item level describe gear, so narrowing on any of them hides what is not gear;
 * forge level is the opposite, a ceiling that everything unforged already passes. A ticked row is
 * never hidden for being unburnable, as in the game, and is the only kind "selected only" lets
 * through.
 */
export function filterDeconstructItems(
  items: readonly InventoryViewItem[],
  filter: DeconstructFilter,
  searchText: (item: InventoryViewItem) => string,
  selectedIds: ReadonlySet<string> = new Set(),
): InventoryViewItem[] {
  const needles = fold(filter.text).split(/\s+/).filter(Boolean);
  const kinds = filter.kinds.length > 0 ? new Set(filter.kinds) : null;
  const rarities = filter.rarities.length > 0 ? new Set(filter.rarities) : null;
  const sets = filter.sets ? new Set(filter.sets) : null;
  const byLevel = filter.minLevel !== null || filter.maxLevel !== null;

  return items.filter((item) => {
    const selected = selectedIds.has(item.id);
    if (filter.selectedOnly && !selected) return false;
    if (filter.hideUnburnable && !selected && deconstructBlockReason(item) !== null) return false;
    if (kinds && !kinds.has(item.kind)) return false;
    if (rarities && !rarities.has(item.rarityIdx)) return false;
    if (sets && !sets.has(item.set)) return false;
    if (filter.slot !== null && item.slot !== filter.slot) return false;
    if (byLevel) {
      if (item.kind !== 'equipment') return false;
      if (filter.minLevel !== null && item.level < filter.minLevel) return false;
      if (filter.maxLevel !== null && item.level > filter.maxLevel) return false;
    }
    if (filter.hideForged && item.upgrade > 0) return false;
    if (filter.maxForge !== null && item.upgrade > filter.maxForge) return false;
    if (filter.location === 'stash' && !item.inStash) return false;
    if (filter.location === 'bag' && item.inStash) return false;
    if (needles.length === 0) return true;
    const haystack = fold(searchText(item));
    return needles.every((needle) => haystack.includes(needle));
  });
}

export function deconstructKinds(items: readonly InventoryViewItem[]): ItemKind[] {
  const present = new Set(items.map((item) => item.kind));
  return ITEM_KINDS.filter((kind) => present.has(kind));
}

export function deconstructRarities(items: readonly InventoryViewItem[]): number[] {
  return [...new Set(items.map((item) => item.rarityIdx))].sort((a, b) => a - b);
}

function gearOnly(items: readonly InventoryViewItem[]): InventoryViewItem[] {
  return items.filter((item) => item.kind === 'equipment');
}

export function deconstructSets(items: readonly InventoryViewItem[]): InventorySetGroup[] {
  return forgeSets(gearOnly(items));
}

export function deconstructSlots(items: readonly InventoryViewItem[], order: readonly string[]): string[] {
  return forgeSlots(gearOnly(items), order);
}

export type DeconstructBounds = { readonly min: number; readonly max: number };

/** The range fields are clamped to it, so a bound can never be set outside what the account holds. */
export function deconstructLevelBounds(items: readonly InventoryViewItem[]): DeconstructBounds | null {
  const levels = gearOnly(items).map((item) => item.level);
  return levels.length === 0 ? null : { min: Math.min(...levels), max: Math.max(...levels) };
}

export function deconstructTopForge(items: readonly InventoryViewItem[]): number | null {
  const top = Math.max(0, ...items.map((item) => item.upgrade));
  return top > 0 ? top : null;
}

export function deconstructAnyInStash(items: readonly InventoryViewItem[]): boolean {
  return items.some((item) => item.inStash);
}

/** One flat group of one row per item: the shared view stacks every kind but gear into counted
 *  entries, and a checklist needs each item on its own row. */
export function deconstructTableView(items: readonly InventoryViewItem[]): InventoryView {
  return {
    items: [...items],
    groups: [
      {
        kind: 'other',
        count: items.length,
        entries: items.map((item) => ({ key: item.id, item, count: 1, sellValueGold: item.sellValueGold })),
      },
    ],
    skipped: 0,
  };
}

/** The column's header and the batch order both read it, so the two cannot disagree. */
export function essenceSortValue(item: InventoryViewItem): number {
  return item.essenceValue ?? 0;
}

export function deconstructOrder(
  items: readonly InventoryViewItem[],
  sort: InventorySort,
  nameOf: (item: InventoryViewItem) => string,
  essenceSort: InventorySortDirection | null = null,
): InventoryViewItem[] {
  const sorted = sortInventoryView(deconstructTableView(items), sort, nameOf);
  const ordered = essenceSort === null ? sorted : sortInventoryViewByValue(sorted, essenceSortValue, essenceSort);
  const [group] = ordered.groups;
  return group ? group.entries.map((entry) => entry.item) : [];
}

/** The game account a read belongs to, or `null` when the read names none. */
export function deconstructAccountKey(account: Record<string, unknown> | undefined): string | null {
  const id = account?.account_id;
  if (typeof id === 'number' && Number.isFinite(id)) return String(id);
  return typeof id === 'string' && id.trim() !== '' ? id.trim() : null;
}
