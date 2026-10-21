import { describe, expect, it } from 'vitest';
import { createPremiumApi } from './premium-api.js';
import type { PremiumHttp, PremiumHttpRequest, PremiumHttpResponse } from './premium-transport.js';

const TOKEN = 'desktop-token-for-tests';

const PUBLISHED_STATUS_BODY = {
  active: true,
  kinds: ['subscription'],
  until: '2026-12-16T12:00:00.000Z',
  entitlements: [
    {
      kind: 'subscription',
      mode: 'live',
      active: true,
      state: 'paid',
      until: '2026-11-16T12:00:00.000Z',
      startsAt: '2026-10-16T12:00:00.000Z',
      paidThrough: '2026-11-16T12:00:00.000Z',
      nextChargeAt: '2026-12-16T12:00:00.000Z',
    },
    {
      kind: 'pass',
      mode: 'live',
      active: false,
      state: 'active',
      until: '2026-12-16T12:00:00.000Z',
      startsAt: '2026-11-16T12:00:00.000Z',
      paidThrough: null,
      nextChargeAt: null,
    },
  ],
  states: {
    awaitingPayment: null,
    grace: null,
    cancellationScheduled: null,
    paymentFailed: false,
    pendingFirstPayment: false,
    pendingPass: true,
    disputeHold: false,
    purchaseBlocked: false,
    regionBlocked: false,
  },
  notices: ['pass_payment_pending'],
  pendingPasses: [
    {
      ref: '0b7e5f0a-5c1d-4c52-9a43-6e8f6f3c2a11',
      amount: 2900,
      currency: 'brl',
      createdAt: '2026-10-16T09:30:00.000Z',
      expiresAt: '2026-10-19T02:59:59.000Z',
      coversIfPaid: { from: '2026-12-16T12:00:00.000Z', to: '2027-01-16T12:00:00.000Z' },
    },
  ],
};
const ME_BODY = {
  v: 1,
  userId: 'u-1',
  signInMethods: ['discord', 'steam'],
  steamVerified: true,
  gameAccountLinked: false,
  admitted: true,
  audience: 'x',
  mode: 'live',
};
const SESSION_BODY = { token: 'new-token', expiresAt: '2027-01-01T00:00:00.000Z', rotateAfter: '2026-11-01T00:00:00.000Z' };
const SESSION = { token: 'new-token', expiresAt: '2027-01-01T00:00:00.000Z', rotateAfter: '2026-11-01T00:00:00.000Z' };

function reply(status: number, body: unknown = '', retryAfterSec: number | null = null): PremiumHttpResponse {
  return { status, body: typeof body === 'string' ? body : JSON.stringify(body), retryAfterSec };
}

function harness(answer: PremiumHttpResponse | Error) {
  const sent: PremiumHttpRequest[] = [];
  const http: PremiumHttp = (req) => {
    sent.push(req);
    return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer);
  };
  return { api: createPremiumApi(http), sent };
}

const UNREACHABLE_STATUSES = [404, 500, 502, 503];

