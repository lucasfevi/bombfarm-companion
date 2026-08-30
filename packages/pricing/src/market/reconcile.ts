import type { DiscoveryRow } from './discover.js';
import {
  ACT_CHEST_DEF_BY_HASH,
  GEM_DEF_BY_HASH,
  LEVEL_CHEST_DEF_PREFIX,
  catalogSlotFor,
  defPrefixFor,
  isKnownCategory,
  itemKindFor,
  rarityIdxFor,
} from './tags.js';
import type { Anomaly, MarketCoverage, MarketEntry } from './types.js';
import { HERO_CATEGORY, categoryKey, heroPriceKey, priceKey } from './types.js';

/** One committed catalog definition, as `catalog.json` records it. */
export interface CatalogDef {
  defId: string;
  set: string;
  slot: string;
  level: number;
}

export interface CatalogView {
  defs: CatalogDef[];
  rarityIdxs: number[];
  /**
   * Rarity index -> the token a `def_id` spells it with. Not the catalog's rarity `code`: the
   * fixtures carry `time_part_epico` where the code for that index is `superraro`, so the token
   * follows the rarity's label instead. The builder derives these from the catalog's own labels
   * rather than hardcoding them here.
   */
  rarityTokens: Record<number, string>;
}

export interface Reconciliation {
  entries: MarketEntry[];
  anomalies: Anomaly[];
}

const asNumber = (value: string | undefined): number | null => {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

/**
 * Turn every discovered market row into a priceable entry.
 *
 * Equipment resolves to a catalog `defId` from the set and slot it was queried under. Gate Keys
 * and Time Parts resolve to one too, because their `def_id`s are a fixed prefix plus the rarity.
 * Everything else — chests, hero cages, skill stones, gems, skins — has no catalog def at all, so
 * it earns a key built from the facets Steam publishes for it instead. Nothing is dropped: a row
 * the catalog cannot explain is still enumerated, still priced, and still addressable.
 */
export function reconcile(
  rows: DiscoveryRow[],
  catalog: CatalogView,
  fetchedUtc: string,
): Reconciliation {
  const anomalies: Anomaly[] = [];
  const defsBySetSlot = new Map<string, CatalogDef>();
  for (const def of catalog.defs) defsBySetSlot.set(`${def.set}|${def.slot}`, def);

  const entries: MarketEntry[] = [];
  const seenHashes = new Set<string>();

  for (const discovered of rows) {
    const { tags } = discovered;
    if (seenHashes.has(discovered.row.hashName)) continue;
    seenHashes.add(discovered.row.hashName);

    const slot = tags.slot == null ? null : catalogSlotFor(tags.slot);
    if (tags.slot != null && slot == null) {
      anomalies.push({
        kind: 'unknown-slot-tag',
        detail: `no catalog slot for Steam tag "${tags.slot}"`,
      });
    }

    const rarityIdx = tags.rarity == null ? null : rarityIdxFor(tags.rarity);
    if (tags.rarity != null && rarityIdx == null) {
      anomalies.push({
        kind: 'unknown-rarity-tag',
        detail: `no catalog rarity for Steam tag "${tags.rarity}"`,
      });
    }

    const category = tags.category ?? null;
    // A category with no `ItemKind` is fine — the row is still keyed and still priced. Only a
    // category nothing here has ever seen is worth raising.
    const kind = category == null ? null : itemKindFor(category);
    if (category != null && !isKnownCategory(category)) {
      anomalies.push({
        kind: 'unknown-category-tag',
        detail: `Steam category "${category}" is new here; it is priced but has no item kind`,
      });
    }

    const def =
      tags.set != null && slot != null ? (defsBySetSlot.get(`${tags.set}|${slot}`) ?? null) : null;
    if (tags.set != null && slot != null && def == null) {
      anomalies.push({
        kind: 'unknown-set-tag',
        detail: `no catalog def for set "${tags.set}" slot "${slot}"`,
      });
    }

    const act = asNumber(tags.act);
    const level = asNumber(tags.level) ?? def?.level ?? null;
    const defId =
      def?.defId ?? categoryDefId(category, rarityIdx, catalog, level, act, discovered.row.hashName);
    // An item chest is tagged by level and carries no rarity at all, while an owned one is rarity
    // 0 — so keying it needs that 0 supplied here or the two never meet.
    // An item chest is tagged by level and carries no rarity, while an owned one is rarity 0. An
    // act chest carries an act, and that act IS its tier — `chest_time_2` is the Raro one.
    const keyRarityIdx =
      rarityIdx ??
      (category === 'chest' && ACT_CHEST_DEF_BY_HASH[discovered.row.hashName] != null
        ? act
        : category === 'chest' && level != null
          ? 0
          : null);

    entries.push({
      hashName: discovered.row.hashName,
      name: discovered.row.name,
      key: keyFor({ category, defId, rarityIdx: keyRarityIdx, hashName: discovered.row.hashName }),
      defId,
      kind: def != null ? 'equipment' : kind,
      category,
      set: tags.set ?? null,
      slot,
      rarityIdx,
      level,
      act,
      lowestNative: {},
      nativeQuotedUtc: null,
      lowestUsd: discovered.row.sellPriceCents == null ? null : discovered.row.sellPriceCents / 100,
      listings: discovered.row.listings,
      iconUrl: discovered.row.iconUrl,
      fetchedUtc,
    });
  }

  return { entries, anomalies };
}

/**
 * The catalog def an owned copy of this row would carry, so a player's item finds its price.
 *
 * Three shapes, each read off a facet rather than the hash name: a fixed prefix plus the rarity's
 * own token (`map_key_raro`, `time_part_epico`, `skill_stone_epico`), a fixed prefix plus a level
 * (`chest_item_30`), and gems, which no facet separates and which take an explicit table.
 *
 * Returns null for anything whose def cannot be known — the act-scoped chests especially, where
 * an owned `chest_time_2` numbers a rarity tier and the market row numbers an act. Those stay
 * keyed by hash, priced but unreachable from an inventory, which is the truthful outcome.
 */
function categoryDefId(
  category: string | null,
  rarityIdx: number | null,
  catalog: CatalogView,
  level: number | null,
  act: number | null,
  hashName: string,
): string | null {
  if (category == null) return null;

  if (category === 'gem') return GEM_DEF_BY_HASH[hashName] ?? null;

  if (category === 'chest') {
    const family = ACT_CHEST_DEF_BY_HASH[hashName];
    if (family != null) return act == null ? null : `${family}_${String(act)}`;
    return level == null ? null : `${LEVEL_CHEST_DEF_PREFIX}_${String(level)}`;
  }

  if (rarityIdx == null) return null;
  const prefix = defPrefixFor(category);
  const token = catalog.rarityTokens[rarityIdx];
  if (prefix == null || token == null) return null;
  return `${prefix}_${token}`;
}

function keyFor(parts: {
  category: string | null;
  defId: string | null;
  rarityIdx: number | null;
  hashName: string;
}): string {
  // A hero has no def and needs none: rarity is its whole identity on the market.
  if (parts.category === HERO_CATEGORY && parts.rarityIdx != null) {
    return heroPriceKey(parts.rarityIdx);
  }
  if (parts.defId != null && parts.rarityIdx != null) {
    return priceKey(parts.defId, parts.rarityIdx);
  }
  // Equipment that never got a set, slot or rarity must not share a key with the def it belongs
  // to; keying it by name keeps it addressable without letting it claim another item's price.
  return categoryKey(parts.category ?? 'unknown', parts.hashName);
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
