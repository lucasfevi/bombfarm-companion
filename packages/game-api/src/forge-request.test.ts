import { describe, expect, it, vi } from 'vitest';
import {
  FORGE_ROUTES,
  buildForgeRequest,
  createRequestIdSource,
  isTrustedWriteRequest,
  requestPost,
  sendPost,
  type HttpWriteRequest,
} from './forge-request.js';
import { RAW, SessionToken, grantSession } from './session.js';
import type { HttpResponse, HttpTransport } from './request.js';
import { grantedConsent } from './test-fixtures.js';
import { WriteSessionRequiredError, grantWriteSession, type WriteSession } from './write-session.js';

const SENTINEL_TOKEN = 'sentinel-9b2d4e61-do-not-leak';
const consented = grantSession(grantedConsent('2026-09-03T12:00:00.000Z'), {
  accountId: '486',
  token: SessionToken.create(SENTINEL_TOKEN),
});
const write = grantWriteSession(consented, { forgeWritesEnabled: true });

function forgeWriteSession(): WriteSession {
  return { session: consented } as unknown as WriteSession;
}

function fakeTransport(response: HttpResponse): HttpTransport & ReturnType<typeof vi.fn> {
  return vi.fn().mockResolvedValue(response) as HttpTransport & ReturnType<typeof vi.fn>;
}

describe('buildForgeRequest/requestPost — reject a write session forged through an unsafe cast', () => {
  it('buildForgeRequest throws WriteSessionRequiredError for a forged session, before building any header', () => {
    expect(() => buildForgeRequest(forgeWriteSession(), FORGE_ROUTES.forge, 'item-1', 'c1-1-1')).toThrow(
      WriteSessionRequiredError,
    );
  });

  it('requestPost throws WriteSessionRequiredError for a forged session — zero transport calls', async () => {
    const transport = vi.fn();
    await expect(requestPost(forgeWriteSession(), transport, FORGE_ROUTES.forge, 'item-1', 'c1-1-1')).rejects.toThrow(
      WriteSessionRequiredError,
    );
    expect(transport).not.toHaveBeenCalled();
  });

  it('a real session minted by grantWriteSession is accepted (sanity — the check above is not vacuous)', () => {
    expect(() => buildForgeRequest(write, FORGE_ROUTES.forge, 'item-1', 'c1-1-1')).not.toThrow();
  });
});

describe('buildForgeRequest — the request shape', () => {
  it('targets the trusted host with POST, the route plus the item id as its query, and no body', () => {
    const req = buildForgeRequest(write, FORGE_ROUTES.forgeToSafe, 'item 7/ä', 'c1-1-1');
    expect(req.host).toBe('app.bombfarm.net');
    expect(req.method).toBe('POST');
    expect(req.path).toBe('/item/forge_to_safe?account_id=486&item=item%207%2F%C3%A4&request_id=c1-1-1');
    expect(req.headers['Content-Length']).toBe('0');
    expect(req.timeoutMs).toBe(15_000);
    expect('body' in req).toBe(false);
  });

  it('carries the same authorization headers as the read path, and the raw token appears in Authorization only', () => {
    const req = buildForgeRequest(write, FORGE_ROUTES.forge, 'item-1', 'c1-1-1');
    const rawToken = consented.token[RAW]();
    expect(req.headers).toEqual({
      Authorization: `Bearer ${rawToken}`,
      Accept: 'application/json',
      Host: 'app.bombfarm.net',
      Connection: 'close',
      'Content-Length': '0',
    });
    expect(req.path).not.toContain(rawToken);
    for (const [key, value] of Object.entries(req.headers)) {
      if (key !== 'Authorization') expect(value).not.toContain(rawToken);
    }
  });

  it('honours a caller-supplied timeout and abort signal', () => {
    const controller = new AbortController();
    const req = buildForgeRequest(write, FORGE_ROUTES.forge, 'item-1', 'c1-1-1', { timeoutMs: 3_000, signal: controller.signal });
    expect(req.timeoutMs).toBe(3_000);
    expect(req.signal).toBe(controller.signal);
  });
});

