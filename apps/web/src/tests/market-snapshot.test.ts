import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MarketSnapshot } from '@bombfarm/pricing';
import { resolveItemPrice } from '@bombfarm/pricing';
import {
  MARKET_SNAPSHOT_CACHE_KEY,
  MARKET_SNAPSHOT_URL,
  clearCachedMarketSnapshot,
  loadMarketSnapshot,
  readCachedMarketSnapshot,
  refreshMarketSnapshot,
  writeCachedMarketSnapshot,
} from '@/shared/lib/market-snapshot';
import { resolveMarketStatus } from '@/shared/hooks/use-market-snapshot';

function memoryLocalStorage(options?: { throwOnGet?: boolean; throwOnSet?: boolean }) {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => {
      if (options?.throwOnGet) throw new Error('SecurityError');
      return store.get(key) ?? null;
    },
    setItem: (key: string, value: string) => {
      if (options?.throwOnSet) throw new Error('QuotaExceededError');
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
  };
}

function snapshotFixture(generatedUtc: string, lowestBrl: number): MarketSnapshot {
  return {
    schemaVersion: 3,
    generatedUtc,
    appId: 4892010,
    baseCurrency: 'USD',
    nativeCurrencies: ['BRL'],
    fx: { BRL: 5 },
    entries: [
      {
        hashName: 'Ember Amulet (Rare)',
        name: 'Ember Amulet',
        key: 'amuleto_brasa#2',
        defId: 'amuleto_brasa',
        kind: 'equipment',
        category: 'equip',
        set: 'brasa',
        slot: 'amuleto',
        rarityIdx: 2,
        level: 10,
        act: null,
        lowestUsd: 2,
        lowestNative: { BRL: lowestBrl },
        listings: 4,
        iconUrl: null,
        fetchedUtc: generatedUtc,
        nativeQuotedUtc: '2026-08-29T06:00:00.000Z',
      },
    ],
    index: { 'amuleto_brasa#2': 0 },
    alternates: {},
    unlisted: [],
    anomalies: [],
    coverage: {
      marketRows: 1,
      keyedRows: 1,
      pricedRows: 1,
      unkeyedRows: 0,
      catalogKeys: 1,
      matchedCatalogKeys: 1,
      searchCalls: 1,
    },
  };
}

function jsonResponse(body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status: 200, headers });
}

const OWNED_ITEM = { defId: 'amuleto_brasa', rarity: 2, tradable: true };

describe('market snapshot cache', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryLocalStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('round-trips a snapshot and its ETag', () => {
    const snapshot = snapshotFixture('2026-08-29T12:00:00.000Z', 11.5);
    expect(writeCachedMarketSnapshot({ etag: 'W/"abc"', snapshot })).toBe(true);

    const cached = readCachedMarketSnapshot();
    expect(cached?.etag).toBe('W/"abc"');
    expect(cached?.snapshot.generatedUtc).toBe('2026-08-29T12:00:00.000Z');
  });

  it('reports failure instead of throwing when storage rejects the write', () => {
    vi.stubGlobal('localStorage', memoryLocalStorage({ throwOnSet: true }));
    const snapshot = snapshotFixture('2026-08-29T12:00:00.000Z', 11.5);

    expect(writeCachedMarketSnapshot({ etag: null, snapshot })).toBe(false);
  });

  it('reads as empty instead of throwing when storage rejects the read', () => {
    vi.stubGlobal('localStorage', memoryLocalStorage({ throwOnGet: true }));

    expect(readCachedMarketSnapshot()).toBeNull();
  });

  it('reads as empty when no storage exists at all, as during a static prerender', () => {
    vi.stubGlobal('localStorage', undefined);

    expect(readCachedMarketSnapshot()).toBeNull();
    expect(writeCachedMarketSnapshot({ etag: null, snapshot: snapshotFixture('x', 1) })).toBe(false);
    expect(() => {
      clearCachedMarketSnapshot();
    }).not.toThrow();
  });

  it('rejects a cached payload that is no longer a market snapshot', () => {
    localStorage.setItem(
      MARKET_SNAPSHOT_CACHE_KEY,
      JSON.stringify({ etag: 'W/"old"', snapshot: { schemaVersion: 1, entries: [] } }),
    );

    expect(readCachedMarketSnapshot()).toBeNull();
  });

  it('rejects a cached payload that is not JSON', () => {
    localStorage.setItem(MARKET_SNAPSHOT_CACHE_KEY, 'not json');

    expect(readCachedMarketSnapshot()).toBeNull();
  });
});

