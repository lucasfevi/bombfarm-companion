import { PREMIUM_REFRESH_EVERY_MS, PREMIUM_REFRESH_FLOOR_MS } from '@bombfarm/contracts';
import { describe, expect, it } from 'vitest';
import {
  ACTIVE_STATUS_BODY,
  INACTIVE_STATUS_BODY,
  ME_BODY,
  SECRETS,
  START_MS,
  createFakeVault,
  createHarness,
  createSpiedCache,
  deferred,
  session,
  settle,
  unreachable,
  type Harness,
  type HarnessOptions,
  type StubReply,
} from './premium-test-support.js';

const MINUTE = 60_000;

async function startSignedIn(options: HarnessOptions = {}): Promise<Harness> {
  const h = createHarness({ vault: createFakeVault(session(SECRETS.token)), ...options });
  h.service.start();
  await settle();
  return h;
}

async function startSignedOut(options: HarnessOptions = {}): Promise<Harness> {
  const h = createHarness(options);
  h.service.start();
  await settle();
  return h;
}

function fetchCounts(h: Harness): { status: number; me: number; visibility: number } {
  return {
    status: h.stub.calls('status').length,
    me: h.stub.calls('me').length,
    visibility: h.stub.calls('visibility').length,
  };
}

describe('the fetches', () => {
  it('fetches status, me and visibility at start-up with the stored token', async () => {
    const h = await startSignedIn();

    expect(fetchCounts(h)).toEqual({ status: 1, me: 1, visibility: 1 });
    expect(h.stub.calls('status')[0]?.token).toBe(SECRETS.token);
    expect(h.stub.calls('me')[0]?.token).toBe(SECRETS.token);
    expect(h.stub.calls('visibility')[0]?.token).toBeUndefined();
    expect(h.service.getView()).toMatchObject({
      session: 'signed-in',
      status: { active: false, kinds: [] },
      me: { admitted: false },
      fetchedAt: new Date(START_MS).toISOString(),
      lastRefreshFailed: false,
    });
  });

  it('fetches visibility alone when signed out', async () => {
    const h = await startSignedOut();

    expect(fetchCounts(h)).toEqual({ status: 0, me: 0, visibility: 1 });
    expect(h.service.getView()).toMatchObject({ session: 'signed-out', status: null, me: null, fetchedAt: null });
  });

  it('fetches status, me and visibility right after a sign-in', async () => {
    const h = await startSignedOut();
    expect(fetchCounts(h).status).toBe(0);

    await h.signedIn();

    expect(fetchCounts(h)).toEqual({ status: 1, me: 1, visibility: 2 });
    expect(h.stub.calls('status')[0]?.token).toBe(SECRETS.token);
    expect(h.service.getView().status).not.toBeNull();
  });

  it('fetches again every hour and not before', async () => {
    const h = await startSignedIn();

    await h.clock.advance(PREMIUM_REFRESH_EVERY_MS - 1);
    expect(fetchCounts(h).status).toBe(1);
    await h.clock.advance(1);
    expect(fetchCounts(h).status).toBe(2);

    await h.clock.advance(PREMIUM_REFRESH_EVERY_MS);
    expect(fetchCounts(h).status).toBe(3);
  });

  it('prints what the API said, including a past end date on an active status', async () => {
    const h = createHarness({ vault: createFakeVault(session(SECRETS.token)) });
    h.stub.on('status', { status: 200, body: { ...ACTIVE_STATUS_BODY, until: '2020-01-01T00:00:00.000Z' } });
    h.service.start();
    await settle();

    expect(h.service.getView().status).toMatchObject({ active: true, until: '2020-01-01T00:00:00.000Z' });
  });
});

