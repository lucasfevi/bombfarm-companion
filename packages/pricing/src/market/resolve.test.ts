import { describe, expect, it } from 'vitest';
import type { CatalogView } from './reconcile.js';
import { resolveHeroPrice, resolveItemPrice, resolveKey, resolveSkinPrice } from './resolve.js';
import { buildSnapshot } from './snapshot.js';
import type { MarketEntry } from './types.js';
import { MARKET_APP_ID, categoryKey, heroPriceKey, priceKey } from './types.js';

const CATALOG: CatalogView = {
  defs: [{ defId: 'ember_arma', set: 'ember', slot: 'arma', level: 10 }],
  rarityIdxs: [1, 2],
  rarityTokens: { 1: 'incomum', 2: 'raro' },
  defIdByHash: {},
};

function marketEntry(overrides: Partial<MarketEntry> & { hashName: string }): MarketEntry {
  return {
    name: overrides.hashName,
    key: priceKey('ember_arma', 1),
    defId: 'ember_arma',
    kind: 'equipment',
    category: 'equip',
    set: 'ember',
    slot: 'arma',
    rarityIdx: 1,
    level: 10,
    act: null,
    lowestNative: {},
    nativeQuotedUtc: null,
    lowestUsd: 2.5,
    listings: 4,
    iconUrl: null,
    fetchedUtc: '2026-08-29T00:00:00.000Z',
    ...overrides,
  };
}

const snapshotOf = (entries: MarketEntry[]) =>
  buildSnapshot({
    entries,
    prior: null,
    catalog: CATALOG,
    fx: { USD: 1, BRL: 5.4 },
    anomalies: [],
    searchCalls: 1,
    enumerationComplete: true,
    now: () => Date.parse('2026-08-29T12:00:00.000Z'),
  });

const owned = { defId: 'ember_arma', rarity: 1, tradable: true };

describe('resolveItemPrice', () => {
  it('prices an owned item from its def and rarity alone', () => {
    const resolved = resolveItemPrice(owned, snapshotOf([marketEntry({ hashName: 'Ember Weapon' })]));

    expect(resolved).toMatchObject({
      state: 'priced',
      key: priceKey('ember_arma', 1),
      hashName: 'Ember Weapon',
      lowestUsd: 2.5,
      amount: 2.5,
      currency: 'USD',
      listings: 4,
    });
    expect(resolved.listingUrl).toBe(
      `https://steamcommunity.com/market/listings/${String(MARKET_APP_ID)}/Ember%20Weapon`,
    );
  });

  it('converts into the requested currency', () => {
    const resolved = resolveItemPrice(
      owned,
      snapshotOf([marketEntry({ hashName: 'Ember Weapon' })]),
      'brl',
    );

    expect(resolved.amount).toBeCloseTo(13.5);
    expect(resolved.currency).toBe('BRL');
  });

  it('falls back to USD rather than inventing a rate it does not have', () => {
    const resolved = resolveItemPrice(
      owned,
      snapshotOf([marketEntry({ hashName: 'Ember Weapon' })]),
      'JPY',
    );

    expect(resolved.amount).toBe(2.5);
    expect(resolved.currency).toBe('USD');
  });

  it('says not-tradable without consulting the snapshot at all', () => {
    const resolved = resolveItemPrice({ ...owned, tradable: false }, null);

    expect(resolved.state).toBe('not-tradable');
    expect(resolved.listingUrl).toBeNull();
  });

  it('tells an item the market has never carried apart from one with no listing today', () => {
    const listed = snapshotOf([
      marketEntry({ hashName: 'Ember Weapon', lowestUsd: null, listings: 0 }),
    ]);

    expect(resolveItemPrice(owned, listed).state).toBe('no-listing');
    expect(resolveItemPrice({ ...owned, rarity: 2 }, listed).state).toBe('unknown');
  });

  it('still links to the market for an item that is listed nowhere right now', () => {
    const listed = snapshotOf([
      marketEntry({ hashName: 'Ember Weapon', lowestUsd: null, listings: 0 }),
    ]);

    expect(resolveItemPrice(owned, listed).listingUrl).toContain('Ember%20Weapon');
  });

  it('reports unknown when there is no snapshot yet, not a price of zero', () => {
    const resolved = resolveItemPrice(owned, null);

    expect(resolved.state).toBe('unknown');
    expect(resolved.amount).toBeNull();
  });

  it('names the other hashes carrying the same item', () => {
    const snapshot = snapshotOf([
      marketEntry({ hashName: 'Ember Weapon', lowestUsd: 9 }),
      marketEntry({ hashName: 'Ember Weapon Lv 10', lowestUsd: 3 }),
    ]);

    const resolved = resolveItemPrice(owned, snapshot);

    expect(resolved.hashName).toBe('Ember Weapon Lv 10');
    expect(resolved.alternateHashNames).toEqual(['Ember Weapon']);
  });
});