describe('requestSignIn', () => {
  const input = { challenge: 'chal', state: 'st', redirectUri: 'http://127.0.0.1:5000/callback' };

  it('sends exactly the four documented keys, no bearer, and returns the approval URL', async () => {
    const { api, sent } = harness(reply(201, { approvalUrl: 'https://example.test/approve', expiresAt: 'x' }));

    await expect(api.requestSignIn(input)).resolves.toEqual({ ok: true, approvalUrl: 'https://example.test/approve' });

    expect(sent).toHaveLength(1);
    expect(sent[0]).toEqual({
      path: 'signInRequest',
      method: 'POST',
      body: { codeChallenge: 'chal', codeChallengeMethod: 'S256', redirectUri: input.redirectUri, state: 'st' },
    });
    expect(Object.keys((sent[0]?.body ?? {})).sort()).toEqual(
      ['codeChallenge', 'codeChallengeMethod', 'redirectUri', 'state'].sort(),
    );
    expect(sent[0]?.token).toBeUndefined();
  });

  it('accepts a 200 as well as a 201', async () => {
    const { api } = harness(reply(200, { approvalUrl: 'https://example.test/approve' }));
    await expect(api.requestSignIn(input)).resolves.toEqual({ ok: true, approvalUrl: 'https://example.test/approve' });
  });

  it.each([
    ['a non-https URL', reply(201, { approvalUrl: 'http://example.test/approve' })],
    ['a missing URL', reply(201, {})],
    ['a body that is not JSON', reply(201, 'oops')],
  ])('maps %s to bad-response', async (_name, answer) => {
    const { api } = harness(answer);
    await expect(api.requestSignIn(input)).resolves.toEqual({ ok: false, reason: 'bad-response' });
  });

  it('maps 400 to refused', async () => {
    const { api } = harness(reply(400, { reason: 'bad_request' }));
    await expect(api.requestSignIn(input)).resolves.toEqual({ ok: false, reason: 'refused' });
  });

  it.each([...UNREACHABLE_STATUSES, 429])('maps %s to unreachable', async (status) => {
    const { api } = harness(reply(status));
    await expect(api.requestSignIn(input)).resolves.toEqual({ ok: false, reason: 'unreachable' });
  });

  it('maps a thrown error to unreachable', async () => {
    const { api } = harness(new Error('offline'));
    await expect(api.requestSignIn(input)).resolves.toEqual({ ok: false, reason: 'unreachable' });
  });

  it('maps an unexpected status to bad-response', async () => {
    const { api } = harness(reply(302));
    await expect(api.requestSignIn(input)).resolves.toEqual({ ok: false, reason: 'bad-response' });
  });
});

describe('exchangeCode', () => {
  const input = { code: 'the-code', verifier: 'the-verifier', redirectUri: 'http://127.0.0.1:5000/callback' };

  it('sends exactly code, codeVerifier and redirectUri, no bearer, and returns the session', async () => {
    const { api, sent } = harness(reply(200, SESSION_BODY));

    await expect(api.exchangeCode(input)).resolves.toEqual({ ok: true, session: SESSION });

    expect(sent[0]).toEqual({
      path: 'token',
      method: 'POST',
      body: { code: 'the-code', codeVerifier: 'the-verifier', redirectUri: input.redirectUri },
    });
    expect(sent[0]?.token).toBeUndefined();
  });

  it.each([
    ['a body missing a key', reply(200, { token: 't', expiresAt: 'e' })],
    ['a body that is not JSON', reply(200, 'oops')],
  ])('maps %s to bad-response', async (_name, answer) => {
    const { api } = harness(answer);
    await expect(api.exchangeCode(input)).resolves.toEqual({ ok: false, reason: 'bad-response' });
  });

  it('maps 400 to refused', async () => {
    const { api } = harness(reply(400, { reason: 'invalid_grant' }));
    await expect(api.exchangeCode(input)).resolves.toEqual({ ok: false, reason: 'refused' });
  });

  it.each([...UNREACHABLE_STATUSES, 429])('maps %s to unreachable', async (status) => {
    const { api } = harness(reply(status));
    await expect(api.exchangeCode(input)).resolves.toEqual({ ok: false, reason: 'unreachable' });
  });

  it('maps a thrown error to unreachable', async () => {
    const { api } = harness(new Error('offline'));
    await expect(api.exchangeCode(input)).resolves.toEqual({ ok: false, reason: 'unreachable' });
  });
});

