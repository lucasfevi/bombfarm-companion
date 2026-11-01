import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.hoisted(() => vi.fn());
vi.mock('electron', () => ({ net: { fetch: fetchMock } }));

import {
  BytesTooLargeError,
  PREMIUM_API_ORIGIN,
  PREMIUM_API_PATHS,
  bundleRoutePath,
  createPremiumHttp,
  fetchBytes,
  type BundleRoute,
  type PremiumPath,
} from './premium-transport.js';

function answer(status: number, body = '', headers: Record<string, string> = {}): void {
  fetchMock.mockResolvedValueOnce(new Response(body, { status, headers }));
}

function lastCall(): { url: string; init: RequestInit & { headers: Record<string, string> } } {
  const call = fetchMock.mock.calls.at(-1) as [string, RequestInit & { headers: Record<string, string> }];
  return { url: call[0], init: call[1] };
}

beforeEach(() => {
  fetchMock.mockReset();
});

describe('createPremiumHttp', () => {
  it('builds the URL from the origin and the path key', async () => {
    const http = createPremiumHttp(PREMIUM_API_ORIGIN);
    for (const path of Object.keys(PREMIUM_API_PATHS) as PremiumPath[]) {
      answer(200, '{}');
      await http({ path, method: 'GET' });
      expect(lastCall().url).toBe(PREMIUM_API_ORIGIN + PREMIUM_API_PATHS[path]);
    }
  });

  it('uses the origin it was given', async () => {
    answer(200, '{}');
    await createPremiumHttp('http://127.0.0.1:4010')({ path: 'status', method: 'GET' });
    expect(lastCall().url).toBe('http://127.0.0.1:4010/v1/premium/status');
  });

  it('sends the authorization header only when a token is given', async () => {
    const http = createPremiumHttp(PREMIUM_API_ORIGIN);
    answer(200, '{}');
    await http({ path: 'me', method: 'GET', token: 'tok-1' });
    expect(lastCall().init.headers['authorization']).toBe('Bearer tok-1');

    answer(200, '{}');
    await http({ path: 'visibility', method: 'GET' });
    expect(Object.keys(lastCall().init.headers)).not.toContain('authorization');
  });

  it('sends content-type and a JSON body only when a body is given', async () => {
    const http = createPremiumHttp(PREMIUM_API_ORIGIN);
    answer(201, '{}');
    await http({ path: 'token', method: 'POST', body: { code: 'c' } });
    const withBody = lastCall().init;
    expect(withBody.headers['content-type']).toBe('application/json');
    expect(withBody.body).toBe('{"code":"c"}');
    expect(withBody.method).toBe('POST');

    answer(200, '{}');
    await http({ path: 'rotate', method: 'POST', token: 't' });
    const withoutBody = lastCall().init;
    expect(Object.keys(withoutBody.headers)).not.toContain('content-type');
    expect(withoutBody.body).toBeUndefined();
  });

  it('always asks for JSON, refuses redirects and carries a timeout signal', async () => {
    answer(200, '{}');
    await createPremiumHttp(PREMIUM_API_ORIGIN)({ path: 'status', method: 'GET', token: 't' });
    const { init } = lastCall();
    expect(init.headers['accept']).toBe('application/json');
    expect(init.redirect).toBe('error');
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('gives every request a ten second timeout', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    try {
      answer(200, '{}');
      await createPremiumHttp(PREMIUM_API_ORIGIN)({ path: 'status', method: 'GET', token: 't' });
      expect(timeout).toHaveBeenCalledTimes(1);
      expect(timeout).toHaveBeenCalledWith(10_000);
      expect(lastCall().init.signal).toBe(timeout.mock.results[0]?.value);
    } finally {
      timeout.mockRestore();
    }
  });

  it('returns the status and the text body, including for a refusal', async () => {
    answer(409, '{"reason":"steam_mismatch"}');
    const response = await createPremiumHttp(PREMIUM_API_ORIGIN)({ path: 'report', method: 'POST', token: 't', body: {} });
    expect(response).toEqual({ status: 409, body: '{"reason":"steam_mismatch"}', retryAfterSec: null });
  });

  it.each([
    ['120', 120],
    [' 7 ', 7],
    ['0', 0],
    ['Wed, 21 Oct 2026 07:28:00 GMT', null],
    ['1.5', null],
    ['-3', null],
    ['soon', null],
  ])('reads Retry-After %j as %s', async (header, expected) => {
    answer(429, '', { 'retry-after': header });
    const response = await createPremiumHttp(PREMIUM_API_ORIGIN)({ path: 'status', method: 'GET', token: 't' });
    expect(response.retryAfterSec).toBe(expected);
  });

  it('reports no Retry-After when the header is absent', async () => {
    answer(429);
    const response = await createPremiumHttp(PREMIUM_API_ORIGIN)({ path: 'status', method: 'GET', token: 't' });
    expect(response.retryAfterSec).toBeNull();
  });

  it('lets a network failure reject', async () => {
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    await expect(createPremiumHttp(PREMIUM_API_ORIGIN)({ path: 'status', method: 'GET' })).rejects.toThrow('offline');
  });
});

const BUNDLE_QUERY = { hostApi: '1.0.0', appVersion: '0.33.0', flavor: 'dev' } as const;
const MANIFEST_ROUTE: BundleRoute = { r: 'bundle', query: BUNDLE_QUERY };
const FILE_ROUTE: BundleRoute = { r: 'file', sequence: 7, path: 'ui/index.js' };

function bytesReq(route: BundleRoute, maxBytes = 1024, signal: AbortSignal = new AbortController().signal) {
  return { route, token: 'tok-9', device: 'devkey01.1700000000.sigsig', maxBytes, signal };
}

describe('bundleRoutePath', () => {
  it('builds the manifest path without the query', () => {
    expect(bundleRoutePath(MANIFEST_ROUTE)).toBe('/v1/premium/bundle');
  });

  it('builds a file path with the sequence and the path unencoded', () => {
    expect(bundleRoutePath(FILE_ROUTE)).toBe('/v1/premium/bundle/7/files/ui/index.js');
    expect(bundleRoutePath({ r: 'file', sequence: 12, path: 'worker/a-b_c.1/index.cjs' })).toBe(
      '/v1/premium/bundle/12/files/worker/a-b_c.1/index.cjs',
    );
  });

  it('refuses a path or a sequence that would not route as signed', () => {
    for (const path of ['../x', 'a b', 'a%2Fb', '/abs', 'a\b', '']) {
      expect(() => bundleRoutePath({ r: 'file', sequence: 1, path })).toThrow('premium_bundle_route_invalid');
    }
    for (const sequence of [0, -1, 1.5, Number.NaN]) {
      expect(() => bundleRoutePath({ r: 'file', sequence, path: 'ui/index.js' })).toThrow('premium_bundle_route_invalid');
    }
  });
});

describe('fetchBytes', () => {
  it('sends the query for the manifest route and none for a file route', async () => {
    answer(200, 'x');
    await fetchBytes(PREMIUM_API_ORIGIN, bytesReq(MANIFEST_ROUTE));
    expect(lastCall().url).toBe(`${PREMIUM_API_ORIGIN}/v1/premium/bundle?hostApi=1.0.0&appVersion=0.33.0&flavor=dev`);
    answer(200, 'x');
    await fetchBytes(PREMIUM_API_ORIGIN, bytesReq(FILE_ROUTE));
    expect(lastCall().url).toBe(`${PREMIUM_API_ORIGIN}/v1/premium/bundle/7/files/ui/index.js`);
  });

  it('is a GET with no HTTP cache, no redirects, a bearer and the device header only', async () => {
    answer(200, 'x');
    await fetchBytes(PREMIUM_API_ORIGIN, bytesReq(FILE_ROUTE));
    const { init } = lastCall();
    expect(init.method).toBe('GET');
    expect((init as { cache?: string }).cache).toBe('no-store');
    expect(init.redirect).toBe('error');
    expect(init.body).toBeUndefined();
    expect(Object.keys(init.headers).sort()).toEqual(['BFC-Device', 'accept', 'authorization']);
    expect(init.headers['authorization']).toBe('Bearer tok-9');
    expect(init.headers['BFC-Device']).toBe('devkey01.1700000000.sigsig');
  });

  it('returns the exact bytes, including bytes that are not valid text', async () => {
    const raw = new Uint8Array([0xff, 0xfe, 0x00, 0xc3, 0x28, 0x80, 0x0a, 0x7f]);
    fetchMock.mockResolvedValueOnce(new Response(raw, { status: 200 }));
    const result = await fetchBytes(PREMIUM_API_ORIGIN, bytesReq(FILE_ROUTE));
    expect(Array.from(result.bytes)).toEqual(Array.from(raw));
  });

  it('reads an empty body as no bytes', async () => {
    answer(404);
    const result = await fetchBytes(PREMIUM_API_ORIGIN, bytesReq(FILE_ROUTE));
    expect(result.status).toBe(404);
    expect(result.bytes.byteLength).toBe(0);
  });

  it('passes the status, Retry-After and the server date through', async () => {
    answer(429, 'slow', { 'retry-after': '30', date: 'Wed, 21 Oct 2026 07:28:00 GMT' });
    const result = await fetchBytes(PREMIUM_API_ORIGIN, bytesReq(FILE_ROUTE));
    expect(result).toMatchObject({ status: 429, retryAfterSec: 30, dateMs: Date.parse('Wed, 21 Oct 2026 07:28:00 GMT') });
  });

  it('accepts a body of exactly maxBytes', async () => {
    answer(200, 'abcd');
    const result = await fetchBytes(PREMIUM_API_ORIGIN, bytesReq(FILE_ROUTE, 4));
    expect(result.bytes.byteLength).toBe(4);
  });

  it('aborts before reading when Content-Length is above maxBytes', async () => {
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({
      pull() {
        throw new Error('the body must not be read');
      },
      cancel,
    });
    fetchMock.mockResolvedValueOnce(new Response(body, { status: 200, headers: { 'content-length': '5' } }));
    await expect(fetchBytes(PREMIUM_API_ORIGIN, bytesReq(FILE_ROUTE, 4))).rejects.toBeInstanceOf(BytesTooLargeError);
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('aborts mid-stream when the body runs one byte over', async () => {
    const cancel = vi.fn();
    let sent = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        sent += 1;
        controller.enqueue(new Uint8Array(2));
      },
      cancel,
    });
    fetchMock.mockResolvedValueOnce(new Response(body, { status: 200 }));
    await expect(fetchBytes(PREMIUM_API_ORIGIN, bytesReq(FILE_ROUTE, 5))).rejects.toBeInstanceOf(BytesTooLargeError);
    expect(cancel).toHaveBeenCalledTimes(1);
    // 2 + 2 + 2 = 6 > 5: the third chunk crosses the line, and nothing more is pulled.
    expect(sent).toBeLessThanOrEqual(4);
  });

  it('gives a manifest request ten seconds and a file thirty, and honours the caller abort', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    try {
      answer(200, 'x');
      await fetchBytes(PREMIUM_API_ORIGIN, bytesReq(MANIFEST_ROUTE));
      answer(200, 'x');
      await fetchBytes(PREMIUM_API_ORIGIN, bytesReq(FILE_ROUTE));
      expect(timeout.mock.calls.map(([ms]) => ms)).toEqual([10_000, 30_000]);
      const caller = new AbortController();
      answer(200, 'x');
      await fetchBytes(PREMIUM_API_ORIGIN, bytesReq(FILE_ROUTE, 1024, caller.signal));
      const sent = lastCall().init.signal;
      expect(sent?.aborted).toBe(false);
      caller.abort();
      expect(sent?.aborted).toBe(true);
    } finally {
      timeout.mockRestore();
    }
  });
});
