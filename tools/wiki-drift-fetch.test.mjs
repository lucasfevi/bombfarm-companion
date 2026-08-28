import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { DATA_URL, FASES_NOMES_URL, fetchEndpoints } from './wiki-drift/fetch-endpoints.mjs';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)));
const MODULE_PATH = join(root, 'wiki-drift/fetch-endpoints.mjs');
const FIXTURES = join(root, 'wiki-drift/__fixtures__');

const apiDataCapture = JSON.parse(readFileSync(join(FIXTURES, 'api-data.captured.json'), 'utf8'));
const fasesNomesCapture = JSON.parse(
  readFileSync(join(FIXTURES, 'fases-nomes.captured.json'), 'utf8'),
);

function jsonResponse(body) {
  return { ok: true, status: 200, json: async () => body };
}

function textAsJsonResponse(text) {
  // Mirrors real fetch: `.json()` parses the body and throws on non-JSON text (an HTML page).
  return {
    ok: true,
    status: 200,
    json: async () => JSON.parse(text),
  };
}

function statusResponse(status) {
  return { ok: false, status, json: async () => ({}) };
}

function noopSleep() {
  return vi.fn(async () => {});
}

describe('fetch-endpoints.mjs — module shape', () => {
  const source = readFileSync(MODULE_PATH, 'utf8');

  it('declares exactly the two wiki endpoint URLs as module constants, no other absolute URL', () => {
    const urls = source.match(/https?:\/\/[^'"`\s]+/g) ?? [];
    expect(urls).toEqual([DATA_URL, FASES_NOMES_URL]);
  });

  it('the two constants are exactly /wiki/api/data and /wiki/api/fases-nomes', () => {
    expect(DATA_URL).toBe('https://wiki.bombfarm.net/wiki/api/data');
    expect(FASES_NOMES_URL).toBe('https://wiki.bombfarm.net/wiki/api/fases-nomes');
  });

  it('no path in this module can return a drift verdict (source scan for the token "drift")', () => {
    expect(/\bdrift\b/i.test(source)).toBe(false);
  });
});

describe('fetchEndpoints — the green direction', () => {
  it('a 200 with each frozen capture as the body ⇒ { ok: true } with both payloads', async () => {
    const fetchImpl = vi.fn(async (url) => {
      if (url === DATA_URL) return jsonResponse(apiDataCapture);
      if (url === FASES_NOMES_URL) return jsonResponse(fasesNomesCapture);
      throw new Error(`unexpected url ${url}`);
    });
    const result = await fetchEndpoints({ fetchImpl, sleep: noopSleep() });
    expect(result).toEqual({
      ok: true,
      payloads: { data: apiDataCapture, fasesNomes: fasesNomesCapture },
    });
  });

  it('requests carry redirect: follow, an AbortSignal, and no other options (no headers, no credentials)', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(apiDataCapture));
    await fetchEndpoints({ fetchImpl, sleep: noopSleep() });
    const [, options] = fetchImpl.mock.calls[0];
    expect(Object.keys(options).sort()).toEqual(['redirect', 'signal']);
    expect(options.redirect).toBe('follow');
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });
});

describe('fetchEndpoints — eight failure shapes, each unreachable with a distinct reason', () => {
  const cases = [
    { name: '500', handler: async () => statusResponse(500), reason: 'http-500' },
    { name: '404', handler: async () => statusResponse(404), reason: 'http-404' },
    {
      name: 'a thrown network error',
      handler: async () => {
        throw new TypeError('fetch failed');
      },
      reason: 'network-error',
    },
    {
      name: 'an abort/timeout',
      handler: async () => {
        const err = new Error('The operation was aborted');
        err.name = 'TimeoutError';
        throw err;
      },
      reason: 'timeout',
    },
    {
      name: 'a 200 whose body is HTML',
      handler: async () => textAsJsonResponse('<!doctype html><html>waf</html>'),
      reason: 'invalid-json',
    },
    {
      name: 'a 200 whose body is a JSON array',
      handler: async () => jsonResponse([1, 2, 3]),
      reason: 'unexpected-top-level-type',
    },
    {
      name: 'a 200 whose body is a JSON string',
      handler: async () => jsonResponse('just a string'),
      reason: 'unexpected-top-level-type',
    },
    {
      name: 'a 200 whose body is null',
      handler: async () => jsonResponse(null),
      reason: 'unexpected-top-level-type',
    },
  ];

  for (const { name, handler, reason } of cases) {
    it(`${name} ⇒ unreachable (${reason}), never drift`, async () => {
      const fetchImpl = vi.fn(handler);
      const result = await fetchEndpoints({ fetchImpl, sleep: noopSleep(), attempts: 1 });
      expect(result).toEqual({ ok: false, reason, url: DATA_URL, attempts: 1 });
    });
  }
});

describe('fetchEndpoints — retry is bounded and counted', () => {
  it('every attempt fails ⇒ exactly 3 calls to the injected fetch, then unreachable', async () => {
    const fetchImpl = vi.fn(async () => statusResponse(500));
    const sleep = noopSleep();
    const result = await fetchEndpoints({ fetchImpl, sleep });
    expect(result.ok).toBe(false);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('the first attempt succeeds ⇒ exactly 1 call, ok', async () => {
    const fetchImpl = vi.fn(async (url) => {
      if (url === DATA_URL) return jsonResponse(apiDataCapture);
      return jsonResponse(fasesNomesCapture);
    });
    const sleep = noopSleep();
    const result = await fetchEndpoints({ fetchImpl, sleep });
    expect(result.ok).toBe(true);
    // Two endpoints, one call each when both succeed on the first try.
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('a transient failure then a success ⇒ exactly 2 calls for that endpoint, and ok', async () => {
    let dataCalls = 0;
    const fetchImpl = vi.fn(async (url) => {
      if (url === DATA_URL) {
        dataCalls += 1;
        if (dataCalls === 1) return statusResponse(500);
        return jsonResponse(apiDataCapture);
      }
      return jsonResponse(fasesNomesCapture);
    });
    const sleep = noopSleep();
    const result = await fetchEndpoints({ fetchImpl, sleep });
    expect(result.ok).toBe(true);
    expect(dataCalls).toBe(2);
  });

  it('backoff delays are [1000, 4000], in that order, never unbounded', async () => {
    const fetchImpl = vi.fn(async () => statusResponse(500));
    const sleep = vi.fn(async () => {});
    await fetchEndpoints({ fetchImpl, sleep });
    expect(sleep.mock.calls.map((call) => call[0])).toEqual([1000, 4000]);
  });
});
