import { describe, expect, it } from 'vitest';
import { SECRETS, createFakeVault, createHarness, session, settle, unreachable, type Harness } from './premium-test-support.js';

const NEVER_LOGGED_OR_EMITTED = [
  SECRETS.token,
  SECRETS.rotatedToken,
  SECRETS.verifier,
  SECRETS.state,
  SECRETS.code,
  SECRETS.approvalUrl,
  SECRETS.handOffUrl,
];

const LITERAL_EVENTS = [
  'signin.started',
  'signin.ended',
  'status.refresh_failed',
  'status.unreadable',
  'report.outcome',
  'handoff.failed',
  'signout.unreachable',
];

const NEVER_LOGGED = [...NEVER_LOGGED_OR_EMITTED, SECRETS.accountId, SECRETS.steamId64];

function everyLogRecord(h: Harness): string {
  return JSON.stringify(h.log.records);
}

const NEVER_EMITTED = [...NEVER_LOGGED_OR_EMITTED, SECRETS.steamId64];

/** The game account id is shown to the player, so a view may carry it under `reportedAccountId` and nowhere else. */
function everyEmittedView(h: Harness): string {
  return JSON.stringify([...h.views, h.service.getView()], (key, value: unknown) =>
    key === 'reportedAccountId' ? null : value,
  );
}

function expectClean(h: Harness): void {
  expect(h.log.records.length).toBeGreaterThan(0);
  expect(h.views.length).toBeGreaterThan(0);
  for (const secret of NEVER_LOGGED) expect(everyLogRecord(h), `log record holds ${secret}`).not.toContain(secret);
  const emitted = everyEmittedView(h);
  for (const secret of [...NEVER_EMITTED, SECRETS.accountId]) {
    expect(emitted, `emitted view holds ${secret}`).not.toContain(secret);
  }
}

