import { describe, expect, it } from 'vitest';
import { resolveKey } from '@bombfarm/pricing';
import type { MarketEntry, MarketSnapshot } from '@bombfarm/pricing';
import type { LogPort } from '../storage/index.js';
import type { MarketCacheIo } from './market-cache.js';
import { createMarketService, type MarketServiceDeps, type MarketView } from './market-service.js';
import { MARKET_SNAPSHOT_URL, type MarketHttpRequest, type MarketHttpResponse } from './market-transport.js';

const CACHE_PATH = 'C:/userdata/market-prices.json';
const GLOVES = 'Gold Gloves (Legendary)';

const silentLog: LogPort = { info: () => undefined, warn: () => undefined, error: () => undefined };

function entry(hashName: string, key: string, brl: number | null, quotedUtc: string | null): MarketEntry {
  return {
    hashName,
    name: hashName,
    key,
    defId: null,
    kind: null,
    category: 'equip',
    set: null,
    slot: null,
    rarityIdx: null,
    level: null,
    act: null,
    lowestUsd: 5,
    lowestNative: brl === null ? {} : { BRL: brl },
    listings: 3,
    iconUrl: null,
    fetchedUtc: '2026-08-29T00:00:00.000Z',
    nativeQuotedUtc: quotedUtc,
  };
}

function snapshotWith(entries: MarketEntry[], generatedUtc = '2026-08-29T00:00:00.000Z'): MarketSnapshot {
  const index: Record<string, number> = {};
  entries.forEach((row, position) => {
    index[row.key] = position;
  });
  return {
    schemaVersion: 3,
    generatedUtc,
    appId: 4892010,
    baseCurrency: 'USD',
    nativeCurrencies: ['BRL'],
    fx: { BRL: 5.4 },
    entries,
    index,
    alternates: {},
    unlisted: [],
    anomalies: [],
    coverage: {
      marketRows: entries.length,
      keyedRows: entries.length,
      pricedRows: entries.length,
      unkeyedRows: 0,
      catalogKeys: entries.length,
      matchedCatalogKeys: entries.length,
      searchCalls: 1,
    },
  };
}

interface Harness {
  service: ReturnType<typeof createMarketService>;
  requests: MarketHttpRequest[];
  sleeps: number[];
  pushes: MarketView[];
  files: Map<string, string>;
  advance(ms: number): void;
}

interface HarnessOptions {
  respond: (request: MarketHttpRequest, callIndex: number) => MarketHttpResponse | Promise<MarketHttpResponse>;
  files?: Record<string, string>;
  overrides?: Partial<MarketServiceDeps>;
}

/**
 * A fake clock that `sleep` advances, so a pacing decision the service makes is observable as a
 * recorded duration rather than as real elapsed time.
 */
function harness({ respond, files = {}, overrides = {} }: HarnessOptions): Harness {
  const requests: MarketHttpRequest[] = [];
  const sleeps: number[] = [];
  const pushes: MarketView[] = [];
  const disk = new Map(Object.entries(files));
  let clock = Date.parse('2026-08-29T12:00:00.000Z');

  const io: MarketCacheIo = {
    read: (path) => disk.get(path) ?? null,
    write: (path, contents) => {
      disk.set(path, contents);
    },
  };

  const service = createMarketService({
    httpGet: (request) => {
      const callIndex = requests.length;
      requests.push(request);
      return Promise.resolve(respond(request, callIndex));
    },
    cachePath: CACHE_PATH,
    io,
    log: silentLog,
    now: () => clock,
    sleep: (ms) => {
      sleeps.push(ms);
      clock += ms;
      return Promise.resolve();
    },
    onChanged: (view) => pushes.push(view),
    ...overrides,
  });

  return {
    service,
    requests,
    sleeps,
    pushes,
    files: disk,
    advance: (ms) => {
      clock += ms;
    },
  };
}

const ok = (body: unknown, etag: string | null = null): MarketHttpResponse => ({
  status: 200,
  etag,
  body: JSON.stringify(body),
});

const priceOf = (view: MarketView, position = 0): number | null =>
  view.snapshot?.entries[position]?.lowestNative.BRL ?? null;

