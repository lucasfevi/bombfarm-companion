import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.hoisted(() => vi.fn());
vi.mock('electron', () => ({ net: { fetch: fetchMock } }));

import {
  PREMIUM_API_ORIGIN,
  PREMIUM_API_PATHS,
  createPremiumHttp,
  type PremiumHttpRequest,
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

const http = createPremiumHttp(PREMIUM_API_ORIGIN);

describe('the licence paths', () => {
  it('names the four licence routes exactly', () => {
    expect(PREMIUM_API_PATHS.licence).toBe('/v1/premium/licence');
    expect(PREMIUM_API_PATHS.licenceActivate).toBe('/v1/premium/licence/activate');
    expect(PREMIUM_API_PATHS.lease).toBe('/v1/premium/lease');
    expect(PREMIUM_API_PATHS.licenceCleanup).toBe('/v1/premium/licence/cleanup');
  });

  it.each([
    ['licence', 'GET', '/v1/premium/licence'],
    ['licenceActivate', 'POST', '/v1/premium/licence/activate'],
    ['lease', 'POST', '/v1/premium/lease'],
    ['licenceCleanup', 'POST', '/v1/premium/licence/cleanup'],
  ] as const)('sends %s as %s to %s', async (path, method, url) => {
    answer(200, '{}');
    await http({ path, method, token: 't' });
    expect(lastCall().url).toBe(PREMIUM_API_ORIGIN + url);
    expect(lastCall().init.method).toBe(method);
  });
});

describe('a pre-serialised body', () => {
  const raw = '{ "fingerprint" : "ab",  "removed":true }';

  it('is sent byte for byte, never serialised a second time', async () => {
    answer(200, '{}');
    await http({ path: 'licenceCleanup', method: 'POST', token: 't', rawBody: raw });
    expect(lastCall().init.body).toBe(raw);
    expect(lastCall().init.headers['content-type']).toBe('application/json');
  });

  it('wins over a body object when both are given', async () => {
    answer(200, '{}');
    await http({ path: 'lease', method: 'POST', token: 't', body: { a: 1 }, rawBody: raw });
    expect(lastCall().init.body).toBe(raw);
  });

  it('leaves the existing object body serialised as before', async () => {
    answer(200, '{}');
    await http({ path: 'token', method: 'POST', body: { code: 'c' } });
    expect(lastCall().init.body).toBe('{"code":"c"}');
  });

  it('sends no body and no content type for a GET', async () => {
    answer(200, '{}');
    await http({ path: 'licence', method: 'GET', token: 't' });
    expect(lastCall().init.body).toBeUndefined();
    expect(Object.keys(lastCall().init.headers)).not.toContain('content-type');
  });
});

describe('the extra headers', () => {
  it('sends the device signature as BFC-Device beside the bearer token', async () => {
    answer(200, '{}');
    await http({
      path: 'lease',
      method: 'POST',
      token: 'tok',
      rawBody: '{}',
      headers: { 'BFC-Device': 'key.1700000000.sig' },
    });
    const { headers } = lastCall().init;
    expect(headers['BFC-Device']).toBe('key.1700000000.sig');
    expect(headers['authorization']).toBe('Bearer tok');
    expect(headers['accept']).toBe('application/json');
  });

  it('lets a caller state the content type', async () => {
    answer(200, '{}');
    await http({ path: 'lease', method: 'POST', token: 't', rawBody: '{}', headers: { 'content-type': 'application/json' } });
    expect(lastCall().init.headers['content-type']).toBe('application/json');
  });

  it('refuses any other header by type', () => {
    // @ts-expect-error an authorization header is not one of the two allowed
    const withAuth: PremiumHttpRequest = { path: 'lease', method: 'POST', headers: { authorization: 'Bearer x' } };
    // @ts-expect-error a custom header is not one of the two allowed
    const withCustom: PremiumHttpRequest = { path: 'lease', method: 'POST', headers: { 'x-trace': '1' } };
    expect([withAuth, withCustom]).toHaveLength(2);
  });

  it.each(['authorization', 'Authorization', 'x-trace', 'cookie', 'accept', 'host'])(
    'refuses %s at run time, before anything is sent',
    async (name) => {
      const req = { path: 'lease', method: 'POST', token: 't', headers: { [name]: 'x' } } as unknown as PremiumHttpRequest;
      await expect(http(req)).rejects.toThrow('premium_header_not_allowed');
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );
});

describe('the response clock', () => {
  it('reads dateMs from a real Date header', async () => {
    answer(200, '{}', { date: 'Wed, 21 Oct 2026 07:28:00 GMT' });
    const response = await http({ path: 'lease', method: 'POST', token: 't', rawBody: '{}' });
    expect(response.dateMs).toBe(Date.UTC(2026, 9, 21, 7, 28, 0));
  });

  it('carries it on a refusal too', async () => {
    answer(401, '{"reason":"device_signature"}', { date: 'Wed, 21 Oct 2026 07:28:00 GMT' });
    const response = await http({ path: 'lease', method: 'POST', token: 't', rawBody: '{}' });
    expect(response.status).toBe(401);
    expect(response.dateMs).toBe(Date.UTC(2026, 9, 21, 7, 28, 0));
  });

  it('has none when the header is missing', async () => {
    answer(200, '{}');
    const response = await http({ path: 'lease', method: 'POST', token: 't', rawBody: '{}' });
    expect(response.dateMs).toBeUndefined();
    expect('dateMs' in response).toBe(false);
  });

  it.each(['soon', '', '2026-13-45'])('has none when the header is %j (not a date)', async (value) => {
    answer(200, '{}', { date: value });
    const response = await http({ path: 'lease', method: 'POST', token: 't', rawBody: '{}' });
    expect(response.dateMs).toBeUndefined();
  });
});
