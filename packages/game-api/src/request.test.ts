import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import type { GrantedConsent } from './consent.js';
import { ConsentedSessionRequiredError, RAW, SessionToken, grantSession, type ConsentedSession } from './session.js';
import {
  buildHttpRequest,
  isTrustedHttpRequest,
  requestGet,
  sendGet,
  type HttpRequest,
  type HttpResponse,
  type HttpTransport,
  type RequestOutcome,
} from './request.js';

const GRANTED: GrantedConsent = { decision: 'granted', grantedAt: '2026-08-12T13:15:38.000Z', textVersion: 1 };
const SENTINEL_TOKEN = 'sentinel-3c8f0a71-do-not-leak';
const session = grantSession(GRANTED, { accountId: '486', token: SessionToken.create(SENTINEL_TOKEN) });

/** A value that satisfies `ConsentedSession`'s structural shape without ever going through
 *  `grantSession` — exactly the forgery the Verifier used to defeat the request layer's (former)
 *  lack of a runtime check: `{ accountId, token, grantedAt } as unknown as ConsentedSession`. */
function forgeConsentedSession(): ConsentedSession {
  return {
    accountId: '486',
    token: SessionToken.create('forged-token-should-never-be-sent'),
    grantedAt: '2026-08-12T13:15:38.000Z',
  } as unknown as ConsentedSession;
}

describe('buildHttpRequest/requestGet — reject a session forged through an unsafe cast (AD-025/AD-028, request-layer brand check)', () => {
  it('buildHttpRequest throws ConsentedSessionRequiredError for a forged session, before building any header', () => {
    const forged = forgeConsentedSession();
    expect(() => buildHttpRequest(forged, '/state')).toThrow(ConsentedSessionRequiredError);
  });

  it('requestGet throws ConsentedSessionRequiredError for a forged session — zero transport calls', async () => {
    const forged = forgeConsentedSession();
    const transport = vi.fn();
    await expect(requestGet(forged, transport, '/state')).rejects.toThrow(ConsentedSessionRequiredError);
    expect(transport).not.toHaveBeenCalled();
  });

  it('a real session minted by grantSession is accepted (sanity — the check above is not vacuous)', () => {
    expect(() => buildHttpRequest(session, '/state')).not.toThrow();
  });
});

function fakeTransport(response: HttpResponse): HttpTransport & ReturnType<typeof vi.fn> {
  return vi.fn().mockResolvedValue(response) as HttpTransport & ReturnType<typeof vi.fn>;
}

describe('buildHttpRequest — the token is read through RAW exactly once, nowhere else', () => {
  it('places the raw token in Authorization only, not in path or any other header', () => {
    const req = buildHttpRequest(session, '/state');
    const rawToken = session.token[RAW]();

    expect(req.headers.Authorization).toBe(`Bearer ${rawToken}`);
    expect(req.headers['X-Account-Id']).toBe('486');
    expect(req.headers.Accept).toBe('application/json');
    expect(req.headers.Host).toBe('api.bombfarm.net');
    expect(req.headers.Connection).toBe('close');
    expect(req.path).not.toContain(rawToken);

    const headerValues = Object.entries(req.headers).filter(([key]) => key !== 'Authorization');
    for (const [, value] of headerValues) {
      expect(value).not.toContain(rawToken);
    }
  });

  it('defaults the timeout to 15s and always targets the trusted host/method', () => {
    const req = buildHttpRequest(session, '/roster');
    expect(req.timeoutMs).toBe(15_000);
    expect(req.host).toBe('api.bombfarm.net');
    expect(req.method).toBe('GET');
  });
});

describe('isTrustedHttpRequest / sendGet — refuses a mismatched target before invoking the transport (LAR-13, LAR-24)', () => {
  it('isTrustedHttpRequest is true for the real target', () => {
    expect(isTrustedHttpRequest(buildHttpRequest(session, '/state'))).toBe(true);
  });

  it('isTrustedHttpRequest is false for a host corrupted through an unsafe cast', () => {
    const req = buildHttpRequest(session, '/state');
    const corrupted = { ...req, host: 'evil.example.net' } as unknown as HttpRequest;
    expect(isTrustedHttpRequest(corrupted)).toBe(false);
  });

  it('sendGet refuses a mismatched host before invoking the transport — zero transport calls', async () => {
    const transport = vi.fn();
    const req = buildHttpRequest(session, '/state');
    const corrupted = { ...req, host: 'evil.example.net' } as unknown as HttpRequest;

    const outcome = await sendGet(corrupted, transport);

    expect(transport).not.toHaveBeenCalled();
    expect(outcome.kind).toBe('transport_error');
  });

  it('sendGet refuses a mismatched method before invoking the transport — zero transport calls', async () => {
    const transport = vi.fn();
    const req = buildHttpRequest(session, '/state');
    const corrupted = { ...req, method: 'POST' } as unknown as HttpRequest;

    const outcome = await sendGet(corrupted, transport);

    expect(transport).not.toHaveBeenCalled();
    expect(outcome.kind).toBe('transport_error');
  });

  it("requestGet's real flow always builds the trusted target, so the transport is always invoked with it", async () => {
    const transport = fakeTransport({ status: 200, body: '{"ok":true}' });
    await requestGet(session, transport, '/state');
    const calledWith = transport.mock.calls[0]?.[0] as HttpRequest;
    expect(calledWith.host).toBe('api.bombfarm.net');
    expect(calledWith.method).toBe('GET');
  });
});