describe('the refresh floor', () => {
  it.each(['open', 'button'] as const)('refuses a %s refresh inside 30 seconds and allows it at 30', async (reason) => {
    const h = await startSignedIn();

    expect(await h.service.refresh(reason)).toEqual({ ok: false, reason: 'too-soon' });
    await h.clock.advance(PREMIUM_REFRESH_FLOOR_MS - 1);
    expect(await h.service.refresh(reason)).toEqual({ ok: false, reason: 'too-soon' });
    expect(fetchCounts(h).status).toBe(1);

    await h.clock.advance(1);
    expect(await h.service.refresh(reason)).toEqual({ ok: true });
    expect(fetchCounts(h)).toEqual({ status: 2, me: 2, visibility: 2 });
  });

  it('measures the floor from when the last fetch finished, whether or not it worked', async () => {
    const h = createHarness({ vault: createFakeVault(session(SECRETS.token)) });
    h.stub.on('status', unreachable);
    h.service.start();
    await settle();

    expect(await h.service.refresh('button')).toEqual({ ok: false, reason: 'too-soon' });
  });

  it('joins a fetch already in flight instead of starting another', async () => {
    const gate = deferred<StubReply>();
    const h = createHarness({ vault: createFakeVault(session(SECRETS.token)) });
    h.stub.on('status', () => gate.promise);
    h.service.start();
    await settle();

    const first = h.service.refresh('open');
    const second = h.service.refresh('button');
    await settle();
    expect(fetchCounts(h)).toEqual({ status: 1, me: 1, visibility: 1 });

    gate.resolve({ status: 200, body: INACTIVE_STATUS_BODY });
    expect(await Promise.all([first, second])).toEqual([{ ok: true }, { ok: true }]);
    expect(fetchCounts(h).status).toBe(1);
  });

  it('refreshes visibility alone when signed out', async () => {
    const h = await startSignedOut();
    await h.clock.advance(PREMIUM_REFRESH_FLOOR_MS);

    expect(await h.service.refresh('open')).toEqual({ ok: true });

    expect(fetchCounts(h)).toEqual({ status: 0, me: 0, visibility: 2 });
  });
});

describe('a 429', () => {
  function limited(retryAfterSec?: number): ReturnType<typeof createHarness> {
    const h = createHarness({ vault: createFakeVault(session(SECRETS.token)) });
    h.stub.on('status', (_request, count) =>
      count === 1
        ? { status: 429, ...(retryAfterSec === undefined ? {} : { retryAfterSec }) }
        : { status: 200, body: INACTIVE_STATUS_BODY },
    );
    return h;
  }

  it('waits ten minutes when the API says nothing, refuses Refresh meanwhile, then fetches', async () => {
    const h = limited();
    h.service.start();
    await settle();
    expect(h.service.getView().lastRefreshFailed).toBe(true);

    await h.clock.advance(PREMIUM_REFRESH_FLOOR_MS + 1);
    expect(await h.service.refresh('button')).toEqual({ ok: false, reason: 'too-soon' });
    await h.clock.advance(10 * MINUTE - PREMIUM_REFRESH_FLOOR_MS - 2);
    expect(fetchCounts(h).status).toBe(1);
    expect(await h.service.refresh('button')).toEqual({ ok: false, reason: 'too-soon' });

    await h.clock.advance(2);
    expect(fetchCounts(h).status).toBe(2);
    expect(h.service.getView().lastRefreshFailed).toBe(false);
    expect(await h.service.refresh('button')).toEqual({ ok: false, reason: 'too-soon' });
  });

  it('waits the Retry-After seconds when the API gives them', async () => {
    const h = limited(120);
    h.service.start();
    await settle();

    await h.clock.advance(119_999);
    expect(fetchCounts(h).status).toBe(1);
    await h.clock.advance(1);
    expect(fetchCounts(h).status).toBe(2);
  });

  it('allows Refresh again once the Retry-After has passed', async () => {
    const h = limited(45);
    h.service.start();
    await settle();

    await h.clock.advance(44_999);
    expect(await h.service.refresh('button')).toEqual({ ok: false, reason: 'too-soon' });
    await h.clock.advance(1);
    expect(fetchCounts(h).status).toBe(2);
  });

  it('caps Retry-After at sixty minutes', async () => {
    const h = limited(86_400);
    h.service.start();
    await settle();

    await h.clock.advance(60 * MINUTE - 1);
    expect(fetchCounts(h).status).toBe(1);
    await h.clock.advance(1);
    expect(fetchCounts(h).status).toBe(2);
  });

  it('keeps the last status and flags the failed refresh', async () => {
    const h = await startSignedIn();
    h.stub.on('status', { status: 429 });
    await h.clock.advance(PREMIUM_REFRESH_EVERY_MS);

    expect(h.service.getView()).toMatchObject({
      session: 'signed-in',
      lastRefreshFailed: true,
      status: { active: false },
    });
    expect(h.log.records).toContainEqual({ scope: 'premium', event: 'status.refresh_failed', status: 429 });
  });
});