describe('secrets stay out of logs and views', () => {
  it('through a completed sign-in', async () => {
    const h = createHarness();
    h.service.start();

    await h.signedIn();

    expect(h.opened).toEqual([SECRETS.approvalUrl]);
    expect(h.vault.stores).toHaveLength(1);
    expectClean(h);
  });

  it.each([
    [
      'a cancel',
      (h: Harness) => {
        h.service.cancelSignIn();
      },
    ],
    [
      'a decline',
      (h: Harness) => {
        h.listeners.made[0]?.finish({ kind: 'declined' });
      },
    ],
    [
      'a timeout',
      (h: Harness) => {
        h.listeners.made[0]?.finish({ kind: 'timed-out' });
      },
    ],
    [
      'a refused exchange',
      (h: Harness) => {
        h.stub.on('token', { status: 400 });
        h.listeners.made[0]?.finish({ kind: 'code', code: SECRETS.code });
      },
    ],
    [
      'an unreachable exchange',
      (h: Harness) => {
        h.stub.on('token', unreachable);
        h.listeners.made[0]?.finish({ kind: 'code', code: SECRETS.code });
      },
    ],
  ])('through %s', async (_name, finish) => {
    const h = createHarness();
    h.service.start();
    await h.service.signIn();

    finish(h);
    await settle();

    expect(h.service.getView().session).toBe('signed-out');
    expectClean(h);
  });

  it('through a bad URL, a failed bind and a browser that will not open', async () => {
    const badUrl = createHarness();
    badUrl.service.start();
    badUrl.stub.on('signInRequest', { status: 201, body: { approvalUrl: 'http://approve.invalid/x', expiresAt: 'x' } });
    await badUrl.service.signIn();
    expectClean(badUrl);

    const noPort = createHarness();
    noPort.service.start();
    noPort.listeners.failNext();
    await noPort.service.signIn();
    expectClean(noPort);

    const noBrowser = createHarness();
    noBrowser.service.start();
    noBrowser.failOpening();
    await noBrowser.service.signIn();
    expectClean(noBrowser);
  });

  it('through refreshes that succeed, fail, are limited or are unreadable', async () => {
    const h = createHarness({ vault: createFakeVault(session(SECRETS.token)) });
    h.service.start();
    await settle();
    for (const reply of [{ status: 503 }, { status: 429 }, { status: 200, body: { nonsense: true } }, { status: 401 }]) {
      h.stub.on('status', reply);
      await h.clock.advance(3_600_000);
    }

    expect(h.log.events()).toEqual(
      expect.arrayContaining(['status.refresh_failed', 'status.unreadable']),
    );
    expectClean(h);
  });

  it('through a rotation, for both the old and the new token', async () => {
    const h = createHarness({ vault: createFakeVault(session(SECRETS.token, 0)) });
    h.stub.on('status', { status: 503 });
    h.service.start();
    await settle();

    expect(h.stub.calls('rotate')).toHaveLength(1);
    expect(h.vault.held()?.token).toBe(SECRETS.rotatedToken);
    expectClean(h);
  });

  it('through a rotation that is refused and one that signs the player out', async () => {
    for (const reply of [{ status: 409 }, { status: 401 }]) {
      const h = createHarness({ vault: createFakeVault(session(SECRETS.token, 0)) });
      h.stub.on('rotate', reply);
      h.stub.on('status', { status: 503 });
      h.service.start();
      await settle();
      await h.clock.advance(3_600_000);
      h.log.records.push({ scope: 'premium', event: 'checked' });
      expectClean(h);
    }
  });

  it('through a sign-out, including one the API never answers', async () => {
    const h = createHarness({
      vault: createFakeVault(session(SECRETS.token)),
      api: (real) => ({ ...real, signOut: () => Promise.reject(new Error(SECRETS.token)) }),
    });
    h.service.start();
    await settle();

    await h.service.signOut();

    expect(h.log.events()).toContain('signout.unreachable');
    expectClean(h);
  });

  it.each([
    ['linked', { status: 200, body: { outcome: 'linked' } }],
    ['refused', { status: 409, body: { reason: 'steam_mismatch' } }],
    ['failed', { status: 500 }],
  ])('through a report that ends %s, with the account id and SteamID', async (_name, reply) => {
    const h = createHarness({ vault: createFakeVault(session(SECRETS.token)) });
    h.stub.on('report', reply);
    h.service.start();
    await settle();

    expect(h.log.events()).toContain('report.outcome');
    expect(h.service.getView().reportedAccountId).toBe(SECRETS.accountId);
    expectClean(h);
  });

  it('through a report that cannot be sent and one the API turns away', async () => {
    const unreadable = createHarness({ vault: createFakeVault(session(SECRETS.token)) });
    unreadable.identity.current = { accountId: SECRETS.accountId, steamId64: null, playerName: null };
    unreadable.stub.on('status', { status: 503 });
    unreadable.service.start();
    await settle();
    expectClean(unreadable);

    const turnedAway = createHarness({ vault: createFakeVault(session(SECRETS.token)) });
    turnedAway.stub.on('report', { status: 401 });
    turnedAway.stub.on('status', { status: 503 });
    turnedAway.service.start();
    await settle();
    expect(turnedAway.service.getView()).toMatchObject({ session: 'signed-out', ended: 'expired' });
    await turnedAway.service.signIn();
    turnedAway.service.cancelSignIn();
    expectClean(turnedAway);
  });

  it('shows the account id on the view under reportedAccountId and under no other key', async () => {
    const h = createHarness({ vault: createFakeVault(session(SECRETS.token)) });
    h.service.start();
    await settle();

    const view = h.service.getView();
    expect(view.reportedAccountId).toBe(SECRETS.accountId);
    expect(JSON.stringify({ ...view, reportedAccountId: null })).not.toContain(SECRETS.accountId);
  });

  it('through Manage Premium, opened or refused, for the hand-off URL', async () => {
    const h = createHarness({ vault: createFakeVault(session(SECRETS.token)) });
    h.service.start();
    await settle();

    await h.service.manage();
    h.stub.on('handOff', { status: 200, body: { url: 'http://manage.invalid/enter/handoff-fixture-84fd19', expiresAt: 'x' } });
    await h.service.manage();
    h.stub.on('handOff', { status: 401 });
    await h.service.manage();

    expect(h.opened).toEqual([SECRETS.handOffUrl]);
    expect(h.log.events()).toContain('handoff.failed');
    expectClean(h);
  });

  it('logs only literal events under the premium scope', async () => {
    const h = createHarness();
    h.service.start();
    await h.signedIn();

    for (const record of h.log.records) {
      expect(record['scope']).toBe('premium');
      expect(LITERAL_EVENTS).toContain(record['event']);
      for (const value of Object.values(record)) expect(['string', 'number']).toContain(typeof value);
    }
    expect(h.log.records).toContainEqual({ scope: 'premium', event: 'signin.started' });
    expect(h.log.records).toContainEqual({ scope: 'premium', event: 'signin.ended', reason: 'completed' });
  });

  it('logs the reason an attempt ended and nothing else', async () => {
    const h = createHarness();
    h.service.start();
    await h.service.signIn();

    h.service.cancelSignIn();

    expect(h.log.records.at(-1)).toEqual({ scope: 'premium', event: 'signin.ended', reason: 'cancelled' });
  });

  it('never carries a key named for a secret on the view', async () => {
    const h = createHarness();
    await h.signedIn();
    const forbidden = ['token', 'code', 'verifier', 'state', 'url'];

    for (const view of h.views) {
      for (const key of Object.keys(view)) expect(forbidden).not.toContain(key);
    }
  });
});