describe('resolveKey', () => {
  it('prices a chest, a cage or a skin the catalog has no def for', () => {
    const key = categoryKey('skin', 'Royal Sentinel Skin');
    const snapshot = snapshotOf([
      marketEntry({
        hashName: 'Royal Sentinel Skin',
        key,
        defId: null,
        kind: null,
        category: 'skin',
        set: null,
        slot: null,
        rarityIdx: null,
        level: null,
        lowestUsd: 48.14,
        listings: 1,
      }),
    ]);

    expect(resolveKey(key, snapshot, 'BRL')).toMatchObject({
      state: 'priced',
      hashName: 'Royal Sentinel Skin',
      currency: 'BRL',
    });
  });

  it('reports unknown for a key nothing on the market carries', () => {
    expect(resolveKey('chest#Nothing', snapshotOf([])).state).toBe('unknown');
  });
});

describe('resolveHeroPrice', () => {
  const heroEntry = marketEntry({
    hashName: 'Hero (Rare)',
    key: heroPriceKey(2),
    defId: null,
    kind: null,
    category: 'hero',
    set: null,
    slot: null,
    rarityIdx: 2,
    level: null,
    lowestUsd: 10,
  });

  it('prices an owned hero on its rarity and nothing else', () => {
    expect(resolveHeroPrice({ rarity: 2, marketable: true }, snapshotOf([heroEntry]))).toMatchObject(
      { state: 'priced', key: heroPriceKey(2), hashName: 'Hero (Rare)', amount: 10 },
    );
  });

  it('does not let one rarity reach another rarity of the same hero listing', () => {
    expect(resolveHeroPrice({ rarity: 3, marketable: true }, snapshotOf([heroEntry])).state).toBe(
      'unknown',
    );
  });

  it('keeps a hero away from the item priced at the same rarity index', () => {
    const both = snapshotOf([heroEntry, marketEntry({ hashName: 'Ember Weapon' })]);

    expect(resolveHeroPrice({ rarity: 1, marketable: true }, both).state).toBe('unknown');
  });

  it('says not-tradable for a hero bound to the account, without consulting the snapshot', () => {
    const resolved = resolveHeroPrice({ rarity: 2, marketable: false }, snapshotOf([heroEntry]));

    expect(resolved).toMatchObject({ state: 'not-tradable', key: null, amount: null });
  });
});

describe('resolveSkinPrice', () => {
  const snapshot = snapshotOf([
    marketEntry({
      hashName: 'Royal Sentinel Skin',
      key: categoryKey('skin', 'Royal Sentinel Skin'),
      defId: null,
      kind: null,
      category: 'skin',
      set: null,
      slot: null,
      rarityIdx: null,
      level: null,
      lowestUsd: 48.14,
    }),
  ]);

  it('prices a worn skin through the listing the table names for it', () => {
    expect(resolveSkinPrice(8, snapshot)).toMatchObject({
      state: 'priced',
      hashName: 'Royal Sentinel Skin',
      amount: 48.14,
    });
  });

  it('gives an index the table cannot name no key and no price, not the only skin listed', () => {
    expect(resolveSkinPrice(9, snapshot)).toMatchObject({
      key: null,
      hashName: null,
      amount: null,
    });
  });

  it('gives a named skin the market has never carried no price either', () => {
    expect(resolveSkinPrice(4, snapshot)).toMatchObject({ state: 'unknown', amount: null });
  });

  it('has no price for a birth skin, which is not something anyone bought', () => {
    expect(resolveSkinPrice(0, snapshot).amount).toBeNull();
  });
});