describe('a refresh that fails', () => {
  const failures: [string, StubReply | (() => Promise<StubReply>)][] = [
    ['a 404 route that is not deployed yet', { status: 404 }],
    ['a 500', { status: 500 }],
    ['a 503', { status: 503 }],
    ['a network failure', unreachable],
  ];

  it.each(failures)('keeps the last status, stays signed in and flags it after %s', async (_name, reply) => {
    const h = await startSignedIn();
    h.stub.on('status', { status: 200, body: ACTIVE_STATUS_BODY });
    await h.clock.advance(PREMIUM_REFRESH_EVERY_MS);
    const known = h.service.getView();
    expect(known.status?.active).toBe(true);

    h.stub.on('status', reply);
    await h.clock.advance(PREMIUM_REFRESH_EVERY_MS);

    const view = h.service.getView();
    expect(view).toMatchObject({ session: 'signed-in', lastRefreshFailed: true, ended: null });
    expect(view.status).toEqual(known.status);
    expect(view.fetchedAt).toBe(known.fetchedAt);
    expect(h.vault.held()).not.toBeNull();
    expect(h.log.records).toContainEqual({ scope: 'premium', event: 'status.refresh_failed', status: 'unreachable' });
  });

  it.each([
    ['not JSON', { status: 200, body: undefined }],
    ['a body missing a required key', { status: 200, body: { active: true } }],
    ['a body of the wrong type', { status: 200, body: { active: 'yes', kinds: [], until: null, states: {} } }],
  ] as const)('treats %s as a failed fetch, never as not active', async (_name, reply) => {
    const h = createHarness({ vault: createFakeVault(session(SECRETS.token)) });
    h.stub.on('status', reply);
    h.service.start();
    await settle();

    const view = h.service.getView();
    expect(view).toMatchObject({ session: 'signed-in', lastRefreshFailed: true, status: null });
    expect(h.log.records).toContainEqual({ scope: 'premium', event: 'status.unreadable' });
  });

  it('treats a me body of the wrong version as unreadable', async () => {
    const h = createHarness({ vault: createFakeVault(session(SECRETS.token)) });
    h.stub.on('me', { status: 200, body: { ...ME_BODY, v: 2 } });
    h.service.start();
    await settle();

    expect(h.service.getView()).toMatchObject({ lastRefreshFailed: true, me: null, status: { active: false } });
  });

  it('clears the failure flag and moves the time on the next good fetch', async () => {
    const h = await startSignedIn();
    h.stub.on('me', unreachable);
    await h.clock.advance(PREMIUM_REFRESH_EVERY_MS);
    expect(h.service.getView().lastRefreshFailed).toBe(true);

    h.stub.on('me', { status: 200, body: ME_BODY });
    await h.clock.advance(PREMIUM_REFRESH_EVERY_MS);

    expect(h.service.getView()).toMatchObject({
      lastRefreshFailed: false,
      fetchedAt: new Date(START_MS + 2 * PREMIUM_REFRESH_EVERY_MS).toISOString(),
    });
  });
});