describe('RequestOutcome classification — every response class maps to its own named kind (LAR-25)', () => {
  const cases: ReadonlyArray<{
    readonly label: string;
    readonly response: HttpResponse;
    readonly expectKind: RequestOutcome['kind'];
  }> = [
    { label: '200 with valid JSON', response: { status: 200, body: '{"gold":100}' }, expectKind: 'ok' },
    { label: '200 with non-JSON body', response: { status: 200, body: 'not json at all' }, expectKind: 'malformed_json' },
    { label: '401', response: { status: 401, body: '{"error":"unauthorized"}' }, expectKind: 'unauthorized' },
    { label: '403', response: { status: 403, body: '{"error":"forbidden"}' }, expectKind: 'unauthorized' },
    { label: '429', response: { status: 429, body: '{"error":"TOO_MANY_REQUESTS"}' }, expectKind: 'cooldown' },
    { label: '503', response: { status: 503, body: 'service unavailable' }, expectKind: 'cooldown' },
    {
      label: 'a cooldown-shaped body on a 200',
      response: { status: 200, body: '{"code":"COOLDOWN_ACTIVE"}' },
      expectKind: 'cooldown',
    },
    { label: 'another 4xx (404)', response: { status: 404, body: '{"error":"not_found"}' }, expectKind: 'http_error' },
    { label: 'a 5xx (500)', response: { status: 500, body: 'internal error' }, expectKind: 'http_error' },
  ];

  for (const { label, response, expectKind } of cases) {
    it(`${label} -> ${expectKind}`, async () => {
      const outcome = await requestGet(session, fakeTransport(response), '/state');
      expect(outcome.kind).toBe(expectKind);
    });
  }

  it('401 and 403 are both "unauthorized", distinct from "http_error" (LAR-23)', async () => {
    const outcome401 = await requestGet(session, fakeTransport({ status: 401, body: '{}' }), '/state');
    const outcome404 = await requestGet(session, fakeTransport({ status: 404, body: '{}' }), '/state');
    expect(outcome401.kind).toBe('unauthorized');
    expect(outcome404.kind).toBe('http_error');
    expect(outcome401.kind).not.toBe(outcome404.kind);
  });

  it('an oversize body is rejected as too_large WITHOUT being JSON.parsed', async () => {
    // A body that would throw if JSON.parse ever touched it, padded well past MAX_RESPONSE_BYTES.
    const hugeBadJson = `{not-json${'x'.repeat(2_100_000)}`;
    const outcome = await requestGet(session, fakeTransport({ status: 200, body: hugeBadJson }), '/state');
    expect(outcome).toEqual({ kind: 'too_large', bytes: Buffer.byteLength(hugeBadJson, 'utf8') });
  });

  it('a throwing transport maps to transport_error with exactly one invocation — no alternative host, no retry', async () => {
    const transport = vi.fn().mockRejectedValue(new Error('ECONNREFUSED')) as HttpTransport & ReturnType<typeof vi.fn>;
    const outcome = await requestGet(session, transport, '/state');
    expect(outcome.kind).toBe('transport_error');
    expect(transport).toHaveBeenCalledTimes(1);
  });
});

describe('no forbidden transport imports in this module (LAR-24; re-checked by T10s guard)', () => {
  it('request.ts does not import node:https, node:http, undici, axios, or name fetch', () => {
    const source = readFileSync(fileURLToPath(new URL('./request.ts', import.meta.url)), 'utf8');
    expect(source).not.toMatch(/from ['"]node:https['"]/);
    expect(source).not.toMatch(/from ['"]node:http['"]/);
    expect(source).not.toMatch(/from ['"]undici['"]/);
    expect(source).not.toMatch(/from ['"]axios['"]/);
    expect(source).not.toMatch(/\bfetch\(/);
  });
});
