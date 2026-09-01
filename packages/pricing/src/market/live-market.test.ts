import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { reconcile, type CatalogView } from './reconcile.js';
import { resolveItemPrice, resolveKey } from './resolve.js';
import { buildSnapshot } from './snapshot.js';
import { categoryKey, priceKey } from './types.js';
import { LIVE_MARKET_ROWS } from './__fixtures__/live-market-rows.js';

/**
 * The reconciliation run over every row the market actually carried. The unit tests elsewhere
 * drive a fake; this one proves the same code turns real Steam rows into identities an app can
 * price — which is the claim the whole snapshot rests on.
 */
const CATALOG_PATH = fileURLToPath(
  new URL('../../../domain/src/data/catalog.json', import.meta.url),
);
const WIKI_PATH = fileURLToPath(
  new URL('../../../domain/src/data/phase-wiki.json', import.meta.url),
);

interface RawCatalog {
  defs: { id: string; set: string; slot: string; nativeLevel: number }[];
  rarities: { idx: number; label: string }[];
}

interface RawWiki {
  gems: { list: { defId: string; name: string }[] };
}

const raw = JSON.parse(readFileSync(CATALOG_PATH, 'utf-8')) as RawCatalog;
const wiki = JSON.parse(readFileSync(WIKI_PATH, 'utf-8')) as RawWiki;
const CATALOG: CatalogView = {
  defs: raw.defs.map((def) => ({
    defId: def.id,
    set: def.set,
    slot: def.slot,
    level: def.nativeLevel,
  })),
  rarityIdxs: raw.rarities.map((rarity) => rarity.idx),
  rarityTokens: Object.fromEntries(
    raw.rarities.map((rarity) => [
      rarity.idx,
      rarity.label
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase(),
    ]),
  ),
  defIdByHash: Object.fromEntries(wiki.gems.list.map((gem) => [`${gem.name} Gem`, gem.defId])),
};

const FETCHED = '2026-08-29T00:00:00.000Z';
const reconciled = reconcile(LIVE_MARKET_ROWS, CATALOG, FETCHED);
const snapshot = buildSnapshot({
  entries: reconciled.entries,
  prior: null,
  catalog: CATALOG,
  fx: { USD: 1, BRL: 5.4 },
  anomalies: reconciled.anomalies,
  searchCalls: 0,
  enumerationComplete: true,
  now: () => Date.parse(FETCHED),
});

const entryFor = (key: string) => {
  const position = snapshot.index[key];
  return position == null ? null : snapshot.entries[position];
};