describe('rotate', () => {
  it('sends a bearer and no body, and returns the new session on 200', async () => {
    const { api, sent } = harness(reply(200, SESSION_BODY));

    await expect(api.rotate(TOKEN)).resolves.toEqual({ ok: true, session: SESSION });

    expect(sent[0]).toEqual({ path: 'rotate', method: 'POST', token: TOKEN });
    expect(sent[0]?.body).toBeUndefined();
  });

  it('maps 409 to conflict and 401 to unauthorized', async () => {
    await expect(harness(reply(409)).api.rotate(TOKEN)).resolves.toEqual({ ok: false, reason: 'conflict' });
    await expect(harness(reply(401)).api.rotate(TOKEN)).resolves.toEqual({ ok: false, reason: 'unauthorized' });
  });

  it('maps a 200 with a bad body to bad-response', async () => {
    const { api } = harness(reply(200, { token: 5 }));
    await expect(api.rotate(TOKEN)).resolves.toEqual({ ok: false, reason: 'bad-response' });
  });

  it.each([...UNREACHABLE_STATUSES, 429])('maps %s to unreachable', async (status) => {
    const { api } = harness(reply(status));
    await expect(api.rotate(TOKEN)).resolves.toEqual({ ok: false, reason: 'unreachable' });
  });

  it('maps a thrown error to unreachable', async () => {
    const { api } = harness(new Error('offline'));
    await expect(api.rotate(TOKEN)).resolves.toEqual({ ok: false, reason: 'unreachable' });
  });
});

describe.each([
  {
    name: 'fetchStatus',
    path: 'status',
    call: (api: ReturnType<typeof createPremiumApi>) => api.fetchStatus(TOKEN),
    good: PUBLISHED_STATUS_BODY,
    bad: { active: 'yes' },
  },
  {
    name: 'fetchMe',
    path: 'me',
    call: (api: ReturnType<typeof createPremiumApi>) => api.fetchMe(TOKEN),
    good: ME_BODY,
    bad: { v: 2 },
  },
])('$name', ({ path, call, good, bad }) => {
  it('sends a GET with a bearer and no body, and returns the parsed value on 200', async () => {
    const { api, sent } = harness(reply(200, good));

    const result = await call(api);

    expect(result.ok).toBe(true);
    expect(sent[0]).toEqual({ path, method: 'GET', token: TOKEN });
    expect(sent[0]?.body).toBeUndefined();
  });

  it('maps a 200 with an unreadable body to bad-response', async () => {
    await expect(call(harness(reply(200, bad)).api)).resolves.toEqual({ ok: false, reason: 'bad-response' });
    await expect(call(harness(reply(200, 'not json')).api)).resolves.toEqual({ ok: false, reason: 'bad-response' });
  });

  it('maps 401 to unauthorized', async () => {
    await expect(call(harness(reply(401)).api)).resolves.toEqual({ ok: false, reason: 'unauthorized' });
  });

  it.each([...UNREACHABLE_STATUSES])('maps %s to unreachable', async (status) => {
    await expect(call(harness(reply(status)).api)).resolves.toEqual({ ok: false, reason: 'unreachable' });
  });

  it('maps a thrown error to unreachable', async () => {
    await expect(call(harness(new Error('offline')).api)).resolves.toEqual({ ok: false, reason: 'unreachable' });
  });

  it('maps 429 to rate-limited with the Retry-After seconds, or with none when empty', async () => {
    await expect(call(harness(reply(429, '', 120)).api)).resolves.toEqual({
      ok: false,
      reason: 'rate-limited',
      retryAfterSec: 120,
    });
    const empty = await call(harness(reply(429)).api);
    expect(empty).toEqual({ ok: false, reason: 'rate-limited' });
    expect('retryAfterSec' in empty).toBe(false);
  });
});

describe('fetchStatus on the published body', () => {
  it('reads the API status body as published', async () => {
    const { api } = harness(reply(200, PUBLISHED_STATUS_BODY));
    await expect(api.fetchStatus(TOKEN)).resolves.toEqual({
      ok: true,
      value: {
        active: true,
        kinds: ['subscription'],
        until: '2026-12-16T12:00:00.000Z',
        awaitingPaymentUntil: null,
        graceUntil: null,
        cancellationAt: null,
        paymentFailed: false,
        pendingFirstPayment: false,
        disputeHold: false,
      },
    });
  });
});

describe('fetchMe', () => {
  it('keeps only the four fields the app shows', async () => {
    const { api } = harness(reply(200, ME_BODY));
    await expect(api.fetchMe(TOKEN)).resolves.toEqual({
      ok: true,
      value: { methods: ['discord', 'steam'], steamVerified: true, gameAccountLinked: false, admitted: true },
    });
  });
});