describe('market snapshot fetch', () => {
  it('adopts a published snapshot and writes it to the cache', async () => {
    const h = harness({ respond: () => ok(snapshotWith([entry(GLOVES, 'k1', null, null)]), 'v1') });

    const view = await h.service.refreshSnapshot();

    expect(h.requests[0]?.url).toBe(MARKET_SNAPSHOT_URL);
    expect(view.source).toBe('network');
    expect(view.publishedUtc).toBe('2026-08-29T00:00:00.000Z');
    expect(h.files.get(CACHE_PATH)).toContain(GLOVES);
    expect(h.pushes).toHaveLength(1);
  });

  /**
   * A version 2 body carries no `lowestNative` on any entry, and the published file is one until
   * the sweep next runs. Adopting it unchanged put `undefined` where pricing indexes a currency,
   * and the Inventory screen died on render — every one of its smoke tests, while every unit test
   * stayed green because they all build version 3 entries.
   */
  it('brings a version 2 body up to shape, so pricing can read a currency off every entry', async () => {
    const legacy = snapshotWith([entry(GLOVES, 'k1', null, null)]) as unknown as Record<string, unknown>;
    legacy.schemaVersion = 2;
    delete legacy.nativeCurrencies;
    for (const row of legacy.entries as Record<string, unknown>[]) {
      delete row.lowestNative;
      delete row.nativeQuotedUtc;
    }

    const h = harness({ respond: () => ok(legacy) });

    const view = await h.service.refreshSnapshot();

    expect(view.snapshot?.entries[0]?.lowestNative).toEqual({});
    expect(() => resolveKey('k1', view.snapshot, 'BRL')).not.toThrow();
    expect(resolveKey('k1', view.snapshot, 'BRL').basis).toBe('converted');
  });

  it('brings a version 2 body up to shape when it comes off disk, not just off the network', () => {
    const legacy = snapshotWith([entry(GLOVES, 'k1', null, null)]) as unknown as Record<string, unknown>;
    legacy.schemaVersion = 2;
    for (const row of legacy.entries as Record<string, unknown>[]) delete row.lowestNative;

    const h = harness({
      respond: () => {
        throw new Error('offline');
      },
      files: {
        [CACHE_PATH]: JSON.stringify({
          etag: 'v1',
          adoptedUtc: '2026-08-29T00:00:00.000Z',
          snapshot: legacy,
        }),
      },
    });

    h.service.start();

    expect(() => resolveKey('k1', h.service.getView().snapshot, 'BRL')).not.toThrow();
  });

  it('prices from the cache on a cold start with no network at all', () => {
    const cached = JSON.stringify({
      etag: 'v1',
      adoptedUtc: '2026-08-28T00:00:00.000Z',
      snapshot: snapshotWith([entry(GLOVES, 'k1', 25, '2026-08-28T00:00:00.000Z')]),
    });
    const h = harness({
      respond: () => {
        throw new Error('offline');
      },
      files: { [CACHE_PATH]: cached },
    });

    h.service.start();
    h.service.stop();

    expect(h.service.getView().source).toBe('cache');
    expect(priceOf(h.service.getView())).toBe(25);
  });

  it('starts clean when the cache file is corrupt, rather than failing to start', async () => {
    const h = harness({
      respond: () => ok(snapshotWith([entry(GLOVES, 'k1', 25, null)]), 'v1'),
      files: { [CACHE_PATH]: '{ not json' },
    });

    h.service.start();
    await h.service.refreshSnapshot();
    h.service.stop();

    expect(h.requests[0]?.etag).toBeNull();
    expect(priceOf(h.service.getView())).toBe(25);
  });

  it('sends the cached validator, and a 304 leaves the cached snapshot and the cache file untouched', async () => {
    const cachedSnapshot = snapshotWith([entry(GLOVES, 'k1', 25, '2026-08-28T00:00:00.000Z')]);
    const cached = JSON.stringify({ etag: 'v1', adoptedUtc: '2026-08-28T00:00:00.000Z', snapshot: cachedSnapshot });
    const h = harness({
      respond: () => ({ status: 304, etag: 'v1', body: '' }),
      files: { [CACHE_PATH]: cached },
    });

    h.service.start();
    const before = h.service.getView();
    await h.service.refreshSnapshot();
    await h.service.refreshSnapshot();
    h.service.stop();

    expect(h.requests.map((request) => request.etag)).toEqual(['v1', 'v1', 'v1']);
    expect(h.files.get(CACHE_PATH)).toBe(cached);
    expect(h.service.getView().snapshot).toBe(before.snapshot);
    expect(priceOf(h.service.getView())).toBe(25);
    // An unchanged snapshot is a successful check, not a failed one.
    expect(h.service.getView().lastError).toBeNull();
    expect(h.service.getView().source).toBe('cache');
    // One push, from the cache load. A check that changed nothing announces nothing.
    expect(h.pushes).toHaveLength(1);
  });

  it('keeps the last good snapshot across repeated network failures, and adopts again once they stop', async () => {
    const good = snapshotWith([entry(GLOVES, 'k1', 25, '2026-08-28T00:00:00.000Z')]);
    const later = snapshotWith([entry(GLOVES, 'k1', 30, '2026-08-29T06:00:00.000Z')], '2026-08-29T06:00:00.000Z');
    let mode: 'good' | 'fail' | 'later' = 'good';
    const h = harness({
      respond: () => {
        if (mode === 'fail') throw new Error('ECONNRESET');
        return ok(mode === 'good' ? good : later, 'v1');
      },
    });

    await h.service.refreshSnapshot();
    mode = 'fail';
    await h.service.refreshSnapshot();
    await h.service.refreshSnapshot();

    expect(priceOf(h.service.getView())).toBe(25);
    expect(h.service.getView().lastError).toBe('network');
    expect(h.service.getView().publishedUtc).toBe('2026-08-29T00:00:00.000Z');
    expect(h.pushes).toHaveLength(1);

    mode = 'later';
    await h.service.refreshSnapshot();

    expect(priceOf(h.service.getView())).toBe(30);
    expect(h.service.getView().lastError).toBeNull();
    expect(h.pushes).toHaveLength(2);
  });

  it('keeps the last good snapshot when the published file is not a snapshot at all', async () => {
    const good = snapshotWith([entry(GLOVES, 'k1', 25, '2026-08-28T00:00:00.000Z')]);
    let body: unknown = good;
    const h = harness({ respond: () => ok(body, 'v1') });

    await h.service.refreshSnapshot();
    body = { schemaVersion: 99, entries: 'not-an-array' };
    await h.service.refreshSnapshot();

    expect(priceOf(h.service.getView())).toBe(25);
    expect(h.service.getView().lastError).toBe('malformed');
  });
});

