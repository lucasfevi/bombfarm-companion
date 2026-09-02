import { describe, expect, it } from 'vitest';
import type { DiscoveryRow } from './discover.js';
import { indexEntries, knownTagsFrom, reconcile, type CatalogView } from './reconcile.js';
import {
  categoryKey,
  heroPriceKey,
  priceKey,
  type FacetName,
  type MarketEntry,
} from './types.js';

const FETCHED = '2026-08-29T00:00:00.000Z';

const CATALOG: CatalogView = {
  defs: [
    { defId: 'ember_arma', set: 'ember', slot: 'arma', level: 10 },
    { defId: 'ember_elmo', set: 'ember', slot: 'elmo', level: 10 },
  ],
  rarityIdxs: [0, 1, 2],
  rarityTokens: { 0: 'comum', 1: 'incomum', 2: 'raro' },
  defIdByHash: { 'Emerald Gem': 'gem_emerald' },
};

function row(
  hashName: string,
  tags: Partial<Record<FacetName, string>>,
  price: { cents: number | null; listings: number } = { cents: 250, listings: 3 },
): DiscoveryRow {
  return {
    row: {
      hashName,
      name: hashName,
      sellPriceCents: price.cents,
      listings: price.listings,
      iconUrl: null,
      type: null,
    },
    tags,
  };
}

