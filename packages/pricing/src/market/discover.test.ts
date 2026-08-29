import { describe, expect, it } from 'vitest';
import { discoverMarket, type DiscoverDeps } from './discover.js';
import { fakeMarket, item } from './__fixtures__/fake-market.js';

const APP_ID = 4892010;

const CATALOG_TAGS = {
  set: ['ember', 'gold'],
  slot: ['weapon', 'helmet'],
  rarity: ['uncommon', 'rare'],
};

const deps = (market: ReturnType<typeof fakeMarket>, extra: Partial<DiscoverDeps> = {}) => ({
  fetchAppFilters: market.fetchAppFilters,
  fetchSearchPage: market.fetchSearchPage,
  catalogTags: CATALOG_TAGS,
  sleep: () => Promise.resolve(),
  ...extra,
});

const emberWeapon = item('Ember Weapon (Uncommon)', {
  set: 'ember',
  slot: 'weapon',
  rarity: 'uncommon',
  category: 'equip',
});
const emberHelmet = item('Ember Helmet Lv 10 (Rare)', {
  set: 'ember',
  slot: 'helmet',
  rarity: 'rare',
  category: 'equip',
  level: '10',
});
const heroCage = item('Hero Cage (Act 1)', { category: 'chest', act: '1' });
const skin = item('Royal Sentinel Skin', { category: 'skin' });

const FACETS = {
  set: ['ember'],
  slot: ['weapon', 'helmet'],
  rarity: ['uncommon', 'rare'],
  category: ['equip', 'chest', 'skin'],
  act: ['1'],
  level: ['10'],
};

