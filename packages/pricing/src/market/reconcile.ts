import { generateMarketNames } from './names.js';
import type { CatalogView, MarketName } from './names.js';
import type { Anomaly, MarketCoverage, MarketEntry, SearchRow } from './types.js';
import { HERO_CATEGORY, SKIN_CATEGORY, categoryKey, heroPriceKey, priceKey } from './types.js';

export interface Reconciliation {
  entries: MarketEntry[];
  anomalies: Anomaly[];
}

/**
 * Turn every enumerated market row into a priceable entry.
 *
 * A row's identity comes from looking its market hash up in the names the committed catalog says
 * this app can carry. That is not parsing the name: the generator starts from an identity it
 * already knows and builds the name that identity should be listed under, so a name form the game
 * changes stops matching instead of being read wrong. The row then goes unkeyed and is reported —
 * never keyed by a near miss, and never given another item's price.
 *
 * Nothing is dropped: a row nothing here can explain is still enumerated, still priced, and still
 * addressable by its own hash.
 */
export function reconcile(
  rows: SearchRow[],
  catalog: CatalogView,
  fetchedUtc: string,
): Reconciliation {
  const names = generateMarketNames(catalog);
  const anomalies: Anomaly[] = [];
  const entries: MarketEntry[] = [];
  const seenHashes = new Set<string>();

  for (const row of rows) {
    if (seenHashes.has(row.hashName)) continue;
    seenHashes.add(row.hashName);

    const identity = names.get(row.hashName) ?? null;
    const entry = entryFor(row, identity, fetchedUtc);

    // Asked of the entry rather than of the match, so a generated family that turns out not to
    // produce a key an owner can reach is reported too, instead of only an outright miss.
    if (!isFullyIdentified(entry)) {
      anomalies.push({
        kind: 'unlinkable-item',
        detail:
          identity == null
            ? `${row.hashName} matches no name the catalog can generate, so it is priced and no owned copy can look it up`
            : `${row.hashName} generates as ${identity.category} and still earns no key an owned copy can produce`,
      });
    }
    if (identity != null) {
      const drift = nameFormDrift(row, identity);
      if (drift != null) anomalies.push(drift);
    }

    entries.push(entry);
  }

  return { entries, anomalies };
}

function entryFor(row: SearchRow, identity: MarketName | null, fetchedUtc: string): MarketEntry {
  const keyable = {
    hashName: row.hashName,
    category: identity?.category ?? null,
    defId: identity?.defId ?? null,
    rarityIdx: identity?.rarityIdx ?? null,
  };

  return {
    hashName: row.hashName,
    name: row.name,
    key: keyForEntry(keyable),
    defId: keyable.defId,
    kind: identity?.kind ?? null,
    category: keyable.category,
    set: identity?.set ?? null,
    slot: identity?.slot ?? null,
    rarityIdx: keyable.rarityIdx,
    level: identity?.level ?? null,
    act: identity?.act ?? null,
    lowestNative: {},
    nativeQuotedUtc: null,
    lowestUsd: row.sellPriceCents == null ? null : row.sellPriceCents / 100,
    listings: row.listings,
    iconUrl: row.iconUrl,
    fetchedUtc,
  };
}

/**
 * Steam's own `type` for the row against the slot the matched name implies.
 *
 * The enumeration returns this field for free, and it is not a source — the generated match
 * already settled what the row is. It is the early warning: a row that still matches a generated
 * name while Steam types it as a different slot means the name form has moved under us, and the
 * next form change will be the one that matches nothing at all.
 */
function nameFormDrift(row: SearchRow, identity: MarketName): Anomaly | null {
  if (identity.type == null || row.type == null) return null;
  if (row.type.trim() === identity.type) return null;
  return {
    kind: 'name-form-drift',
    detail: `${row.hashName} generates as a ${identity.type} and Steam types it "${row.type}"; the name form has moved`,
  };
}

/** The identity a key is derived from — the fields a `MarketEntry` already carries. */
export interface KeyableEntry {
  hashName: string;
  category: string | null;
  defId: string | null;
  rarityIdx: number | null;
}