describe('reconcile', () => {
  it('gives a row the def id of the set and slot it was queried by', () => {
    const { entries } = reconcile(
      [row('Ember Weapon', { category: 'equip', set: 'ember', slot: 'weapon', rarity: 'rare' })],
      CATALOG,
      FETCHED,
    );

    expect(entries[0]).toMatchObject({
      defId: 'ember_arma',
      key: priceKey('ember_arma', 2),
      slot: 'arma',
      rarityIdx: 2,
      level: 10,
      lowestUsd: 2.5,
      kind: 'equipment',
    });
  });

  it('builds a def id for a category whose items are a prefix plus the rarity', () => {
    const { entries } = reconcile(
      [row('Gate Key (Rare)', { category: 'key', rarity: 'rare' })],
      CATALOG,
      FETCHED,
    );

    expect(entries[0]).toMatchObject({
      defId: 'map_key_raro',
      key: priceKey('map_key_raro', 2),
      kind: 'key',
    });
  });

  it('gives a gem the def id the caller supplied for its hash', () => {
    const { entries } = reconcile(
      [row('Emerald Gem', { category: 'gem', rarity: 'rare' })],
      CATALOG,
      FETCHED,
    );

    expect(entries[0]).toMatchObject({
      defId: 'gem_emerald',
      key: priceKey('gem_emerald', 2),
      kind: 'gem',
    });
  });

  it('leaves a gem the supplied map does not name keyed by hash rather than guessing one', () => {
    const { entries } = reconcile(
      [row('Obsidian Gem', { category: 'gem', rarity: 'rare' })],
      CATALOG,
      FETCHED,
    );

    expect(entries[0]?.defId).toBeNull();
    expect(entries[0]?.key).toBe(categoryKey('gem', 'Obsidian Gem'));
  });

  it('keys an item the catalog has no def for on its category and hash', () => {
    const { entries } = reconcile([row('Royal Sentinel Skin', { category: 'skin' })], CATALOG, FETCHED);

    expect(entries[0]).toMatchObject({
      defId: null,
      key: categoryKey('skin', 'Royal Sentinel Skin'),
      kind: null,
      category: 'skin',
    });
  });

  it('keeps two items that share every facet apart', () => {
    const { entries } = reconcile(
      [
        row('Hero Cage (Act 1)', { category: 'chest', act: '1' }),
        row('Skill Stone Chest (Act 1)', { category: 'chest', act: '1' }),
      ],
      CATALOG,
      FETCHED,
    );

    expect(new Set(entries.map((entry) => entry.key)).size).toBe(2);
    expect(entries.every((entry) => entry.act === 1)).toBe(true);
  });

  it.each([
    ['Hero Cage', 'chest_hero'],
    ['Time Chest', 'chest_time'],
    ['Gem Chest', 'chest_gem'],
    ['Skill Stone Chest', 'chest_skill'],
  ])('reaches every act of %s, taking the act off the facet', (family, defPrefix) => {
    for (const act of [1, 2, 3]) {
      const hashName = `${family} (Act ${String(act)})`;
      const { entries } = reconcile(
        [row(hashName, { category: 'chest', act: String(act) })],
        CATALOG,
        FETCHED,
      );

      expect(entries[0]?.defId).toBe(`${defPrefix}_${String(act)}`);
      expect(entries[0]?.key).toBe(priceKey(`${defPrefix}_${String(act)}`, act));
    }
  });

  it('treats a Gem Chest as a chest, not as a gem', () => {
    const { entries } = reconcile(
      [row('Gem Chest (Act 2)', { category: 'chest', act: '2' })],
      CATALOG,
      FETCHED,
    );

    expect(entries[0]).toMatchObject({
      defId: 'chest_gem_2',
      key: priceKey('chest_gem_2', 2),
      category: 'chest',
    });
  });

  it('does not let a hash that merely contains a family name borrow that family price', () => {
    const { entries } = reconcile(
      [row('Ancient Time Chest (Act 1)', { category: 'chest', act: '1' })],
      CATALOG,
      FETCHED,
    );

    expect(entries[0]?.defId).toBeNull();
    expect(entries[0]?.key).toBe(categoryKey('chest', 'Ancient Time Chest (Act 1)'));
  });

  it('leaves a row unmatched rather than guessing when Steam uses a slot tag we do not know', () => {
    const { entries, anomalies } = reconcile(
      [row('Ember Cape', { category: 'equip', set: 'ember', slot: 'cape', rarity: 'rare' })],
      CATALOG,
      FETCHED,
    );

    expect(entries[0]?.defId).toBeNull();
    expect(anomalies.map((anomaly) => anomaly.kind)).toContain('unknown-slot-tag');
  });

  it('raises a category it has never seen, but still prices and keys the row', () => {
    const { entries, anomalies } = reconcile([row('Warhorse Mount', { category: 'mount' })], CATALOG, FETCHED);

    expect(entries[0]?.key).toBe(categoryKey('mount', 'Warhorse Mount'));
    expect(entries[0]?.lowestUsd).toBe(2.5);
    expect(anomalies.map((anomaly) => anomaly.kind)).toContain('unknown-category-tag');
  });

  it('reports a priced row no owned copy can look up, naming the hash and the category', () => {
    const { anomalies } = reconcile(
      [row('Obsidian Gem', { category: 'gem', rarity: 'rare' })],
      CATALOG,
      FETCHED,
    );

    expect(anomalies).toHaveLength(1);
    expect(anomalies[0]?.kind).toBe('unlinkable-item');
    expect(anomalies[0]?.detail).toContain('Obsidian Gem');
    expect(anomalies[0]?.detail).toContain('gem');
  });

  it('says nothing about a skin, which is a field on a hero and has no owned copy to reach', () => {
    const { anomalies } = reconcile([row('Royal Sentinel Skin', { category: 'skin' })], CATALOG, FETCHED);

    expect(anomalies).toEqual([]);
  });

  it('says nothing about a tradable hero, whose rarity alone is the key an owner looks up', () => {
    const { entries, anomalies } = reconcile([row('Hero (Rare)', { category: 'hero', rarity: 'rare' })], CATALOG, FETCHED);

    expect(entries[0]?.key).toBe(heroPriceKey(2));
    expect(anomalies).toEqual([]);
  });

  it('reports equipment the tag passes never reached, which the discovery pass separately explains', () => {
    const { entries, anomalies } = reconcile([row('Ember Weapon', { category: 'equip' })], CATALOG, FETCHED);

    expect(entries[0]?.key).toBe(categoryKey('equip', 'Ember Weapon'));
    expect(anomalies.map((anomaly) => anomaly.kind)).toEqual(['unlinkable-item']);
  });

  it('says nothing about a category it knows carries no item kind', () => {
    const { anomalies } = reconcile([row('Item Chest (Lv 10)', { category: 'chest', level: '10' })], CATALOG, FETCHED);

    expect(anomalies).toEqual([]);
  });
});