describe('discoverMarket', () => {
  it('enumerates the whole market with one unfiltered walk before asking about tags', async () => {
    const market = fakeMarket(APP_ID, [emberWeapon, heroCage, skin], FACETS);

    const result = await discoverMarket(APP_ID, deps(market));

    expect(market.queries[0]).toBe('');
    expect(result.rows.map((row) => row.row.hashName).sort()).toEqual([
      'Ember Weapon (Uncommon)',
      'Hero Cage (Act 1)',
      'Royal Sentinel Skin',
    ]);
    expect(result.enumerationComplete).toBe(true);
  });

  it('finds an item in a category the catalog has never heard of', async () => {
    const market = fakeMarket(APP_ID, [skin], FACETS);

    const result = await discoverMarket(APP_ID, deps(market));

    const found = result.rows.find((row) => row.row.hashName === 'Royal Sentinel Skin');
    expect(found?.tags.category).toBe('skin');
  });

  it('tags each row by the queries it came back from, never by its name', async () => {
    const market = fakeMarket(APP_ID, [emberHelmet, heroCage], FACETS);

    const result = await discoverMarket(APP_ID, deps(market));

    expect(result.rows.find((row) => row.row.hashName === emberHelmet.hash)?.tags).toEqual({
      category: 'equip',
      set: 'ember',
      slot: 'helmet',
      rarity: 'rare',
      level: '10',
    });
    expect(result.rows.find((row) => row.row.hashName === heroCage.hash)?.tags).toEqual({
      category: 'chest',
      act: '1',
    });
  });

  it('asks the catalog tags Steam left out, which is how a listed helmet was nearly missed', async () => {
    const market = fakeMarket(APP_ID, [emberHelmet], { ...FACETS, slot: ['weapon'] });

    const result = await discoverMarket(APP_ID, deps(market));

    expect(market.queries).toContain('slot=helmet');
    expect(result.rows[0]?.tags.slot).toBe('helmet');
    expect(result.anomalies).toEqual([]);
  });

  it('stops trying catalog tags once every equipment row has the facet', async () => {
    const market = fakeMarket(APP_ID, [emberWeapon], { ...FACETS, slot: [] });

    await discoverMarket(
      APP_ID,
      deps(market, { catalogTags: { ...CATALOG_TAGS, slot: ['weapon', 'helmet'] } }),
    );

    expect(market.queries).toContain('slot=weapon');
    expect(market.queries).not.toContain('slot=helmet');
  });

  it('reports equipment it could not tag, rather than pricing it as something else', async () => {
    const orphan = item('Mystery Blade (Rare)', { category: 'equip' });
    const market = fakeMarket(APP_ID, [orphan], FACETS);

    const result = await discoverMarket(APP_ID, deps(market));

    expect(result.anomalies.map((anomaly) => anomaly.kind)).toContain('untagged-equipment');
  });

  it('flags a tag Steam publishes that the catalog cannot map', async () => {
    const market = fakeMarket(APP_ID, [], { ...FACETS, slot: ['weapon', 'wings'] });

    const result = await discoverMarket(APP_ID, deps(market));

    expect(result.anomalies).toContainEqual(
      expect.objectContaining({ kind: 'unknown-slot-tag' }),
    );
  });

  it('pages the enumeration until the total it reports is exhausted', async () => {
    const many = Array.from({ length: 23 }, (_, index) =>
      item(`Ember Weapon ${String(index)}`, {
        set: 'ember',
        slot: 'weapon',
        rarity: 'uncommon',
        category: 'equip',
      }),
    );
    const market = fakeMarket(APP_ID, many, FACETS);

    const result = await discoverMarket(APP_ID, deps(market));

    expect(result.rows).toHaveLength(23);
    expect(market.calls.slice(0, 3).map((url) => new URL(url).searchParams.get('start'))).toEqual([
      '0',
      '10',
      '20',
    ]);
  });

  it('still tags when the facet schema cannot be fetched, rather than losing the whole run', async () => {
    const market = fakeMarket(APP_ID, [emberWeapon], FACETS);

    const result = await discoverMarket(
      APP_ID,
      deps(market, { fetchAppFilters: () => Promise.reject(new Error('HTTP 429')) }),
    );

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.tags.category).toBe('equip');
    expect(result.rows[0]?.tags.slot).toBe('weapon');
  });

  it('retries the same page after a rate limit instead of skipping past it', async () => {
    const market = fakeMarket(APP_ID, [emberWeapon], FACETS, {
      failures: new Map([[0, { rateLimited: true }]]),
    });

    const result = await discoverMarket(APP_ID, deps(market));

    expect(new URL(market.calls[0] ?? '').searchParams.get('start')).toBe('0');
    expect(new URL(market.calls[1] ?? '').searchParams.get('start')).toBe('0');
    expect(result.rows).toHaveLength(1);
  });

  it('stops the whole run once rate limits come back to back, and says so', async () => {
    const failures = new Map(
      Array.from({ length: 6 }, (_, index) => [index, { rateLimited: true }] as const),
    );
    const market = fakeMarket(APP_ID, [emberWeapon], FACETS, { failures });

    const result = await discoverMarket(APP_ID, deps(market, { maxConsecutiveRateLimits: 6 }));

    expect(result.complete).toBe(false);
    expect(result.enumerationComplete).toBe(false);
    expect(result.searchCalls).toBe(6);
    expect(result.anomalies.map((anomaly) => anomaly.kind)).toContain('rate-limited');
  });

  it('counts rate limits across the run, because the quota Steam enforces is on the IP', async () => {
    const market = fakeMarket(APP_ID, [emberWeapon], FACETS, {
      failures: new Map([
        [0, { rateLimited: true }],
        [1, { rateLimited: true }],
        [2, { rateLimited: false }],
        [3, { rateLimited: true }],
      ]),
    });

    const result = await discoverMarket(APP_ID, deps(market, { maxConsecutiveRateLimits: 3 }));

    expect(result.complete).toBe(false);
    expect(result.searchCalls).toBe(4);
  });

  it('says the enumeration is incomplete when its walk was cut off', async () => {
    const market = fakeMarket(APP_ID, [emberWeapon], FACETS, {
      failures: new Map([[0, { rateLimited: false }]]),
    });

    const result = await discoverMarket(APP_ID, deps(market));

    expect(result.enumerationComplete).toBe(false);
  });
});
