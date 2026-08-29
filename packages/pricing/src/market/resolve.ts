import { listingUrl } from './endpoints.js';
import type { MarketEntry, MarketSnapshot } from './types.js';
import { categoryKey, priceKey } from './types.js';

export type PriceState =
  /** The game marks the item untradable; it can never have a market price. */
  | 'not-tradable'
  /** Tradable, but nothing under this key has ever appeared on the market. */
  | 'unknown'
  /** Known to the market, with no active listing right now. */
  | 'no-listing'
  | 'priced';

/** The fields of an owned inventory item that pricing needs. Matches `InventoryItem`. */
export interface PriceableItem {
  defId: string;
  rarity: number;
  tradable: boolean;
}

export interface ResolvedPrice {
  state: PriceState;
  key: string | null;
  hashName: string | null;
  listingUrl: string | null;
  /** Lowest active listing in USD on the quoted hash. */
  lowestUsd: number | null;
  /** `lowestUsd` converted into `currency`, or null when unpriced. */
  amount: number | null;
  currency: string;
  listings: number;
  /**
   * Other live hashes carrying the same item. The game renamed its items after launch and Steam
   * hashes are immutable, so a single item can have two order books; this is the rest of them.
   */
  alternateHashNames: string[];
}

const unpriced = (
  state: PriceState,
  key: string | null,
  entry: MarketEntry | null,
  currency: string,
  url: string | null = null,
): ResolvedPrice => ({
  state,
  key,
  hashName: entry?.hashName ?? null,
  listingUrl: url,
  lowestUsd: null,
  amount: null,
  currency,
  listings: entry?.listings ?? 0,
  alternateHashNames: [],
});

/** The market key for an owned inventory item. */
export function keyForItem(item: PriceableItem): string {
  return priceKey(item.defId, item.rarity);
}

export { categoryKey };

/**
 * Price anything in the snapshot by its key. Equipment keys are `priceKey(defId, rarity)`;
 * chests, cages, gems, skins and skill stones key on their Steam category — see `categoryKey`.
 */
export function resolveKey(
  key: string,
  snapshot: MarketSnapshot | null,
  currency = 'USD',
): ResolvedPrice {
  const code = currency.toUpperCase();
  if (snapshot == null) return unpriced('unknown', key, null, code);

  const position = snapshot.index[key];
  const entry = position == null ? null : (snapshot.entries[position] ?? null);
  if (entry == null) return unpriced('unknown', key, null, code);

  const url = listingUrl(snapshot.appId, entry.hashName);
  const alternateHashNames = (snapshot.alternates[key] ?? [])
    .map((other) => snapshot.entries[other]?.hashName)
    .filter((hashName): hashName is string => hashName != null);

  if (entry.lowestUsd == null) return unpriced('no-listing', key, entry, code, url);

  const rate = snapshot.fx[code] ?? (code === 'USD' ? 1 : null);

  return {
    state: 'priced',
    key,
    hashName: entry.hashName,
    listingUrl: url,
    lowestUsd: entry.lowestUsd,
    amount: entry.lowestUsd * (rate ?? 1),
    currency: rate == null ? 'USD' : code,
    listings: entry.listings,
    alternateHashNames,
  };
}

/**
 * Price one owned item against the published snapshot. Pure and network-free, so the web planner
 * and the desktop app resolve identically from the same asset.
 *
 * The quoted hash is the most liquid one carrying this item, because the cheapest listing on a
 * hash nobody trades is not a price anyone can get. `alternateHashNames` names the others.
 */
export function resolveItemPrice(
  item: PriceableItem,
  snapshot: MarketSnapshot | null,
  currency = 'USD',
): ResolvedPrice {
  const code = currency.toUpperCase();
  if (!item.tradable) return unpriced('not-tradable', null, null, code);
  return resolveKey(keyForItem(item), snapshot, currency);
}

export function marketEntryFor(
  item: PriceableItem,
  snapshot: MarketSnapshot | null,
): MarketEntry | null {
  if (snapshot == null) return null;
  const position = snapshot.index[keyForItem(item)];
  if (position == null) return null;
  return snapshot.entries[position] ?? null;
}