describe('native versus converted quotes', () => {
  const item = { defId: 'ember_arma', rarity: 1, tradable: true };

  it('quotes the currency Steam priced itself, not the converted figure', () => {
    const snapshot = snapshotOf([
      marketEntry({
        hashName: 'Ember Sword',
        lowestUsd: 4.8,
        lowestNative: { BRL: 25 },
        nativeQuotedUtc: '2026-08-29T12:00:00.000Z',
      }),
    ]);
    snapshot.fx = { USD: 1, BRL: 5.1641 };

    expect(resolveItemPrice(item, snapshot, 'BRL')).toMatchObject({
      amount: 25,
      currency: 'BRL',
      basis: 'native',
    });
  });

  it('converts rather than quoting a native price it cannot date', () => {
    const snapshot = snapshotOf([
      marketEntry({
        hashName: 'Ember Sword',
        lowestUsd: 10,
        lowestNative: { BRL: 52 },
        nativeQuotedUtc: null,
      }),
    ]);
    snapshot.fx = { USD: 1, BRL: 5 };

    expect(resolveItemPrice(item, snapshot, 'BRL')).toMatchObject({
      amount: 50,
      currency: 'BRL',
      basis: 'converted',
      quotedUtc: '2026-08-29T00:00:00.000Z',
    });
  });

  it('leaves every priced result datable, whatever the basis', () => {
    const snapshot = snapshotOf([
      marketEntry({ hashName: 'Ember Sword', lowestUsd: 10, lowestNative: { BRL: 52 } }),
    ]);
    snapshot.fx = { USD: 1, BRL: 5 };

    const price = resolveItemPrice(item, snapshot, 'BRL');
    expect(price.state).toBe('priced');
    expect(price.quotedUtc).not.toBeNull();
  });

  it('falls back to converting when Steam declined to quote that currency', () => {
    const snapshot = snapshotOf([
      marketEntry({ hashName: 'Ember Sword', lowestUsd: 10, lowestNative: {} }),
    ]);
    snapshot.fx = { USD: 1, BRL: 5 };

    expect(resolveItemPrice(item, snapshot, 'BRL')).toMatchObject({
      amount: 50,
      currency: 'BRL',
      basis: 'converted',
    });
  });

  it('dates a native quote by its own timestamp rather than by the enumeration', () => {
    const snapshot = snapshotOf([
      marketEntry({
        hashName: 'Ember Sword',
        lowestUsd: 4.8,
        lowestNative: { BRL: 25 },
        fetchedUtc: '2026-08-29T18:00:00.000Z',
        nativeQuotedUtc: '2026-08-29T12:00:00.000Z',
      }),
    ]);

    expect(resolveItemPrice(item, snapshot, 'BRL').quotedUtc).toBe('2026-08-29T12:00:00.000Z');
  });

  it('reports no listing when the enumeration found none, even holding a native quote', () => {
    // priceoverview under-reports rather than over-reports, so the enumeration owns this call;
    // a stale quote must not resurrect supply that is gone.
    const snapshot = snapshotOf([
      marketEntry({ hashName: 'Ember Sword', lowestUsd: null, lowestNative: { BRL: 25 } }),
    ]);

    expect(resolveItemPrice(item, snapshot, 'BRL')).toMatchObject({
      state: 'no-listing',
      amount: null,
    });
  });
});