describe('fetchVisibility', () => {
  it('sends a GET with no bearer and returns the flag', async () => {
    const { api, sent } = harness(reply(200, { visible: true }));

    await expect(api.fetchVisibility()).resolves.toEqual({ ok: true, visible: true });

    expect(sent[0]).toEqual({ path: 'visibility', method: 'GET' });
    expect(sent[0]?.token).toBeUndefined();
  });

  it('returns false when the flag is false', async () => {
    const { api } = harness(reply(200, { visible: false }));
    await expect(api.fetchVisibility()).resolves.toEqual({ ok: true, visible: false });
  });

  it('maps an unreadable body to bad-response', async () => {
    await expect(harness(reply(200, { visible: 'yes' })).api.fetchVisibility()).resolves.toEqual({
      ok: false,
      reason: 'bad-response',
    });
  });

  it.each(UNREACHABLE_STATUSES)('maps %s to unreachable', async (status) => {
    await expect(harness(reply(status)).api.fetchVisibility()).resolves.toEqual({ ok: false, reason: 'unreachable' });
  });

  it('maps a thrown error to unreachable', async () => {
    await expect(harness(new Error('offline')).api.fetchVisibility()).resolves.toEqual({
      ok: false,
      reason: 'unreachable',
    });
  });

  it('maps 429 to rate-limited with the seconds', async () => {
    await expect(harness(reply(429, '', 30)).api.fetchVisibility()).resolves.toEqual({
      ok: false,
      reason: 'rate-limited',
      retryAfterSec: 30,
    });
    await expect(harness(reply(429)).api.fetchVisibility()).resolves.toEqual({ ok: false, reason: 'rate-limited' });
  });

  it('never reports a sign-in problem, since the call carries no sign-in', async () => {
    await expect(harness(reply(401)).api.fetchVisibility()).resolves.toEqual({ ok: false, reason: 'bad-response' });
  });
});

describe('reportGameAccount', () => {
  const pair = { accountId: 'acct-1', steamId64: '76561198000000000', playerName: null };

  it('posts exactly account_id and steam_id64 with a bearer when there is no name', async () => {
    const { api, sent } = harness(reply(200, { outcome: 'linked' }));

    await expect(api.reportGameAccount(TOKEN, pair)).resolves.toEqual({ kind: 'linked' });

    expect(sent[0]).toEqual({
      path: 'report',
      method: 'POST',
      token: TOKEN,
      body: { account_id: 'acct-1', steam_id64: '76561198000000000' },
    });
    expect(Object.keys((sent[0]?.body ?? {})).sort()).toEqual(['account_id', 'steam_id64']);
  });

  it('adds player_name when there is one', async () => {
    const { api, sent } = harness(reply(200, { outcome: 'linked' }));

    await api.reportGameAccount(TOKEN, { ...pair, playerName: 'Some Player' });

    expect(sent[0]?.body).toEqual({
      account_id: 'acct-1',
      steam_id64: '76561198000000000',
      player_name: 'Some Player',
    });
  });

  it('maps any other 200 outcome to failed', async () => {
    await expect(harness(reply(200, { outcome: 'pending' })).api.reportGameAccount(TOKEN, pair)).resolves.toEqual({
      kind: 'failed',
    });
    await expect(harness(reply(200, 'not json')).api.reportGameAccount(TOKEN, pair)).resolves.toEqual({
      kind: 'failed',
    });
  });

  it.each(['steam_mismatch', 'no_steam_id', 'game_account_taken'])('maps 409 %s to a named refusal', async (reason) => {
    await expect(harness(reply(409, { reason })).api.reportGameAccount(TOKEN, pair)).resolves.toEqual({
      kind: 'refused',
      reason,
    });
  });

  it('maps a 409 with another reason to an unknown refusal', async () => {
    await expect(harness(reply(409, { reason: 'something_new' })).api.reportGameAccount(TOKEN, pair)).resolves.toEqual({
      kind: 'refused',
      reason: 'unknown',
    });
  });

  it('maps 401 to unauthorized', async () => {
    await expect(harness(reply(401)).api.reportGameAccount(TOKEN, pair)).resolves.toEqual({ kind: 'unauthorized' });
  });

  it.each([400, 429, ...UNREACHABLE_STATUSES])('maps %s to failed', async (status) => {
    await expect(harness(reply(status)).api.reportGameAccount(TOKEN, pair)).resolves.toEqual({ kind: 'failed' });
  });

  it('maps a thrown error to failed', async () => {
    await expect(harness(new Error('offline')).api.reportGameAccount(TOKEN, pair)).resolves.toEqual({ kind: 'failed' });
  });
});