describe('the cache', () => {
  it('writes the status, me and visibility after a good fetch', async () => {
    const h = createHarness({ vault: createFakeVault(session(SECRETS.token)) });
    h.stub.on('status', { status: 200, body: ACTIVE_STATUS_BODY });
    h.stub.on('visibility', { status: 200, body: { visible: true } });
    h.service.start();
    await settle();

    expect(h.cache.read()).toMatchObject({
      fetchedAt: new Date(START_MS).toISOString(),
      status: { active: true, kinds: ['subscription'] },
      me: { admitted: false },
      visible: true,
    });
  });

  it('writes nothing when every request failed', async () => {
    const h = createHarness({ vault: createFakeVault(session(SECRETS.token)) });
    h.stub.on('status', unreachable);
    h.stub.on('me', unreachable);
    h.stub.on('visibility', unreachable);
    h.service.start();
    await settle();

    expect(h.cache.writes).toEqual([]);
  });

  it('starts signed in on the cached status when the player is offline, flagging it after the failed fetch', async () => {
    const seeded = {
      fetchedAt: '2026-10-19T08:00:00.000Z',
      status: {
        active: true,
        kinds: ['pass'] as const,
        until: '2026-12-31T00:00:00.000Z',
        awaitingPaymentUntil: null,
        graceUntil: null,
        cancellationAt: null,
        paymentFailed: false,
        pendingFirstPayment: false,
        disputeHold: false,
      },
      me: { methods: ['discord'] as const, steamVerified: true, gameAccountLinked: true, admitted: false },
      visible: false,
    };
    const h = createHarness({ vault: createFakeVault(session(SECRETS.token)), cache: createSpiedCache(seeded) });
    h.stub.on('status', unreachable);
    h.stub.on('me', unreachable);
    h.stub.on('visibility', unreachable);

    h.service.start();
    expect(h.service.getView()).toMatchObject({
      session: 'signed-in',
      status: seeded.status,
      me: seeded.me,
      fetchedAt: seeded.fetchedAt,
      lastRefreshFailed: false,
      visible: true,
    });

    await settle();
    expect(h.service.getView()).toMatchObject({
      session: 'signed-in',
      status: seeded.status,
      fetchedAt: seeded.fetchedAt,
      lastRefreshFailed: true,
    });
  });
});

describe('a 401', () => {
  it.each(['status', 'me'] as const)('on %s clears the token and the cache and reports the sign-in ended', async (path) => {
    const h = createHarness({ vault: createFakeVault(session(SECRETS.token)) });
    h.stub.on(path, { status: 401 });
    h.service.start();
    await settle();

    expect(h.service.getView()).toMatchObject({
      session: 'signed-out',
      ended: 'expired',
      status: null,
      me: null,
      fetchedAt: null,
      lastRefreshFailed: false,
    });
    expect(h.vault.held()).toBeNull();
    expect(h.vault.clears).toBe(1);
    expect(h.cache.read()).toBeNull();
    expect(h.cache.clears).toBe(1);
  });

  it('lets the player sign in again afterwards and clears the notice', async () => {
    const h = createHarness({ vault: createFakeVault(session(SECRETS.token)) });
    h.stub.on('status', { status: 401 });
    h.service.start();
    await settle();
    h.stub.on('status', { status: 200, body: INACTIVE_STATUS_BODY });

    await h.signedIn();

    expect(h.service.getView()).toMatchObject({ session: 'signed-in', ended: null });
  });

  it('stops asking for status and keeps asking for visibility', async () => {
    const h = createHarness({ vault: createFakeVault(session(SECRETS.token)) });
    h.stub.on('status', { status: 401 });
    h.service.start();
    await settle();

    await h.clock.advance(PREMIUM_REFRESH_EVERY_MS);

    expect(fetchCounts(h)).toEqual({ status: 1, me: 1, visibility: 2 });
  });

  it('drops an answer that lands after the session ended', async () => {
    const gate = deferred<StubReply>();
    const h = createHarness({ vault: createFakeVault(session(SECRETS.token)) });
    h.stub.on('status', () => gate.promise);
    h.stub.on('me', { status: 401 });
    h.service.start();
    await settle();
    expect(h.service.getView().session).toBe('signed-out');

    gate.resolve({ status: 200, body: ACTIVE_STATUS_BODY });
    await settle();

    expect(h.service.getView()).toMatchObject({ session: 'signed-out', status: null, ended: 'expired' });
    expect(h.cache.writes).toEqual([]);
  });
});

