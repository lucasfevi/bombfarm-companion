import { listingUrl } from './endpoints.js';
import { boughtSkinHashFor } from './tags.js';
import type { MarketEntry, MarketSnapshot } from './types.js';
import { SKIN_CATEGORY, categoryKey, heroPriceKey, priceKey } from './types.js';

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

/** The fields of an owned hero that pricing needs. Matches the roster record. */
export interface PriceableHero {
  rarity: number;
  /**
   * The game's own marketable flag, and the field that governs whether a hero can be sold at all.
   * Every account-bound hero carries it false.
   *
   * Whether it survives the player LISTING a hero is unobserved: no capture has ever held a hero
   * that was on the market, so there is nothing to read it off. A listed hero is still owned until
   * it sells and should still count, so if the flag does flip while listed, this under-reports.
   */
  marketable: boolean;
}

/**
 * Where `amount` came from. `native` is the number Steam shows on `listingUrl`; `converted` is
 * `lowestUsd` at the day's rate, which Steam's regional pricing does not track exactly. A UI that
 * links to the listing should say which of the two it is showing.
 */
export type PriceBasis = 'native' | 'converted';

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
  basis: PriceBasis;
  /**
   * When the quoted `amount` was read from Steam: the native quote's own timestamp when
   * `basis` is `native`, the enumeration's when it is `converted`. Null only when unpriced —
   * every `priced` result carries a timestamp, so a caller never has to date a price it is
   * showing by guesswork.
   */
  quotedUtc: string | null;
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
  basis: 'converted',
  quotedUtc: null,
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

  // The enumeration decides whether anything is for sale, and the native quote never overrides
  // that. `priceoverview` under-reports — it answers with no price at all for items the search
  // endpoint carries as live — so treating its silence as "unlisted" would delist real supply.
  if (entry.lowestUsd == null) return unpriced('no-listing', key, entry, code, url);

  // An undated native quote is not usable as one. It is a price with no provenance, and the
  // basis exists so a reader can click through and check the number against the listing —
  // which needs to know how old it is. Converting from USD loses 0.6-1.2% of exactness and
  // gains a timestamp `fetchedUtc` always carries, and that is the better trade.
  const native = entry.nativeQuotedUtc == null ? null : (entry.lowestNative[code] ?? null);
  const rate = snapshot.fx[code] ?? (code === 'USD' ? 1 : null);

  if (native != null) {
    return {
      state: 'priced',
      key,
      hashName: entry.hashName,
      listingUrl: url,
      lowestUsd: entry.lowestUsd,
      amount: native,
      currency: code,
      basis: 'native',
      quotedUtc: entry.nativeQuotedUtc,
      listings: entry.listings,
      alternateHashNames,
    };
  }

  return {
    state: 'priced',
    key,
    hashName: entry.hashName,
    listingUrl: url,
    lowestUsd: entry.lowestUsd,
    amount: entry.lowestUsd * (rate ?? 1),
    currency: rate == null ? 'USD' : code,
    basis: 'converted',
    quotedUtc: entry.fetchedUtc,
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

/**
 * Price one owned hero. Its market identity is its rarity and nothing else — a hero listing carries
 * no set, slot, level or act — so unlike an item it needs no def to be looked up.
 */
export function resolveHeroPrice(
  hero: PriceableHero,
  snapshot: MarketSnapshot | null,
  currency = 'USD',
): ResolvedPrice {
  const code = currency.toUpperCase();
  if (!hero.marketable) return unpriced('not-tradable', null, null, code);
  return resolveKey(heroPriceKey(hero.rarity), snapshot, currency);
}

/**
 * Price one bought skin by the `skin` index a hero record carries. An index the skin table cannot
 * name resolves with no key at all, which is what keeps it out of a total rather than letting it
 * take another skin's price.
 */
export function resolveSkinPrice(
  skinIndex: number,
  snapshot: MarketSnapshot | null,
  currency = 'USD',
): ResolvedPrice {
  const code = currency.toUpperCase();
  const hashName = boughtSkinHashFor(skinIndex);
  if (hashName == null) return unpriced('unknown', null, null, code);
  return resolveKey(categoryKey(SKIN_CATEGORY, hashName), snapshot, currency);
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
