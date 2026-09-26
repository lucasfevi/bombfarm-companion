import { describe, expect, it } from 'vitest';
import type { CatalogView } from './names.js';
import { indexEntries, isFullyIdentified, reconcile } from './reconcile.js';
import { categoryKey, heroPriceKey, priceKey, type SearchRow } from './types.js';

const FETCHED = '2026-08-29T00:00:00.000Z';

const CATALOG: CatalogView = {
  defs: [
    { defId: 'ember_arma', set: 'ember', slot: 'arma', level: 10 },
    { defId: 'ember_elmo', set: 'ember', slot: 'elmo', level: 10 },
  ],
  rarityIdxs: [0, 1, 2],
  rarityTokens: { 0: 'comum', 1: 'incomum', 2: 'raro' },
  gems: [{ defId: 'gem_emerald', name: 'Emerald', rarityIdx: 2 }],
};

function row(
  hashName: string,
  overrides: { cents?: number | null; listings?: number; type?: string | null } = {},
): SearchRow {
  return {
    hashName,
    name: hashName,
    sellPriceCents: overrides.cents === undefined ? 250 : overrides.cents,
    listings: overrides.listings ?? 3,
    iconUrl: null,
    type: overrides.type ?? null,
  };
}

const reconcileOne = (hashName: string, overrides?: Parameters<typeof row>[1]) =>
  reconcile([row(hashName, overrides)], CATALOG, FETCHED);

describe('reconcile', () => {
  it('gives a row the identity behind the generated name its hash matched', () => {
    const { entries } = reconcileOne('Ember Weapon Lv 10 (Rare)');

    expect(entries[0]).toMatchObject({
      defId: 'ember_arma',
      key: priceKey('ember_arma', 2),
      set: 'ember',
      slot: 'arma',
      rarityIdx: 2,
      level: 10,
      lowestUsd: 2.5,
      kind: 'equipment',
    });
  });

  /**
   * Ten rows were in this form on the live market on 2026-09-23. A generator that emitted only the
   * current form would leave every one of them unpriced while every test using the current form
   * stayed green.
   */
  it('keys a row still in the pre-rename form, to the same identity as the current one', () => {
    const legacy = reconcileOne('Ember Weapon (Rare)').entries[0];
    const current = reconcileOne('Ember Weapon Lv 10 (Rare)').entries[0];

    expect(legacy?.key).toBe(priceKey('ember_arma', 2));
    expect(legacy?.defId).toBe('ember_arma');
    expect(legacy?.level).toBe(10);
    expect(legacy?.key).toBe(current?.key);
  });

  it.each([
    ['Gate Key (Rare)', 'map_key_raro', 2, 'key'],
    ['Skill Stone (Uncommon)', 'skill_stone_incomum', 1, null],
    ['Time Part (Rare)', 'time_part_raro', 2, 'material'],
  ])('builds %s from its prefix and the rarity token', (hashName, defId, rarityIdx, kind) => {
    const { entries } = reconcileOne(hashName);

    expect(entries[0]).toMatchObject({ defId, key: priceKey(defId, rarityIdx), kind });
  });

  it('gives a gem the def and the rarity the committed bundle fixes for it', () => {
    const { entries } = reconcileOne('Emerald Gem');

    expect(entries[0]).toMatchObject({
      defId: 'gem_emerald',
      rarityIdx: 2,
      key: priceKey('gem_emerald', 2),
      kind: 'gem',
    });
  });

  it('leaves a gem the bundle does not name unkeyed rather than guessing one', () => {
    const { entries, anomalies } = reconcileOne('Obsidian Gem');

    expect(entries[0]?.defId).toBeNull();
    expect(entries[0]?.category).toBeNull();
    expect(entries[0]?.key).toBe(categoryKey('unknown', 'Obsidian Gem'));
    expect(anomalies.map((anomaly) => anomaly.kind)).toEqual(['unlinkable-item']);
  });

  it('keys a skin on its category and hash, having no owned copy to reach', () => {
    const { entries, anomalies } = reconcileOne('Royal Sentinel Skin');

    expect(entries[0]).toMatchObject({
      defId: null,
      key: categoryKey('skin', 'Royal Sentinel Skin'),
      kind: null,
      category: 'skin',
    });
    expect(anomalies).toEqual([]);
  });

  it('keeps two chests that differ only by family apart', () => {
    const { entries } = reconcile(
      [row('Hero Cage (Act 1)'), row('Skill Stone Chest (Act 1)')],
      CATALOG,
      FETCHED,
    );

    expect(entries.map((entry) => entry.key)).toEqual([
      priceKey('chest_hero_1', 1),
      priceKey('chest_skill_1', 1),
    ]);
    expect(entries.every((entry) => entry.act === 1)).toBe(true);
  });

  it.each([
    ['Hero Cage', 'chest_hero'],
    ['Time Chest', 'chest_time'],
    ['Gem Chest', 'chest_gem'],
    ['Skill Stone Chest', 'chest_skill'],
  ])('reaches every act of %s, the act doubling as the rarity tier', (family, defPrefix) => {
    for (const act of [1, 2]) {
      const { entries } = reconcileOne(`${family} (Act ${String(act)})`);

      expect(entries[0]?.defId).toBe(`${defPrefix}_${String(act)}`);
      expect(entries[0]?.key).toBe(priceKey(`${defPrefix}_${String(act)}`, act));
    }
  });

  /**
   * A rune chest is listed by rank, and the rank is NOT a tier. An owned `chest_rune_3` reads
   * rarity 0, so keying the market row at the rank would give `chest_rune_3#3` against the owner's
   * `chest_rune_3#0` and the two would never meet — priced on the board, unpriceable in a bag.
   */
  it('keys a rune chest by its rank and rarity 0, not by the rank as a tier', () => {
    const { entries, anomalies } = reconcileOne('Rune Chest (Rank 2)');

    expect(entries[0]).toMatchObject({
      defId: 'chest_rune_2',
      key: priceKey('chest_rune_2', 0),
      category: 'chest',
      act: null,
    });
    expect(entries[0]?.key).not.toBe(priceKey('chest_rune_2', 2));
    expect(anomalies).toEqual([]);
  });

  it('keys an item chest at rarity 0, which is what an owned one carries', () => {
    const { entries } = reconcileOne('Item Chest (Lv 10)');

    expect(entries[0]).toMatchObject({
      defId: 'chest_item_10',
      key: priceKey('chest_item_10', 0),
      level: 10,
      category: 'chest',
    });
  });

  it('keys a tradable hero on its rarity, which is the whole of its market identity', () => {
    const { entries, anomalies } = reconcileOne('Hero (Rare)');

    expect(entries[0]?.key).toBe(heroPriceKey(2));
    expect(entries[0]?.defId).toBeNull();
    expect(anomalies).toEqual([]);
  });

  it('does not let a hash that merely contains a family name borrow that family price', () => {
    const { entries, anomalies } = reconcileOne('Ancient Time Chest (Act 1)');

    expect(entries[0]?.defId).toBeNull();
    expect(entries[0]?.key).toBe(categoryKey('unknown', 'Ancient Time Chest (Act 1)'));
    expect(anomalies.map((anomaly) => anomaly.kind)).toEqual(['unlinkable-item']);
  });

  /**
   * The failure mode a parser has and this does not. `Ember Cape (Rare)` is exactly the shape a
   * parser would read as the ember set in a cape slot; here it matches nothing and says so.
   */
  it('never keys a row by a near miss, whatever its name resembles', () => {
    const { entries, anomalies } = reconcileOne('Ember Cape (Rare)');

    expect(entries[0]?.defId).toBeNull();
    expect(entries[0]?.rarityIdx).toBeNull();
    expect(entries[0]?.key).toBe(categoryKey('unknown', 'Ember Cape (Rare)'));
    expect(anomalies).toHaveLength(1);
    expect(anomalies[0]?.kind).toBe('unlinkable-item');
    expect(anomalies[0]?.detail).toContain('Ember Cape (Rare)');
    expect(entries[0]?.lowestUsd).toBe(2.5);
  });

  it('still prices and still addresses a row it could not identify', () => {
    const { entries } = reconcileOne('Warhorse Mount');

    expect(entries[0]?.key).toBe(categoryKey('unknown', 'Warhorse Mount'));
    expect(entries[0]?.lowestUsd).toBe(2.5);
  });
});