describe('isTrustedWriteRequest / sendPost — refuses anything but the two forge calls before invoking the transport', () => {
  it('is true for both real routes', () => {
    expect(isTrustedWriteRequest(buildForgeRequest(write, FORGE_ROUTES.forge, 'a', 'c1-1-1'))).toBe(true);
    expect(isTrustedWriteRequest(buildForgeRequest(write, FORGE_ROUTES.forgeToSafe, 'a', 'c1-1-1'))).toBe(true);
  });

  it('is false for a host, a method, or a path other than the ones it was built with', () => {
    const req = buildForgeRequest(write, FORGE_ROUTES.forge, 'a', 'c1-1-1');
    expect(isTrustedWriteRequest({ ...req, host: 'evil.example.net' })).toBe(false);
    expect(isTrustedWriteRequest({ ...req, method: 'DELETE' })).toBe(false);
    expect(isTrustedWriteRequest({ ...req, path: '/item/sell?item=a' })).toBe(false);
    expect(isTrustedWriteRequest({ ...req, path: '/item/forge_all?item=a' })).toBe(false);
  });

  it('judges the route part only — the query string cannot smuggle a different route in', () => {
    const req = buildForgeRequest(write, FORGE_ROUTES.forge, 'a', 'c1-1-1');
    expect(isTrustedWriteRequest({ ...req, path: '/item/sell?item=/item/forge' })).toBe(false);
  });

  it('sendPost refuses a hand-built request for a third path — transport_error, zero transport calls, no throw', async () => {
    const transport = vi.fn();
    const req = buildForgeRequest(write, FORGE_ROUTES.forge, 'a', 'c1-1-1');
    const corrupted = { ...req, path: '/item/sell?item=a' } as unknown as HttpWriteRequest;

    const outcome = await sendPost(corrupted, transport);

    expect(transport).not.toHaveBeenCalled();
    expect(outcome.kind).toBe('transport_error');
    if (outcome.kind === 'transport_error') expect(outcome.message).toContain('/item/sell');
  });

  it('the real flow of requestPost always builds a trusted target, so the transport is invoked with it', async () => {
    const transport = fakeTransport({ status: 200, body: '{"ok":true}' });
    await requestPost(write, transport, FORGE_ROUTES.forge, 'item-1', 'c1-1-1');
    const calledWith = transport.mock.calls[0]?.[0] as HttpWriteRequest;
    expect(calledWith.host).toBe('app.bombfarm.net');
    expect(calledWith.method).toBe('POST');
    expect(calledWith.path).toBe('/item/forge?account_id=486&item=item-1&request_id=c1-1-1');
  });
});

describe('sendPost — classifies the response the same way the read path does', () => {
  it('200 with JSON is ok', async () => {
    const outcome = await requestPost(write, fakeTransport({ status: 200, body: '{"level":9}' }), FORGE_ROUTES.forge, 'a', 'c1-1-1');
    expect(outcome).toEqual({ kind: 'ok', status: 200, json: { level: 9 } });
  });

  it('429 is a cooldown, so a forge roll trips the same backoff the reads honour', async () => {
    const outcome = await requestPost(write, fakeTransport({ status: 429, body: '' }), FORGE_ROUTES.forge, 'a', 'c1-1-1');
    expect(outcome.kind).toBe('cooldown');
  });

  it('a cooldown-shaped body on a 200 is a cooldown too', async () => {
    const outcome = await requestPost(
      write,
      fakeTransport({ status: 200, body: '{"err":"RATE_LIMITED"}' }),
      FORGE_ROUTES.forge,
      'a',
      'c1-1-1',
    );
    expect(outcome.kind).toBe('cooldown');
  });

  it('401 is unauthorized', async () => {
    const outcome = await requestPost(write, fakeTransport({ status: 401, body: '' }), FORGE_ROUTES.forge, 'a', 'c1-1-1');
    expect(outcome.kind).toBe('unauthorized');
  });

  it('a transport that throws is a transport_error, never a throw out of sendPost', async () => {
    const transport = vi.fn().mockRejectedValue(new Error('socket hang up')) as HttpTransport;
    const outcome = await requestPost(write, transport, FORGE_ROUTES.forge, 'a', 'c1-1-1');
    expect(outcome).toEqual({ kind: 'transport_error', message: 'socket hang up' });
  });
});

describe("createRequestIdSource — the game client's own idempotency key", () => {
  it('reproduces the c<uptime>-<sequence>-<random> shape exactly', () => {
    const ids = createRequestIdSource({ uptimeMs: () => 4823, random: () => 0.123456 });
    expect(ids.next()).toBe('c4823-1-123456');
  });

  it('increments the sequence per write, so two rolls are never the same key', () => {
    const ids = createRequestIdSource({ uptimeMs: () => 1000, random: () => 0.5 });
    expect([ids.next(), ids.next(), ids.next()]).toEqual(['c1000-1-500000', 'c1000-2-500000', 'c1000-3-500000']);
  });

  it("keeps the random draw inside the game's 0..999999 range at both extremes", () => {
    expect(createRequestIdSource({ uptimeMs: () => 0, random: () => 0 }).next()).toBe('c0-1-0');
    expect(createRequestIdSource({ uptimeMs: () => 0, random: () => 0.999999 }).next()).toBe('c0-1-999999');
  });

  it('never emits a negative uptime, so the key shape survives a clock that goes backwards', () => {
    const ids = createRequestIdSource({ uptimeMs: () => -50, random: () => 0 });
    expect(ids.next()).toBe('c0-1-0');
  });
});
