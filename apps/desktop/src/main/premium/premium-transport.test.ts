import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.hoisted(() => vi.fn());
vi.mock('electron', () => ({ net: { fetch: fetchMock } }));

import { PREMIUM_API_ORIGIN, PREMIUM_API_PATHS, createPremiumHttp, type PremiumPath } from './premium-transport.js';

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