describe('requestHandOff', () => {
  it('sends a bearer and no body, and returns the URL on 200', async () => {
    const { api, sent } = harness(reply(200, { url: 'https://example.test/handoff?x=1', expiresAt: 'x' }));

    await expect(api.requestHandOff(TOKEN)).resolves.toEqual({ ok: true, url: 'https://example.test/handoff?x=1' });

    expect(sent[0]).toEqual({ path: 'handOff', method: 'POST', token: TOKEN });
    expect(sent[0]?.body).toBeUndefined();
  });

  it.each([
    ['a non-https URL', reply(200, { url: 'http://example.test/x' })],
    ['a javascript URL', reply(200, { url: 'javascript:alert(1)' })],
    ['an unparsable URL', reply(200, { url: 'not a url' })],
    ['a missing URL', reply(200, {})],
  ])('maps %s to bad-response', async (_name, answer) => {
    await expect(harness(answer).api.requestHandOff(TOKEN)).resolves.toEqual({ ok: false, reason: 'bad-response' });
  });

  it('maps 401 to unauthorized', async () => {
    await expect(harness(reply(401)).api.requestHandOff(TOKEN)).resolves.toEqual({ ok: false, reason: 'unauthorized' });
  });

  it.each([...UNREACHABLE_STATUSES, 429])('maps %s to unreachable', async (status) => {
    await expect(harness(reply(status)).api.requestHandOff(TOKEN)).resolves.toEqual({ ok: false, reason: 'unreachable' });
  });

  it('maps a thrown error to unreachable', async () => {
    await expect(harness(new Error('offline')).api.requestHandOff(TOKEN)).resolves.toEqual({
      ok: false,
      reason: 'unreachable',
    });
  });
});

describe('signOut', () => {
  it('posts to the sign-out route with a bearer and no body', async () => {
    const { api, sent } = harness(reply(204));

    await expect(api.signOut(TOKEN)).resolves.toBeUndefined();

    expect(sent[0]).toEqual({ path: 'signOut', method: 'POST', token: TOKEN });
  });

  it.each([401, 500, 404, 429])('resolves on a %s answer', async (status) => {
    await expect(harness(reply(status)).api.signOut(TOKEN)).resolves.toBeUndefined();
  });

  it('never throws when the transport rejects', async () => {
    await expect(harness(new Error('offline')).api.signOut(TOKEN)).resolves.toBeUndefined();
  });
});

describe('the bearer rule', () => {
  it('is present on exactly the six bearer calls and absent on the three open ones', async () => {
    const { api, sent } = harness(reply(200, {}));

    await api.requestSignIn({ challenge: 'c', state: 's', redirectUri: 'r' });
    await api.exchangeCode({ code: 'c', verifier: 'v', redirectUri: 'r' });
    await api.fetchVisibility();
    await api.rotate(TOKEN);
    await api.signOut(TOKEN);
    await api.fetchMe(TOKEN);
    await api.reportGameAccount(TOKEN, { accountId: 'a', steamId64: '76561198000000000', playerName: null });
    await api.requestHandOff(TOKEN);
    await api.fetchStatus(TOKEN);

    const withBearer = sent.filter((req) => req.token === TOKEN).map((req) => req.path);
    const without = sent.filter((req) => req.token === undefined).map((req) => req.path);
    expect(withBearer.sort()).toEqual(['handOff', 'me', 'report', 'rotate', 'signOut', 'status']);
    expect(without.sort()).toEqual(['signInRequest', 'token', 'visibility']);
  });
});