/**
 * The key an entry is addressed by, derived from its identity and nothing else — the same key an
 * owned copy of the item produces.
 */
export function keyForEntry(entry: KeyableEntry): string {
  // A hero has no def and needs none: rarity is its whole identity on the market.
  if (entry.category === HERO_CATEGORY && entry.rarityIdx != null) {
    return heroPriceKey(entry.rarityIdx);
  }
  if (entry.defId != null && entry.rarityIdx != null) {
    return priceKey(entry.defId, entry.rarityIdx);
  }
  // A row whose name matched nothing must not share a key with the item it resembles; keying it by
  // its own hash keeps it addressable without letting it claim another item's price.
  return categoryKey(entry.category ?? 'unknown', entry.hashName);
}

/**
 * True when an entry answers to a key an owned copy can produce, rather than falling back to its
 * own hash name. That fallback means the row is priced and no owned copy can reach it, because its
 * name matched nothing the catalog can generate. A skin is the one row for which the hash key is
 * the honest end state: it is a field on a hero rather than an inventory item, so it has no owned
 * counterpart to fail to reach.
 */
export function isFullyIdentified(entry: KeyableEntry): boolean {
  if (entry.category == null) return false;
  if (entry.category === SKIN_CATEGORY) return true;
  return keyForEntry(entry) !== categoryKey(entry.category, entry.hashName);
}

/**
 * Choose the entry an app should quote for each key, and keep the rest.
 *
 * A key can have more than one live hash: the game renamed its items after launch and Steam
 * hashes are immutable, so `Ember Amulet (Rare)` and `Ember Amulet Lv 10 (Rare)` are two live
 * order books for one item. The cheapest is the honest quote, because a buyer can take it — the
 * deeper book is no help to someone who could have paid less on the other one. Liquidity breaks
 * ties, and a hash with no listing at all sorts last.
 */
export function indexEntries(
  entries: MarketEntry[],
  catalog: CatalogView,
): {
  index: Record<string, number>;
  alternates: Record<string, number[]>;
  unlisted: string[];
  anomalies: Anomaly[];
  coverage: Omit<MarketCoverage, 'searchCalls'>;
} {
  const grouped = new Map<string, number[]>();
  entries.forEach((entry, position) => {
    const bucket = grouped.get(entry.key);
    if (bucket == null) grouped.set(entry.key, [position]);
    else bucket.push(position);
  });

  const index: Record<string, number> = {};
  const alternates: Record<string, number[]> = {};
  for (const [key, positions] of grouped) {
    const ranked = [...positions].sort((a, b) => rank(entries, a) - rank(entries, b));
    const [primary, ...rest] = ranked;
    if (primary == null) continue;
    index[key] = primary;
    if (rest.length > 0) alternates[key] = rest;
  }

  const unlisted: string[] = [];
  for (const def of catalog.defs) {
    for (const rarityIdx of catalog.rarityIdxs) {
      const key = priceKey(def.defId, rarityIdx);
      if (index[key] == null) unlisted.push(key);
    }
  }

  const catalogKeys = catalog.defs.length * catalog.rarityIdxs.length;

  return {
    index,
    alternates,
    unlisted,
    anomalies: [],
    coverage: {
      marketRows: entries.length,
      keyedRows: entries.filter((entry) => entry.category != null).length,
      pricedRows: entries.filter((entry) => entry.lowestUsd != null).length,
      unkeyedRows: entries.filter((entry) => entry.category == null).length,
      catalogKeys,
      matchedCatalogKeys: catalogKeys - unlisted.length,
    },
  };
}

/** Cheapest first, deepest book breaking a tie; an unpriced hash sorts last. */
function rank(entries: MarketEntry[], position: number): number {
  const entry = entries[position];
  if (entry?.lowestUsd == null) return Number.POSITIVE_INFINITY;
  return entry.lowestUsd * 1_000_000 - entry.listings;
}