describe('per-item refresh', () => {
  const seeded = () => snapshotWith([entry(GLOVES, 'k1', 25, '2026-08-28T00:00:00.000Z')]);

  it('merges a fresh quote into the snapshot and announces it', async () => {
    const h = harness({
      respond: (_request, callIndex) =>
        callIndex === 0 ? ok(seeded(), 'v1') : ok({ success: true, lowest_price: 'R$ 31,50' }),
    });

    await h.service.refreshSnapshot();
    const result = await h.service.refreshItem({ kind: 'key', key: 'k1' });

    expect(result).toMatchObject({ ok: true, hashName: GLOVES, currency: 'BRL', amount: 31.5 });
    expect(priceOf(h.service.getView())).toBe(31.5);
    expect(h.pushes).toHaveLength(2);
  });

  it('a declined quote never overwrites the price the snapshot already carries', async () => {
    let quoted = false;
    const h = harness({
      respond: (_request, callIndex) => {
        if (callIndex === 0) return ok(seeded(), 'v1');
        if (!quoted) {
          quoted = true;
          return ok({ success: true, lowest_price: 'R$ 30,00' });
        }
        // Measured: this endpoint answers `{"success":true}` with no price for an item that has
        // a live listing. That is Steam declining to quote, not the item being unlisted.
        return ok({ success: true });
      },
    });

    await h.service.refreshSnapshot();
    await h.service.refreshItem({ kind: 'key', key: 'k1' });
    const pushesAfterQuote = h.pushes.length;
    const declined = await h.service.refreshItem({ kind: 'key', key: 'k1' });

    expect(declined).toMatchObject({ ok: false, reason: 'not-quoted', keptAmount: 30 });
    expect(priceOf(h.service.getView())).toBe(30);
    expect(h.service.getView().snapshot?.entries[0]?.nativeQuotedUtc).toBe('2026-08-29T12:00:00.000Z');
    expect(h.pushes).toHaveLength(pushesAfterQuote);
  });

  it('a transport failure leaves the standing price alone and reports network', async () => {
    const h = harness({
      respond: (_request, callIndex) => {
        if (callIndex === 0) return ok(seeded(), 'v1');
        throw new Error('ETIMEDOUT');
      },
    });

    await h.service.refreshSnapshot();
    const result = await h.service.refreshItem({ kind: 'key', key: 'k1' });

    expect(result).toMatchObject({ ok: false, reason: 'network', keptAmount: 25 });
    expect(priceOf(h.service.getView())).toBe(25);
  });

  it('reports unknown-item for a key the snapshot does not carry, without calling out', async () => {
    const h = harness({ respond: () => ok(seeded(), 'v1') });

    await h.service.refreshSnapshot();
    const result = await h.service.refreshItem({ kind: 'key', key: 'absent' });

    expect(result).toMatchObject({ ok: false, reason: 'unknown-item', keptAmount: null });
    expect(h.requests).toHaveLength(1);
  });

  it('quotes by hash name when the caller has no key', async () => {
    const h = harness({
      respond: (_request, callIndex) =>
        callIndex === 0 ? ok(seeded(), 'v1') : ok({ success: true, lowest_price: 'R$ 12,00' }),
    });

    await h.service.refreshSnapshot();
    const result = await h.service.refreshItem({ kind: 'hashName', hashName: GLOVES });

    expect(result).toMatchObject({ ok: true, key: 'k1', amount: 12 });
    expect(priceOf(h.service.getView())).toBe(12);
  });
});

