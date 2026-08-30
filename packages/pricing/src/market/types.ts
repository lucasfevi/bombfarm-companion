import type { ItemKind } from '@bombfarm/contracts';

export const MARKET_APP_ID = 4892010;

/**
 * Steam's facet schema for the app: facet name -> the tag values that currently have market
 * matches. Read live from `market/appfilters/<appid>`. Treat it as a hint, never as the
 * authority — it has been measured omitting a tag that had a live, sellable listing.
 */
export type AppFilters = Record<string, string[]>;

/** One `market/search/render` row, narrowed to the fields the snapshot keeps. */
export interface SearchRow {
  hashName: string;
  name: string;
  /** Lowest active listing in USD cents, or null when the row carries no price. */
  sellPriceCents: number | null;
  listings: number;
  iconUrl: string | null;
  type: string | null;
}

export interface SearchPage {
  totalCount: number;
  rows: SearchRow[];
}

/** The facets a `search/render` call can be narrowed by. Absent keys are unfiltered. */
export interface SearchFilters {
  set?: string;
  slot?: string;
  rarity?: string;
  category?: string;
  level?: string;
  act?: string;
}

export const FACET_NAMES = ['category', 'set', 'slot', 'rarity', 'level', 'act'] as const;
export type FacetName = (typeof FACET_NAMES)[number];

/**
 * A market listing reconciled against the committed catalog. Facet values are assigned by
 * construction — the row came back from a query already narrowed to that tag — never by parsing
 * `hashName`, whose format Steam does not commit to and which the game has already changed once.
 */
export interface MarketEntry {
  hashName: string;
  name: string;
  /**
   * The stable identity an app looks a price up by, and the same one an owned copy produces.
   * Equipment, gems, stones and chests key on a catalog def and rarity — the def read off a
   * facet or an explicit table, never off the hash. A hero keys on its rarity alone. Only the
   * skin still keys on its Steam category and hash, having no owned counterpart to match.
   */
  key: string;
  /** The catalog def, where the catalog has one. Null for chests, cages, skins and gems. */
  defId: string | null;
  kind: ItemKind | null;
  /** Steam's own category tag (`equip`, `chest`, `gem`, `key`, `skin`, `stone`, `time`). */
  category: string | null;
  set: string | null;
  /** Catalog slot code (`arma`, `elmo`, …), translated from Steam's English slot tag. */
  slot: string | null;
  rarityIdx: number | null;
  level: number | null;
  /** Difficulty an act-scoped item belongs to (Hero Cage, Skill Stone Chest). */
  act: number | null;
  lowestUsd: number | null;
  /**
   * Lowest live listing in each currency Steam quoted itself, ISO code -> major units.
   *
   * Steam prices each region independently rather than converting, so a native quote is the
   * number on the page this entry links to and a converted one is not: measured 2026-08-29,
   * native BRL ran 0.6-1.2% above `lowestUsd` times the day's rate, per item and not uniformly.
   *
   * Sparse on purpose. `priceoverview` is the only endpoint that honours a currency and it
   * under-reports, so an absent key means "not quoted", never "not listed" — `lowestUsd` remains
   * the authority on whether anything is for sale.
   */
  lowestNative: Record<string, number | null>;
  listings: number;
  iconUrl: string | null;
  fetchedUtc: string;
  /**
   * When `lowestNative` was last read, which is not `fetchedUtc`. The quote pass runs after the
   * enumeration and is the first thing a rate-limited run drops, so a fresh row can carry a
   * native price from hours earlier; collapsing the two would date that price to this run.
   */
  nativeQuotedUtc: string | null;
}

export type AnomalyKind =
  | 'unknown-slot-tag'
  | 'unknown-rarity-tag'
  | 'unknown-category-tag'
  | 'unknown-set-tag'
  | 'untagged-equipment'
  | 'unresolved-rarity'
  | 'ambiguous-tag'
  | 'rate-limited';

/**
 * Something the sweep saw that the catalog cannot explain. Every one of these is a reason the
 * snapshot may under-report, so the workflow surfaces them rather than letting a silently
 * mis-mapped tag price an item wrong.
 */
export interface Anomaly {
  kind: AnomalyKind;
  detail: string;
}

export interface MarketCoverage {
  /** Every row the market carried, whatever it turned out to be. */
  marketRows: number;
  /** Rows that earned a `key`, so an app can price them. */
  keyedRows: number;
  /** Of those, how many have at least one live listing. */
  pricedRows: number;
  /** Rows with no key at all — the market is carrying something nothing here understands. */
  unkeyedRows: number;
  /** Catalog def+rarity keys that exist at all (`defs` x `rarities`). */
  catalogKeys: number;
  /** Of those, how many the market carries. */
  matchedCatalogKeys: number;
  searchCalls: number;
}

export interface MarketSnapshot {
  schemaVersion: 3;
  generatedUtc: string;
  appId: number;
  baseCurrency: 'USD';
  /**
   * Currencies this run asked Steam to quote directly, in the order it asked. Named here rather
   * than inferred from the entries so that a run where every quote failed still says what it was
   * trying to do, instead of reading as a snapshot that never wanted native prices.
   */
  nativeCurrencies: string[];
  /** ISO currency -> units per 1 USD. */
  fx: Record<string, number>;
  /** Every reconciled market row, catalog-matched or not. */
  entries: MarketEntry[];
  /** `key` -> the entry an app should quote: the most liquid, then the cheapest. */
  index: Record<string, number>;
  /**
   * `key` -> the other entries sharing it. The game renamed its items after launch and Steam
   * hashes are immutable, so `Ember Amulet (Rare)` and `Ember Amulet Lv 10 (Rare)` are two live
   * hashes with byte-identical facets. Both are kept: hiding one would hide real supply.
   */
  alternates: Record<string, number[]>;
  /** Catalog def+rarity keys with no market row at all. */
  unlisted: string[];
  anomalies: Anomaly[];
  coverage: MarketCoverage;
}

/** The key for a catalog equipment item: what an owned `InventoryItem` looks its price up by. */
export function priceKey(defId: string, rarityIdx: number): string {
  return `${defId}#${String(rarityIdx)}`;
}

/**
 * The key for a market row nothing an owner holds can identify — today only the skin, which is a
 * field on a hero rather than an inventory row at all.
 *
 * Keyed on the hash name because the facets do not separate these: `Hero Cage (Act 1)` and
 * `Skill Stone Chest (Act 1)` are both `category=chest, act=1` and nothing else, so a key built
 * from facets alone would merge two different items into one price. Those two are reached instead
 * through an explicit hash-to-family table, which names them rather than deducing them; a Steam
 * hash never changes meaning, which is what makes such a table safe.
 */
export function categoryKey(category: string, hashName: string): string {
  return `${category}#${hashName}`;
}

/** The Steam category tag heroes are listed under. */
export const HERO_CATEGORY = 'hero';

/**
 * The key for a tradable hero, which is its rarity and nothing else.
 *
 * A hero listing carries no set, slot, level or act — `Hero (Rare)` is the whole identity, and the
 * rarity behind it comes off the facet rather than the name. So unlike the chests and gems, a
 * hero needs no def: an owned hero the game marks tradable looks its price up by rarity alone.
 */
export function heroPriceKey(rarityIdx: number): string {
  return categoryKey(HERO_CATEGORY, String(rarityIdx));
}