describe('indexEntries', () => {
  const entriesOf = (rows: DiscoveryRow[]) => reconcile(rows, CATALOG, FETCHED).entries;

  it('reports every catalog def and rarity the market has never carried', () => {
    const indexed = indexEntries(
      entriesOf([
        row('Ember Weapon', { category: 'equip', set: 'ember', slot: 'weapon', rarity: 'rare' }),
      ]),
      CATALOG,
    );

    expect(indexed.index[priceKey('ember_arma', 2)]).toBe(0);
    expect(indexed.unlisted).toHaveLength(5);
    expect(indexed.unlisted).toContain(priceKey('ember_elmo', 2));
    expect(indexed.coverage).toMatchObject({ catalogKeys: 6, matchedCatalogKeys: 1, pricedRows: 1 });
  });

  it('quotes the cheapest of two hashes sharing a key, and keeps the other', () => {
    const indexed = indexEntries(
      entriesOf([
        row('Ember Weapon', { category: 'equip', set: 'ember', slot: 'weapon', rarity: 'rare' }, {
          cents: 900,
          listings: 12,
        }),
        row('Ember Weapon Lv 10', { category: 'equip', set: 'ember', slot: 'weapon', rarity: 'rare' }, {
          cents: 300,
          listings: 1,
        }),
      ]),
      CATALOG,
    );

    expect(indexed.index[priceKey('ember_arma', 2)]).toBe(1);
    expect(indexed.alternates[priceKey('ember_arma', 2)]).toEqual([0]);
  });

  it('prefers the deeper book only when the price is a tie', () => {
    const indexed = indexEntries(
      entriesOf([
        row('Ember Weapon', { category: 'equip', set: 'ember', slot: 'weapon', rarity: 'rare' }, {
          cents: 300,
          listings: 1,
        }),
        row('Ember Weapon Lv 10', { category: 'equip', set: 'ember', slot: 'weapon', rarity: 'rare' }, {
          cents: 300,
          listings: 9,
        }),
      ]),
      CATALOG,
    );

    expect(indexed.index[priceKey('ember_arma', 2)]).toBe(1);
  });

  it('never quotes an unlisted hash over one that has a price', () => {
    const indexed = indexEntries(
      entriesOf([
        row('Ember Weapon', { category: 'equip', set: 'ember', slot: 'weapon', rarity: 'rare' }, {
          cents: null,
          listings: 0,
        }),
        row('Ember Weapon Lv 10', { category: 'equip', set: 'ember', slot: 'weapon', rarity: 'rare' }, {
          cents: 800,
          listings: 1,
        }),
      ]),
      CATALOG,
    );

    expect(indexed.index[priceKey('ember_arma', 2)]).toBe(1);
    expect(indexed.coverage.pricedRows).toBe(1);
  });
});

describe('knownTagsFrom', () => {
  const identityOf = (entries: MarketEntry[]) =>
    entries.map(({ hashName, key, defId, kind, category, set, slot, rarityIdx, level, act }) => ({
      hashName,
      key,
      defId,
      kind,
      category,
      set,
      slot,
      rarityIdx,
      level,
      act,
    }));

  const IDENTIFIED = [
    row('Ember Weapon', { category: 'equip', set: 'ember', slot: 'weapon', rarity: 'rare' }),
    row('Emerald Gem', { category: 'gem', rarity: 'rare' }),
    row('Hero Cage (Act 1)', { category: 'chest', act: '1' }),
    row('Item Chest (Lv 30)', { category: 'chest', level: '30' }),
    row('Hero (Rare)', { category: 'hero', rarity: 'rare' }),
    row('Royal Sentinel Skin', { category: 'skin' }),
  ];

  it('hands back tags that reconcile to the very identity they were read off', () => {
    const tagged = reconcile(IDENTIFIED, CATALOG, FETCHED);
    const known = knownTagsFrom(tagged.entries);

    const restamped = reconcile(
      IDENTIFIED.map((entry) => ({ ...entry, tags: known[entry.row.hashName] ?? {} })),
      CATALOG,
      FETCHED,
    );

    expect(Object.keys(known).sort()).toEqual(IDENTIFIED.map((entry) => entry.row.hashName).sort());
    expect(identityOf(restamped.entries)).toEqual(identityOf(tagged.entries));
    expect(restamped.anomalies).toEqual(tagged.anomalies);
  });

  it('withholds a row a cut-short pass left half-tagged, so the next sweep asks again', () => {
    const { entries } = reconcile(
      [row('Ember Weapon', { category: 'equip', set: 'ember', slot: 'weapon' })],
      CATALOG,
      FETCHED,
    );

    expect(entries[0]?.key).toBe(categoryKey('equip', 'Ember Weapon'));
    expect(knownTagsFrom(entries)).toEqual({});
  });

  it('withholds a row no tag pass ever reached, which the enumeration alone produces', () => {
    const { entries } = reconcile([row('Mystery Blade', {})], CATALOG, FETCHED);

    expect(entries[0]?.category).toBeNull();
    expect(knownTagsFrom(entries)).toEqual({});
  });
});