describe('per-item refresh pacing', () => {
  const twoItems = () =>
    snapshotWith([entry(GLOVES, 'k1', 25, null), entry('Gold Ring (Rare)', 'k2', 9, null)]);

  it('spaces sequential quotes rather than firing them together', async () => {
    const h = harness({
      respond: (_request, callIndex) =>
        callIndex === 0 ? ok(twoItems(), 'v1') : ok({ success: true, lowest_price: 'R$ 1,00' }),
      overrides: { quoteSpacingMs: 3_500 },
    });

    await h.service.refreshSnapshot();
    await Promise.all([
      h.service.refreshItem({ kind: 'key', key: 'k1' }),
      h.service.refreshItem({ kind: 'key', key: 'k2' }),
      h.service.refreshItem({ kind: 'key', key: 'k1' }),
    ]);

    expect(h.requests).toHaveLength(4);
    expect(h.sleeps).toEqual([3_500, 3_500]);
  });

  it('backs off exponentially while 429s continue, and drops the backoff once one succeeds', async () => {
    let rateLimited = true;
    const h = harness({
      respond: (_request, callIndex) => {
        if (callIndex === 0) return ok(twoItems(), 'v1');
        if (rateLimited) return { status: 429, etag: null, body: '' };
        return ok({ success: true, lowest_price: 'R$ 4,00' });
      },
      overrides: { quoteSpacingMs: 1_000, quoteBackoffMs: 30_000, maxQuoteBackoffMs: 240_000 },
    });

    await h.service.refreshSnapshot();

    const first = await h.service.refreshItem({ kind: 'key', key: 'k1' });
    const second = await h.service.refreshItem({ kind: 'key', key: 'k1' });
    const third = await h.service.refreshItem({ kind: 'key', key: 'k1' });
    const fourth = await h.service.refreshItem({ kind: 'key', key: 'k1' });

    for (const result of [first, second, third, fourth]) {
      expect(result).toMatchObject({ ok: false, reason: 'rate-limited', keptAmount: 25 });
    }
    // The first quote pays nothing; each 429 doubles what the next one waits.
    expect(h.sleeps).toEqual([30_000, 60_000, 120_000]);

    rateLimited = false;
    await h.service.refreshItem({ kind: 'key', key: 'k1' });
    const afterRecovery = h.sleeps.length;
    h.advance(60_000);
    const recovered = await h.service.refreshItem({ kind: 'key', key: 'k1' });

    expect(recovered).toMatchObject({ ok: true, amount: 4 });
    expect(h.sleeps).toHaveLength(afterRecovery);
    expect(priceOf(h.service.getView())).toBe(4);
  });

  it('caps the backoff rather than growing it without bound', async () => {
    const h = harness({
      respond: (_request, callIndex) => (callIndex === 0 ? ok(twoItems(), 'v1') : { status: 429, etag: null, body: '' }),
      overrides: { quoteSpacingMs: 0, quoteBackoffMs: 10_000, maxQuoteBackoffMs: 20_000 },
    });

    await h.service.refreshSnapshot();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await h.service.refreshItem({ kind: 'key', key: 'k1' });
    }

    expect(h.sleeps).toEqual([10_000, 20_000, 20_000, 20_000]);
  });
});

describe('periodic snapshot refresh', () => {
  it('re-checks on its own schedule after start, and stops when the service stops', async () => {
    const timers: { callback: () => void; delay: number }[] = [];
    const h = harness({
      respond: () => ok(snapshotWith([entry(GLOVES, 'k1', 25, null)]), 'v1'),
      overrides: {
        snapshotRefreshMs: 900_000,
        scheduler: {
          setTimeout: ((callback: () => void, delay: number) => {
            timers.push({ callback, delay });
            return timers.length;
          }) as unknown as typeof setTimeout,
          clearTimeout: () => undefined,
        },
      },
    });

    h.service.start();
    await Promise.resolve();
    await Promise.resolve();

    expect(h.requests).toHaveLength(1);
    expect(timers[0]?.delay).toBe(900_000);

    timers[0]?.callback();
    await Promise.resolve();
    await Promise.resolve();
    expect(h.requests).toHaveLength(2);

    h.service.stop();
    timers[1]?.callback();
    await Promise.resolve();
    await Promise.resolve();
    expect(timers).toHaveLength(2);
  });
});