describe('stopping', () => {
  it('clears the hourly timer', async () => {
    const h = await startSignedIn();
    expect(h.clock.pending()).toBe(1);

    h.service.stop();

    expect(h.clock.pending()).toBe(0);
    await h.clock.advance(3 * PREMIUM_REFRESH_EVERY_MS);
    expect(fetchCounts(h).status).toBe(1);
  });
});

describe('visibility', () => {
  type Flag = true | false | 'unknown';
  type Account = 'signed-out' | { admitted: boolean; active: boolean | 'none' };

  const flags: Flag[] = [true, false, 'unknown'];
  const accounts: Account[] = [
    'signed-out',
    { admitted: true, active: true },
    { admitted: true, active: false },
    { admitted: true, active: 'none' },
    { admitted: false, active: true },
    { admitted: false, active: false },
    { admitted: false, active: 'none' },
  ];
  const cases = flags.flatMap((flag) => accounts.map((account) => [flag, account] as const));

  function label(account: Account): string {
    if (account === 'signed-out') return 'signed out';
    return `admitted ${String(account.admitted)} and status ${String(account.active)}`;
  }

  it.each(cases)('with the flag %s and %s, shows the tab only if any one of them says so', async (flag, account) => {
    const h = createHarness(account === 'signed-out' ? {} : { vault: createFakeVault(session(SECRETS.token)) });
    if (flag === 'unknown') h.stub.on('visibility', unreachable);
    else h.stub.on('visibility', { status: 200, body: { visible: flag } });
    if (account !== 'signed-out') {
      h.stub.on('me', { status: 200, body: { ...ME_BODY, admitted: account.admitted } });
      if (account.active === 'none') h.stub.on('status', { status: 503 });
      else h.stub.on('status', { status: 200, body: account.active ? ACTIVE_STATUS_BODY : INACTIVE_STATUS_BODY });
    }

    h.service.start();
    await settle();

    const admitted = account !== 'signed-out' && account.admitted;
    const active = account !== 'signed-out' && account.active === true;
    const expected = flag === true || admitted || active;
    expect(h.service.getView().visible, label(account)).toBe(expected);
  });

  it('follows the cached values when the flag was never fetched, and is hidden with none', async () => {
    const withCache = createHarness({
      cache: createSpiedCache({ fetchedAt: '2026-10-19T08:00:00.000Z', status: null, me: null, visible: true }),
    });
    withCache.stub.on('visibility', unreachable);
    withCache.service.start();
    expect(withCache.service.getView().visible).toBe(true);
    await settle();
    expect(withCache.service.getView().visible).toBe(true);

    const withoutCache = createHarness();
    withoutCache.stub.on('visibility', unreachable);
    withoutCache.service.start();
    await settle();
    expect(withoutCache.service.getView().visible).toBe(false);
  });

  it('shows the tab to an admitted player even when the public flag is off', async () => {
    const h = createHarness({ vault: createFakeVault(session(SECRETS.token)) });
    h.stub.on('me', { status: 200, body: { ...ME_BODY, admitted: true } });
    h.service.start();
    await settle();

    expect(h.service.getView()).toMatchObject({ visible: true, me: { admitted: true } });
  });

  it('flips to shown when the flag turns true on the next refresh', async () => {
    const h = await startSignedOut();
    expect(h.service.getView().visible).toBe(false);

    h.stub.on('visibility', { status: 200, body: { visible: true } });
    await h.clock.advance(PREMIUM_REFRESH_FLOOR_MS);
    await h.service.refresh('open');

    expect(h.service.getView().visible).toBe(true);
  });
});
