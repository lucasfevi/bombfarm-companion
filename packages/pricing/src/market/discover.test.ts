import { describe, expect, it } from 'vitest';
import { discoverMarket, type DiscoverDeps } from './discover.js';
import { fakeMarket, item, narrowsByFacet } from './__fixtures__/fake-market.js';

const APP_ID = 4892010;

const deps = (market: ReturnType<typeof fakeMarket>, extra: Partial<DiscoverDeps> = {}) => ({
  fetchSearchPage: market.fetchSearchPage,
  sleep: () => Promise.resolve(),
  ...extra,
});

const emberWeapon = item('Ember Weapon (Uncommon)', { type: 'Weapon' });
const heroCage = item('Hero Cage (Act 1)', { type: 'Chest' });
const skin = item('Royal Sentinel Skin');

describe('discoverMarket', () => {
  it('enumerates the whole market with one unfiltered walk, and nothing else', async () => {
    const market = fakeMarket([emberWeapon, heroCage, skin]);

    const result = await discoverMarket(APP_ID, deps(market));

    expect(result.rows.map((row) => row.hashName).sort()).toEqual([
      'Ember Weapon (Uncommon)',
      'Hero Cage (Act 1)',
      'Royal Sentinel Skin',
    ]);
    expect(result.enumerationComplete).toBe(true);
  });

  /**
   * The claim the whole change rests on, and it has to be asserted as a count. A burst that still
   * ran and happened to find nothing would satisfy any weaker test — "no facet query function is
   * called" included, since the fake here answers a narrowed query perfectly well.
   */
  it('spends exactly one call per page of ten rows, and asks for nothing else', async () => {
    const many = Array.from({ length: 23 }, (_, index) => item(`Ember Weapon ${String(index)}`));
    const market = fakeMarket(many);

    const result = await discoverMarket(APP_ID, deps(market));

    expect(result.rows).toHaveLength(23);
    expect(market.calls).toHaveLength(3);
    expect(result.searchCalls).toBe(3);
    expect(market.calls.some((url) => narrowsByFacet(APP_ID, url))).toBe(false);
  });

  it('pages the enumeration until the total it reports is exhausted', async () => {
    const many = Array.from({ length: 23 }, (_, index) => item(`Ember Weapon ${String(index)}`));
    const market = fakeMarket(many);

    await discoverMarket(APP_ID, deps(market));

    expect(market.calls.map((url) => new URL(url).searchParams.get('start'))).toEqual([
      '0',
      '10',
      '20',
    ]);
  });

  it('keeps the type Steam reported, which is what the drift cross-check reads', async () => {
    const market = fakeMarket([emberWeapon, skin]);

    const result = await discoverMarket(APP_ID, deps(market));

    expect(result.rows.find((row) => row.hashName === emberWeapon.hash)?.type).toBe('Weapon');
    expect(result.rows.find((row) => row.hashName === skin.hash)?.type).toBeNull();
  });

  it('retries the same page after a rate limit instead of skipping past it', async () => {
    const market = fakeMarket([emberWeapon], {
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
    const market = fakeMarket([emberWeapon], { failures });

    const result = await discoverMarket(APP_ID, deps(market, { maxConsecutiveRateLimits: 6 }));

    expect(result.complete).toBe(false);
    expect(result.enumerationComplete).toBe(false);
    expect(result.searchCalls).toBe(6);
    expect(result.anomalies.map((anomaly) => anomaly.kind)).toContain('rate-limited');
  });

  it('counts rate limits across the run, because the quota Steam enforces is on the IP', async () => {
    const many = Array.from({ length: 23 }, (_, index) => item(`Ember Weapon ${String(index)}`));
    const market = fakeMarket(many, {
      failures: new Map([
        [1, { rateLimited: true }],
        [2, { rateLimited: true }],
      ]),
    });

    const result = await discoverMarket(APP_ID, deps(market, { maxConsecutiveRateLimits: 2 }));

    expect(result.complete).toBe(false);
    expect(result.searchCalls).toBe(3);
  });

  it('says the enumeration is incomplete when its walk was cut off', async () => {
    const market = fakeMarket([emberWeapon], {
      failures: new Map([[0, { rateLimited: false }]]),
    });

    const result = await discoverMarket(APP_ID, deps(market));

    expect(result.enumerationComplete).toBe(false);
    expect(result.complete).toBe(true);
  });
});