describe('the live market rows', () => {
  it('prices every row it enumerated, whatever the catalog knows about it', () => {
    expect(snapshot.coverage.marketRows).toBe(40);
    expect(snapshot.coverage.pricedRows).toBe(40);
    expect(snapshot.coverage.unkeyedRows).toBe(0);
  });

  it.each([
    ['ember_amuleto', 2, 'Ember Amulet Lv 10 (Rare)'],
    ['ember_peito', 2, 'Ember Chestplate Lv 10 (Rare)'],
    ['ember_calca', 2, 'Ember Leggings Lv 10 (Rare)'],
    ['ember_luva', 2, 'Ember Gloves Lv 10 (Rare)'],
    ['ember_bota', 2, 'Ember Boots Lv 10 (Rare)'],
    ['ember_anel', 2, 'Ember Ring (Rare)'],
    ['ember_elmo', 2, 'Ember Helmet Lv 10 (Rare)'],
    ['ember_elmo', 3, 'Ember Helmet Lv 10 (Epic)'],
    ['ember_arma', 4, 'Ember Weapon Lv 10 (Legendary)'],
    ['gold_elmo', 2, 'Gold Helmet Lv 20 (Rare)'],
    ['gold_luva', 4, 'Gold Gloves Lv 20 (Legendary)'],
  ])('resolves the %s catalog def at rarity %i', (defId, rarityIdx, hashName) => {
    expect(entryFor(priceKey(defId, rarityIdx))?.hashName).toBe(hashName);
  });

  it('gives keys and time parts the def_id their prefix and rarity spell', () => {
    expect(entryFor(priceKey('map_key_raro', 2))?.hashName).toBe('Gate Key (Rare)');
    expect(entryFor(priceKey('map_key_incomum', 1))?.hashName).toBe('Gate Key (Uncommon)');
    expect(entryFor(priceKey('time_part_epico', 3))?.hashName).toBe('Time Part (Epic)');
    expect(entryFor(priceKey('time_part_incomum', 1))?.hashName).toBe('Time Part (Uncommon)');
  });

  it('still keys by hash the rows whose owned def cannot be known', () => {
    // The skin is not an inventory row at all — it is a field on a hero — so nothing an item
    // carries could ever look it up.
    expect(entryFor(categoryKey('skin', 'Royal Sentinel Skin'))?.hashName).toBe(
      'Royal Sentinel Skin',
    );
  });

  it('reaches an act chest by the def an owned copy carries, act for act', () => {
    // The act IS the tier: an Act 1 cage is `chest_hero_1`, which the inventory reads as rarity 1.
    const cases: [string, number, string][] = [
      ['chest_hero_1', 1, 'Hero Cage (Act 1)'],
      ['chest_skill_1', 1, 'Skill Stone Chest (Act 1)'],
    ];
    for (const [defId, rarityIdx, hashName] of cases) {
      expect(entryFor(priceKey(defId, rarityIdx))?.hashName).toBe(hashName);
    }
  });

  it('gives the rows whose def IS knowable the key an owned copy looks up', () => {
    // These were keyed by hash and so priced but unreachable: an inventory looks a price up by
    // def and rarity, and nothing ever produced these hashes. 41 of 130 tradable items in a real
    // save went unpriced for exactly this reason.
    const cases: [string, number, string][] = [
      ['chest_item_10', 0, 'Item Chest (Lv 10)'],
      ['chest_item_20', 0, 'Item Chest (Lv 20)'],
      ['gem_emerald', 2, 'Emerald Gem'],
      ['skill_stone_incomum', 1, 'Skill Stone (Uncommon)'],
    ];
    for (const [defId, rarityIdx, hashName] of cases) {
      expect(entryFor(priceKey(defId, rarityIdx))?.hashName).toBe(hashName);
    }
  });

  it.each([
    ['gem_topaz', 3, 'Topaz Gem'],
    ['chest_time_3', 3, 'Time Chest (Act 3)'],
    ['chest_gem_2', 2, 'Gem Chest (Act 2)'],
    ['chest_skill_2', 2, 'Skill Stone Chest (Act 2)'],
    ['chest_skill_3', 3, 'Skill Stone Chest (Act 3)'],
  ])('links %s, which the published snapshot could not', (defId, rarityIdx, hashName) => {
    expect(entryFor(priceKey(defId, rarityIdx))?.hashName).toBe(hashName);
  });

  it('keeps two same-act chests apart, which a facet-built key would have merged', () => {
    const cage = entryFor(priceKey('chest_hero_1', 1));
    const stoneChest = entryFor(priceKey('chest_skill_1', 1));

    expect(cage?.act).toBe(1);
    expect(stoneChest?.act).toBe(1);
    expect(cage?.lowestUsd).toBeCloseTo(2.89);
    expect(stoneChest?.lowestUsd).toBeCloseTo(1.29);
  });

  it('quotes the cheaper hash when the rename left one item with two order books', () => {
    const key = priceKey('ember_bota', 2);

    // Ember Boots (Rare) has the deeper book at $3.47; the renamed hash is purchasable at $2.89.
    expect(entryFor(key)?.hashName).toBe('Ember Boots Lv 10 (Rare)');
    expect(entryFor(key)?.lowestUsd).toBeCloseTo(2.89);
    expect(snapshot.alternates[key]).toHaveLength(1);
    expect(resolveKey(key, snapshot).alternateHashNames).toEqual(['Ember Boots (Rare)']);
  });

  it('carries the level the set implies, without asking Steam for it', () => {
    expect(entryFor(priceKey('ember_luva', 2))?.level).toBe(10);
    expect(entryFor(priceKey('gold_luva', 4))?.level).toBe(20);
  });

  it('gives each row the item kind its category maps to, and none where there is none', () => {
    expect(entryFor(priceKey('ember_luva', 2))?.kind).toBe('equipment');
    expect(entryFor(priceKey('gem_emerald', 2))?.kind).toBe('gem');
    expect(entryFor(priceKey('map_key_raro', 2))?.kind).toBe('key');
    expect(entryFor(priceKey('time_part_epico', 3))?.kind).toBe('material');
    expect(entryFor(categoryKey('skin', 'Royal Sentinel Skin'))?.kind).toBeNull();
  });

  it('raises nothing, because every category and tag on the market is one it knows', () => {
    expect(snapshot.anomalies).toEqual([]);
  });

  it('prices an owned item straight from its def and rarity', () => {
    const resolved = resolveItemPrice(
      { defId: 'ember_luva', rarity: 2, tradable: true },
      snapshot,
      'BRL',
    );

    expect(resolved.state).toBe('priced');
    expect(resolved.hashName).toBe('Ember Gloves Lv 10 (Rare)');
    expect(resolved.amount).toBeCloseTo(1.92 * 5.4);
    expect(resolved.alternateHashNames).toEqual(['Ember Gloves (Rare)']);
  });

  it('leaves the rest of the catalog unlisted rather than pretending it has a price', () => {
    expect(snapshot.coverage.matchedCatalogKeys).toBe(14);
    expect(snapshot.unlisted).toContain(priceKey('void_arma', 5));
    expect(resolveItemPrice({ defId: 'void_arma', rarity: 5, tradable: true }, snapshot).state).toBe(
      'unknown',
    );
  });
});
