import { describe, expect, it } from 'vitest';
import type { CatalogView } from './reconcile.js';
import { buildSnapshot, isMarketSnapshot, mergeEntries } from './snapshot.js';
import type { MarketEntry } from './types.js';
import { priceKey } from './types.js';

const CATALOG: CatalogView = {
  defs: [
    { defId: 'ember_arma', set: 'ember', slot: 'arma', level: 10 },
    { defId: 'ember_elmo', set: 'ember', slot: 'elmo', level: 10 },
  ],
  rarityIdxs: [1],
  rarityTokens: { 1: 'incomum' },
};

function entry(overrides: Partial<MarketEntry> & { hashName: string }): MarketEntry {
  return {
    name: overrides.hashName,
    key: 'unset',
    defId: null,
    kind: null,
    category: 'equip',
    set: null,
    slot: null,
    rarityIdx: null,
    level: null,
    act: null,
    lowestUsd: 1,
    listings: 1,
    iconUrl: null,
    fetchedUtc: '2026-08-28T00:00:00.000Z',
    ...overrides,
  };
}

const weapon = entry({
  hashName: 'Ember Weapon',
  key: priceKey('ember_arma', 1),
  defId: 'ember_arma',
  set: 'ember',
  slot: 'arma',
  rarityIdx: 1,
  level: 10,
  lowestUsd: 5,
});
const helmet = entry({
  hashName: 'Ember Helmet',
  key: priceKey('ember_elmo', 1),
  defId: 'ember_elmo',
  set: 'ember',
  slot: 'elmo',
  rarityIdx: 1,
  level: 10,
  lowestUsd: 7,
});

describe('mergeEntries', () => {
  it('drops an item the market no longer carries, once the walk that says so finished', () => {
    const merged = mergeEntries([weapon], [helmet], true);

    expect(merged.map((row) => row.hashName)).toEqual(['Ember Weapon']);
  });

  it('keeps what a cut-short walk never reached, rather than shrinking the snapshot', () => {
    const merged = mergeEntries([weapon], [helmet], false);

    expect(merged.map((row) => row.hashName)).toEqual(['Ember Weapon', 'Ember Helmet']);
  });

  it('prefers this run price over the previous one for the same item', () => {
    const merged = mergeEntries([weapon], [{ ...weapon, lowestUsd: 99 }], true);

    expect(merged).toHaveLength(1);
    expect(merged[0]?.lowestUsd).toBe(5);
  });

  it('keeps the identity a previous run established when this run stopped before tagging', () => {
    const untagged = entry({ hashName: 'Ember Weapon', key: 'unknown#Ember Weapon', category: null });

    const merged = mergeEntries([untagged], [weapon], false);

    expect(merged[0]).toMatchObject({
      key: priceKey('ember_arma', 1),
      defId: 'ember_arma',
      rarityIdx: 1,
      level: 10,
    });
  });

  it('never inherits a previous price for an item that is listed nowhere now', () => {
    const delisted = { ...weapon, lowestUsd: null, listings: 0 };

    const merged = mergeEntries([delisted], [weapon], true);

    expect(merged[0]?.lowestUsd).toBeNull();
    expect(merged[0]?.listings).toBe(0);
  });
});

describe('buildSnapshot', () => {
  const parts = {
    entries: [weapon],
    prior: null,
    catalog: CATALOG,
    fx: { USD: 1, BRL: 5.4 },
    anomalies: [],
    searchCalls: 12,
    enumerationComplete: true,
    now: () => Date.parse('2026-08-29T12:00:00.000Z'),
  };

  it('indexes every item so an app prices one with a single lookup', () => {
    const snapshot = buildSnapshot(parts);

    expect(snapshot.index[priceKey('ember_arma', 1)]).toBe(0);
    expect(snapshot.unlisted).toEqual([priceKey('ember_elmo', 1)]);
    expect(snapshot.coverage).toMatchObject({
      marketRows: 1,
      pricedRows: 1,
      matchedCatalogKeys: 1,
      searchCalls: 12,
    });
  });
});

describe('isMarketSnapshot', () => {
  it('rejects a payload from another schema rather than half-reading it', () => {
    const snapshot = buildSnapshot({
      entries: [],
      prior: null,
      catalog: CATALOG,
      fx: {},
      anomalies: [],
      searchCalls: 0,
      enumerationComplete: true,
      now: () => 0,
    });

    expect(isMarketSnapshot(snapshot)).toBe(true);
    expect(isMarketSnapshot({ ...snapshot, schemaVersion: 1 })).toBe(false);
    expect(isMarketSnapshot(null)).toBe(false);
  });
});