describe('market snapshot fetch', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryLocalStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('stores the fetched snapshot with the response ETag, and prices from it on the next load', async () => {
    const snapshot = snapshotFixture('2026-08-29T12:00:00.000Z', 11.5);
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse(snapshot, { ETag: 'W/"one"' }));
    vi.stubGlobal('fetch', fetchMock);

    const first = await loadMarketSnapshot();

    expect(fetchMock).toHaveBeenCalledWith(MARKET_SNAPSHOT_URL, {
      cache: 'default',
      headers: {},
    });
    expect(first.error).toBeNull();
    expect(first.etag).toBe('W/"one"');
    expect(readCachedMarketSnapshot()?.etag).toBe('W/"one"');
    expect(resolveItemPrice(OWNED_ITEM, first.snapshot, 'BRL').amount).toBe(11.5);
  });

  it('sends the stored ETag on the next load', async () => {
    writeCachedMarketSnapshot({
      etag: 'W/"one"',
      snapshot: snapshotFixture('2026-08-29T12:00:00.000Z', 11.5),
    });
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 304 }));
    vi.stubGlobal('fetch', fetchMock);

    await loadMarketSnapshot();

    expect(fetchMock).toHaveBeenCalledWith(MARKET_SNAPSHOT_URL, {
      cache: 'default',
      headers: { 'If-None-Match': 'W/"one"' },
    });
  });

  it('bypasses the HTTP cache on refresh', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse(snapshotFixture('2026-08-29T12:00:00.000Z', 11.5)));
    vi.stubGlobal('fetch', fetchMock);

    await refreshMarketSnapshot();

    expect(fetchMock.mock.calls[0]?.[1]?.cache).toBe('reload');
  });

  it('treats 304 as unchanged and still fresh, leaving the cache in place', async () => {
    const snapshot = snapshotFixture('2026-08-29T12:00:00.000Z', 11.5);
    writeCachedMarketSnapshot({ etag: 'W/"one"', snapshot });
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 304 })),
    );

    const result = await refreshMarketSnapshot();

    expect(result.error).toBeNull();
    expect(result.etag).toBe('W/"one"');
    expect(result.snapshot?.generatedUtc).toBe('2026-08-29T12:00:00.000Z');
    expect(readCachedMarketSnapshot()?.snapshot.generatedUtc).toBe('2026-08-29T12:00:00.000Z');
  });

  it('keeps pricing from the cached snapshot after a refresh fails to reach the network', async () => {
    const cached = snapshotFixture('2026-08-29T12:00:00.000Z', 11.5);
    writeCachedMarketSnapshot({ etag: 'W/"one"', snapshot: cached });
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockRejectedValue(new Error('offline')));

    const result = await refreshMarketSnapshot();

    expect(result.error).toBe('network');
    expect(result.snapshot?.generatedUtc).toBe('2026-08-29T12:00:00.000Z');
    expect(resolveItemPrice(OWNED_ITEM, result.snapshot, 'BRL').amount).toBe(11.5);
    expect(readCachedMarketSnapshot()?.etag).toBe('W/"one"');
  });

  it('keeps the cached snapshot when the server answers with an error status', async () => {
    writeCachedMarketSnapshot({
      etag: 'W/"one"',
      snapshot: snapshotFixture('2026-08-29T12:00:00.000Z', 11.5),
    });
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(new Response('nope', { status: 500 })),
    );

    const result = await refreshMarketSnapshot();

    expect(result.error).toBe('http');
    expect(result.snapshot?.generatedUtc).toBe('2026-08-29T12:00:00.000Z');
    expect(readCachedMarketSnapshot()).not.toBeNull();
  });

  it('keeps the cached snapshot when the published file is not a market snapshot', async () => {
    writeCachedMarketSnapshot({
      etag: 'W/"one"',
      snapshot: snapshotFixture('2026-08-29T12:00:00.000Z', 11.5),
    });
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ nope: true })));

    const result = await refreshMarketSnapshot();

    expect(result.error).toBe('malformed');
    expect(result.snapshot?.generatedUtc).toBe('2026-08-29T12:00:00.000Z');
    expect(readCachedMarketSnapshot()?.snapshot.generatedUtc).toBe('2026-08-29T12:00:00.000Z');
  });

  it('replaces the cache when a later fetch brings a newer snapshot', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(
          jsonResponse(snapshotFixture('2026-08-29T12:00:00.000Z', 11.5), { ETag: 'W/"one"' }),
        )
        .mockResolvedValueOnce(
          jsonResponse(snapshotFixture('2026-08-29T18:00:00.000Z', 12.75), { ETag: 'W/"two"' }),
        ),
    );

    await loadMarketSnapshot();
    const second = await refreshMarketSnapshot();

    expect(second.etag).toBe('W/"two"');
    expect(readCachedMarketSnapshot()?.etag).toBe('W/"two"');
    expect(resolveItemPrice(OWNED_ITEM, second.snapshot, 'BRL').amount).toBe(12.75);
  });

  it('reports an error with nothing cached when the first load cannot reach the network', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockRejectedValue(new Error('offline')));

    const result = await loadMarketSnapshot();

    expect(result).toEqual({ snapshot: null, etag: null, error: 'network' });
  });

  it('survives a load with no storage to cache into', async () => {
    vi.stubGlobal('localStorage', undefined);
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(snapshotFixture('2026-08-29T12:00:00.000Z', 11.5))),
    );

    const result = await loadMarketSnapshot();

    expect(result.error).toBeNull();
    expect(result.snapshot?.generatedUtc).toBe('2026-08-29T12:00:00.000Z');
  });
});

describe('market snapshot status', () => {
  const snapshot = snapshotFixture('2026-08-29T12:00:00.000Z', 11.5);

  it('is loading until the first load settles, whatever is cached', () => {
    expect(resolveMarketStatus(false, null, null)).toBe('loading');
    expect(resolveMarketStatus(false, snapshot, null)).toBe('loading');
  });

  it('is ready once a snapshot with entries is held, even when the last fetch failed', () => {
    expect(resolveMarketStatus(true, snapshot, null)).toBe('ready');
    expect(resolveMarketStatus(true, snapshot, 'network')).toBe('ready');
  });

  it('is error only when a failure left nothing to price from', () => {
    expect(resolveMarketStatus(true, null, 'network')).toBe('error');
  });

  it('is empty when nothing failed but nothing can be priced', () => {
    expect(resolveMarketStatus(true, null, null)).toBe('empty');
    expect(resolveMarketStatus(true, { ...snapshot, entries: [] }, null)).toBe('empty');
  });
});