/**
 * The predicate the anomaly is raised from, asserted directly. It is what catches a generated
 * family that names a category and still produces no key an owner can reach — a shape no fixture
 * can reach through `reconcile`, because every family the generator has today produces one.
 */
describe('isFullyIdentified', () => {
  it.each([
    ['a def and a rarity', { hashName: 'x', category: 'equip', defId: 'ember_arma', rarityIdx: 2 }, true],
    ['a hero rarity alone', { hashName: 'Hero (Rare)', category: 'hero', defId: null, rarityIdx: 2 }, true],
    ['a skin, which has no owned copy', { hashName: 'A Skin', category: 'skin', defId: null, rarityIdx: null }, true],
    ['a category with no def', { hashName: 'Mount', category: 'mount', defId: null, rarityIdx: 2 }, false],
    ['a def with no rarity', { hashName: 'Thing', category: 'chest', defId: 'chest_item_30', rarityIdx: null }, false],
    ['no match at all', { hashName: 'Thing', category: null, defId: null, rarityIdx: null }, false],
  ])('is %s: %o', (_case, keyable, expected) => {
    expect(isFullyIdentified(keyable)).toBe(expected);
  });
});

describe('the cross-check against Steam own type', () => {
  /** What the live market sends: measured 2026-09-25, the bare slot word on 248 of 258 rows. */
  it('says nothing when the type is the bare slot word', () => {
    const { anomalies } = reconcileOne('Ember Weapon Lv 10 (Rare)', { type: 'Weapon' });

    expect(anomalies).toEqual([]);
  });

  it('says nothing when a qualifier rides in front of it, which is not the slot changing', () => {
    const { anomalies } = reconcileOne('Ember Weapon Lv 10 (Rare)', { type: 'Uncommon Weapon' });

    expect(anomalies).toEqual([]);
  });

  /**
   * The false alarm the live walk found. Every pre-rename hash still listed carries `""`, so a blank
   * read as a disagreement reported ten rows on every run — rows that had matched and keyed
   * correctly. Blank claims nothing.
   */
  it('says nothing about a blank type, which is what the pre-rename hashes carry', () => {
    expect(reconcileOne('Ember Weapon (Rare)', { type: '' }).anomalies).toEqual([]);
    expect(reconcileOne('Ember Weapon (Rare)', { type: '   ' }).anomalies).toEqual([]);
  });

  it('matches whole words, so a qualifier cannot smuggle a different slot past it', () => {
    const { anomalies } = reconcileOne('Ember Weapon Lv 10 (Rare)', { type: 'Rare Weaponry' });

    expect(anomalies.map((anomaly) => anomaly.kind)).toEqual(['name-form-drift']);
  });

  it('raises drift when the type names a different slot than the matched name does', () => {
    const { entries, anomalies } = reconcileOne('Ember Weapon Lv 10 (Rare)', {
      type: 'Helmet',
    });

    expect(anomalies).toHaveLength(1);
    expect(anomalies[0]?.kind).toBe('name-form-drift');
    expect(anomalies[0]?.detail).toContain('Ember Weapon Lv 10 (Rare)');
    expect(anomalies[0]?.detail).toContain('Helmet');
    // Still priced and still keyed: the row matched, and this is a warning about the next change.
    expect(entries[0]?.key).toBe(priceKey('ember_arma', 2));
  });

  it('says nothing about a row Steam sent no type for', () => {
    const { anomalies } = reconcileOne('Ember Weapon Lv 10 (Rare)', { type: null });

    expect(anomalies).toEqual([]);
  });

  it('says nothing about a category whose name form implies no slot', () => {
    const { anomalies } = reconcileOne('Item Chest (Lv 10)', { type: 'Chest' });

    expect(anomalies).toEqual([]);
  });
});

