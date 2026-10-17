import { describe, expect, it } from 'vitest';
import { SECRETS, createHarness, settle, unreachable, type Harness } from './premium-test-support.js';

const NEVER_LOGGED_OR_EMITTED = [
  SECRETS.token,
  SECRETS.rotatedToken,
  SECRETS.verifier,
  SECRETS.state,
  SECRETS.code,
  SECRETS.approvalUrl,
  SECRETS.handOffUrl,
];

const NEVER_LOGGED = [...NEVER_LOGGED_OR_EMITTED, SECRETS.accountId, SECRETS.steamId64];

function everyLogRecord(h: Harness): string {
  return JSON.stringify(h.log.records);
}

function everyEmittedView(h: Harness): string {
  return JSON.stringify([...h.views, h.service.getView()]);
}

function expectClean(h: Harness): void {
  expect(h.log.records.length).toBeGreaterThan(0);
  expect(h.views.length).toBeGreaterThan(0);
  for (const secret of NEVER_LOGGED) expect(everyLogRecord(h), `log record holds ${secret}`).not.toContain(secret);
  for (const secret of NEVER_LOGGED_OR_EMITTED) {
    expect(everyEmittedView(h), `emitted view holds ${secret}`).not.toContain(secret);
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

  it('logs only literal events under the premium scope', async () => {
    const h = createHarness();
    h.service.start();
    await h.signedIn();

    for (const record of h.log.records) {
      expect(record['scope']).toBe('premium');
      expect(['signin.started', 'signin.ended']).toContain(record['event']);
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