describe('indexEntries', () => {
  const entriesOf = (rows: SearchRow[]) => reconcile(rows, CATALOG, FETCHED).entries;

  it('reports every catalog def and rarity the market has never carried', () => {
    const indexed = indexEntries(entriesOf([row('Ember Weapon Lv 10 (Rare)')]), CATALOG);

    expect(indexed.index[priceKey('ember_arma', 2)]).toBe(0);
    expect(indexed.unlisted).toHaveLength(5);
    expect(indexed.unlisted).toContain(priceKey('ember_elmo', 2));
    expect(indexed.coverage).toMatchObject({ catalogKeys: 6, matchedCatalogKeys: 1, pricedRows: 1 });
  });

  /**
   * The rename left two live order books for one item. Both name forms generate, so both land on
   * one key — and the row that is not quoted has to be reachable as an alternate rather than
   * dropped, because hiding it would hide real supply.
   */
  it('quotes the cheaper of the two name forms and records the other as an alternate', () => {
    const indexed = indexEntries(
      entriesOf([
        row('Ember Weapon (Rare)', { cents: 900, listings: 12 }),
        row('Ember Weapon Lv 10 (Rare)', { cents: 300, listings: 1 }),
      ]),
      CATALOG,
    );
    const key = priceKey('ember_arma', 2);

    expect(indexed.index[key]).toBe(1);
    expect(indexed.alternates[key]).toEqual([0]);
  });

  it('prefers the deeper book only when the price is a tie', () => {
    const indexed = indexEntries(
      entriesOf([
        row('Ember Weapon (Rare)', { cents: 300, listings: 1 }),
        row('Ember Weapon Lv 10 (Rare)', { cents: 300, listings: 9 }),
      ]),
      CATALOG,
    );

    expect(indexed.index[priceKey('ember_arma', 2)]).toBe(1);
  });

  it('never quotes an unlisted hash over one that has a price', () => {
    const indexed = indexEntries(
      entriesOf([
        row('Ember Weapon (Rare)', { cents: null, listings: 0 }),
        row('Ember Weapon Lv 10 (Rare)', { cents: 800, listings: 1 }),
      ]),
      CATALOG,
    );

    expect(indexed.index[priceKey('ember_arma', 2)]).toBe(1);
    expect(indexed.coverage.pricedRows).toBe(1);
  });

  it('counts a row it could not identify as unkeyed, rather than as understood', () => {
    const indexed = indexEntries(
      entriesOf([row('Ember Weapon Lv 10 (Rare)'), row('Warhorse Mount')]),
      CATALOG,
    );

    expect(indexed.coverage).toMatchObject({ marketRows: 2, keyedRows: 1, unkeyedRows: 1 });
  });
});
