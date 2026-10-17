import http from 'node:http';
import net from 'node:net';
import { describe, expect, it, vi } from 'vitest';
import { PREMIUM_SIGN_IN_TIMEOUT_MS } from '@bombfarm/contracts';
import { startLoopbackListener } from './loopback-listener.js';
import {
  REDIRECT_URI,
  SECRETS,
  createFakeVault,
  createHarness,
  deferred,
  session,
  settle,
  unreachable,
} from './premium-test-support.js';

function lastView(h: ReturnType<typeof createHarness>) {
  return h.service.getView();
}

function get(url: string): Promise<number> {
  return new Promise((resolve, reject) => {
    http
      .get(url, { agent: false }, (res) => {
        res.resume();
        res.on('end', () => {
          resolve(res.statusCode ?? 0);
        });
      })
      .on('error', reject);
  });
}

function connectOnce(uri: string): Promise<'refused' | 'connected'> {
  const url = new URL(uri);
  return new Promise((resolve) => {
    const socket = net.connect({ host: url.hostname, port: Number(url.port) });
    socket.once('connect', () => {
      socket.destroy();
      resolve('connected');
    });
    socket.once('error', () => {
      resolve('refused');
    });
  });
}

describe('starting up', () => {
  it('is signed out with nothing stored', () => {
    const h = createHarness();
    h.service.start();
    expect(lastView(h).session).toBe('signed-out');
  });

  it('is signed in when the vault holds a token', () => {
    const h = createHarness({ vault: createFakeVault(session(SECRETS.token)) });
    h.service.start();
    expect(lastView(h)).toMatchObject({ session: 'signed-in', rememberedAcrossRestarts: true });
  });
});

describe('starting a sign-in', () => {
  it('sends the challenge, S256, state and a 127.0.0.1 callback redirect, then opens the returned URL', async () => {
    const h = createHarness();
    h.stub.on('signInRequest', (_request) => {
      expect(h.listeners.made).toHaveLength(1);
      return { status: 201, body: { approvalUrl: SECRETS.approvalUrl, expiresAt: '2026-10-20T12:10:00.000Z' } };
    });

    const result = await h.service.signIn();

    expect(result).toEqual({ ok: true });
    expect(h.stub.calls('signInRequest').map((request) => request.body)).toEqual([
      { codeChallenge: 'challenge-fixture', codeChallengeMethod: 'S256', redirectUri: REDIRECT_URI, state: SECRETS.state },
    ]);
    expect(REDIRECT_URI).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/callback$/);
    expect(h.opened).toEqual([SECRETS.approvalUrl]);
    expect(h.listeners.options).toEqual([{ expectedState: SECRETS.state, timeoutMs: PREMIUM_SIGN_IN_TIMEOUT_MS }]);
    expect(lastView(h).session).toBe('signing-in');
  });

  it('shows signing-in at once and clears the previous attempt end and expiry', async () => {
    const h = createHarness();
    h.listeners.failNext();
    await h.service.signIn();
    expect(lastView(h).lastSignInEnd).toBe('port-unavailable');

    await h.service.signIn();
    expect(lastView(h)).toMatchObject({ session: 'signing-in', lastSignInEnd: null, ended: null });
  });

  it('refuses a second sign-in while one runs, without a second listener', async () => {
    const h = createHarness();
    await h.service.signIn();

    const second = await h.service.signIn();

    expect(second).toEqual({ ok: false, reason: 'already-signing-in' });
    expect(h.listeners.options).toHaveLength(1);
    expect(h.stub.calls('signInRequest')).toHaveLength(1);
  });

  it('refuses a sign-in when already signed in', async () => {
    const h = createHarness();
    await h.signedIn();

    expect(await h.service.signIn()).toEqual({ ok: false, reason: 'already-signed-in' });
    expect(h.listeners.options).toHaveLength(1);
  });

  it('refuses two sign-ins pressed in the same tick', async () => {
    const h = createHarness();
    const [first, second] = await Promise.all([h.service.signIn(), h.service.signIn()]);

    expect(first).toEqual({ ok: true });
    expect(second).toEqual({ ok: false, reason: 'already-signing-in' });
    expect(h.listeners.options).toHaveLength(1);
  });
});

describe('a returned URL that is not https', () => {
  const urls = ['http://approve.invalid/start', 'file:///etc/hosts', 'javascript:alert(1)', 'not a url', ''];

  it.each(urls)('refuses to open %j from the API client and closes the listener', async (approvalUrl) => {
    const h = createHarness({
      api: (real) => ({ ...real, requestSignIn: () => Promise.resolve({ ok: true, approvalUrl }) }),
    });

    const result = await h.service.signIn();

    expect(result).toEqual({ ok: false, reason: 'failed' });
    expect(h.opened).toEqual([]);
    expect(h.listeners.made[0]?.closed).toBe(1);
    expect(lastView(h)).toMatchObject({ session: 'signed-out', lastSignInEnd: 'bad-response' });
  });

  it('ends as bad-response when the stub API body carries an http URL', async () => {
    const h = createHarness();
    h.stub.on('signInRequest', { status: 201, body: { approvalUrl: 'http://approve.invalid/start', expiresAt: 'x' } });

    await h.service.signIn();

    expect(h.opened).toEqual([]);
    expect(h.listeners.made[0]?.closed).toBe(1);
    expect(lastView(h).lastSignInEnd).toBe('bad-response');
  });
});

describe('the callback', () => {
  it('exchanges the code with the same verifier and redirect', async () => {
    const h = createHarness();
    await h.service.signIn();

    h.listeners.made[0]?.finish({ kind: 'code', code: SECRETS.code });
    await settle();

    expect(h.stub.calls('token').map((request) => request.body)).toEqual([
      { code: SECRETS.code, codeVerifier: SECRETS.verifier, redirectUri: REDIRECT_URI },
    ]);
  });

  it('becomes signed in and stores the granted session in the vault', async () => {
    const h = createHarness();
    await h.service.signIn();

    h.listeners.made[0]?.finish({ kind: 'code', code: SECRETS.code });
    await settle();

    expect(h.vault.stores).toEqual([session(SECRETS.token)]);
    expect(lastView(h)).toMatchObject({
      session: 'signed-in',
      rememberedAcrossRestarts: true,
      lastSignInEnd: null,
      ended: null,
    });
    expect(h.listeners.made[0]?.closed).toBe(0);
  });

  it('says the sign-in is not remembered when the vault keeps it in memory only', async () => {
    const h = createHarness({ vault: createFakeVault(null, 'memory-only') });

    await h.signedIn();

    expect(lastView(h)).toMatchObject({ session: 'signed-in', rememberedAcrossRestarts: false });
  });

  it('ends as declined when the player declined on the website', async () => {
    const h = createHarness();
    await h.service.signIn();

    h.listeners.made[0]?.finish({ kind: 'declined' });
    await settle();

    expect(lastView(h)).toMatchObject({ session: 'signed-out', lastSignInEnd: 'declined' });
    expect(h.stub.calls('token')).toEqual([]);
  });

  it('ends as timed-out when the listener reports its timeout', async () => {
    const h = createHarness();
    await h.service.signIn();

    h.listeners.made[0]?.finish({ kind: 'timed-out' });
    await settle();

    expect(lastView(h)).toMatchObject({ session: 'signed-out', lastSignInEnd: 'timed-out' });
  });
});

describe('cancelling', () => {
  it('closes the listener at once and ends as cancelled', async () => {
    const h = createHarness();
    await h.service.signIn();

    expect(h.service.cancelSignIn()).toBe(true);

    expect(h.listeners.made[0]?.closed).toBe(1);
    expect(lastView(h)).toMatchObject({ session: 'signed-out', lastSignInEnd: 'cancelled' });
    await settle();
    expect(h.stub.calls('token')).toEqual([]);
    expect(lastView(h).lastSignInEnd).toBe('cancelled');
  });

  it('says nothing was running when there is no attempt', () => {
    const h = createHarness();
    expect(h.service.cancelSignIn()).toBe(false);
  });

  it('drops a sign-in request that answers after the cancel', async () => {
    const h = createHarness();
    const gate = deferred<{ status: number; body: unknown }>();
    h.stub.on('signInRequest', () => gate.promise);

    const pending = h.service.signIn();
    await settle();
    expect(h.service.cancelSignIn()).toBe(true);
    gate.resolve({ status: 201, body: { approvalUrl: SECRETS.approvalUrl, expiresAt: 'x' } });
    const result = await pending;

    expect(result).toEqual({ ok: false, reason: 'failed' });
    expect(h.opened).toEqual([]);
    expect(lastView(h)).toMatchObject({ session: 'signed-out', lastSignInEnd: 'cancelled' });
  });

  it('drops a code exchange that answers after the cancel', async () => {
    const h = createHarness();
    const gate = deferred<{ status: number; body: unknown }>();
    h.stub.on('token', () => gate.promise);
    await h.service.signIn();
    h.listeners.made[0]?.finish({ kind: 'code', code: SECRETS.code });
    await settle();

    h.service.cancelSignIn();
    gate.resolve({ status: 200, body: { token: SECRETS.token, expiresAt: 'x', rotateAfter: 'y' } });
    await settle();

    expect(h.vault.stores).toEqual([]);
    expect(lastView(h).session).toBe('signed-out');
  });
});

describe('failures', () => {
  it.each([
    ['400', { status: 400 }, 'refused'],
    ['503', { status: 503 }, 'unreachable'],
    ['429', { status: 429 }, 'unreachable'],
    ['404', { status: 404 }, 'unreachable'],
    ['an unreadable body', { status: 201, body: { nothing: true } }, 'bad-response'],
  ] as const)('ends as %s when the sign-in request answers that', async (_name, reply, reason) => {
    const h = createHarness();
    h.stub.on('signInRequest', reply);

    const result = await h.service.signIn();

    expect(result).toEqual({ ok: false, reason: 'failed' });
    expect(lastView(h)).toMatchObject({ session: 'signed-out', lastSignInEnd: reason });
    expect(h.opened).toEqual([]);
    expect(h.listeners.made[0]?.closed).toBe(1);
  });

  it('ends as unreachable when the sign-in request cannot be sent', async () => {
    const h = createHarness();
    h.stub.on('signInRequest', unreachable);

    await h.service.signIn();

    expect(lastView(h).lastSignInEnd).toBe('unreachable');
  });

  it.each([
    ['400', { status: 400 }, 'refused'],
    ['503', { status: 503 }, 'unreachable'],
    ['429', { status: 429 }, 'unreachable'],
    ['an unreadable body', { status: 200, body: { token: 1 } }, 'bad-response'],
  ] as const)('ends as %s when the code exchange answers that', async (_name, reply, reason) => {
    const h = createHarness();
    h.stub.on('token', reply);
    await h.service.signIn();

    h.listeners.made[0]?.finish({ kind: 'code', code: SECRETS.code });
    await settle();

    expect(lastView(h)).toMatchObject({ session: 'signed-out', lastSignInEnd: reason });
    expect(h.vault.stores).toEqual([]);
  });

  it('ends as port-unavailable and contacts the API not at all when the listener cannot bind', async () => {
    const h = createHarness();
    h.listeners.failNext();

    const result = await h.service.signIn();

    expect(result).toEqual({ ok: false, reason: 'failed' });
    expect(h.stub.requests).toEqual([]);
    expect(h.opened).toEqual([]);
    expect(lastView(h)).toMatchObject({ session: 'signed-out', lastSignInEnd: 'port-unavailable' });
  });

  it('ends as browser-unavailable and closes the listener when the browser will not open', async () => {
    const h = createHarness();
    h.failOpening();

    const result = await h.service.signIn();

    expect(result).toEqual({ ok: false, reason: 'failed' });
    expect(h.listeners.made[0]?.closed).toBe(1);
    expect(lastView(h)).toMatchObject({ session: 'signed-out', lastSignInEnd: 'browser-unavailable' });
  });
});

describe('stopping', () => {
  it('closes a live listener', async () => {
    const h = createHarness();
    h.service.start();
    await h.service.signIn();

    h.service.stop();

    expect(h.listeners.made[0]?.closed).toBe(1);
  });

  it('emits nothing after stop', async () => {
    const h = createHarness();
    h.service.start();
    await h.service.signIn();
    const before = h.views.length;

    h.service.stop();
    await settle();

    expect(h.views).toHaveLength(before);
  });
});

describe('with the real listener', () => {
  function withRealListener() {
    return createHarness({
      listener: (clock) => (options) => startLoopbackListener({ ...options, scheduler: clock.scheduler }),
    });
  }

  function redirectOf(h: ReturnType<typeof createHarness>): { redirectUri: string; state: string } {
    return h.stub.calls('signInRequest')[0]?.body as { redirectUri: string; state: string };
  }

  it('signs in when the browser follows the redirect to the loopback with the state and a code', async () => {
    const h = withRealListener();
    await h.service.signIn();
    const redirect = redirectOf(h);
    expect(redirect.redirectUri).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/callback$/);

    const status = await get(`${redirect.redirectUri}?code=${SECRETS.code}&state=${redirect.state}`);
    await waitForSession(h, 'signed-in');

    expect(status).toBe(200);
    expect(h.stub.calls('token')[0]?.body).toEqual({
      code: SECRETS.code,
      codeVerifier: SECRETS.verifier,
      redirectUri: redirect.redirectUri,
    });
  });

  it('times out after five minutes on the fake clock and closes the port', async () => {
    const h = withRealListener();
    await h.service.signIn();
    const { redirectUri } = redirectOf(h);

    await h.clock.advance(PREMIUM_SIGN_IN_TIMEOUT_MS - 1);
    expect(h.service.getView().session).toBe('signing-in');
    await h.clock.advance(1);

    expect(h.service.getView()).toMatchObject({ session: 'signed-out', lastSignInEnd: 'timed-out' });
    expect(await connectOnce(redirectUri)).toBe('refused');
  });

  it('closes the port at once on cancel, so a later callback finds nothing listening', async () => {
    const h = withRealListener();
    await h.service.signIn();
    const { redirectUri, state } = redirectOf(h);

    h.service.cancelSignIn();

    expect(await connectOnce(redirectUri)).toBe('refused');
    await expect(get(`${redirectUri}?code=late&state=${state}`)).rejects.toThrow();
    expect(h.service.getView().lastSignInEnd).toBe('cancelled');
  });
});

async function waitForSession(h: ReturnType<typeof createHarness>, wanted: string): Promise<void> {
  await vi.waitFor(() => {
    expect(h.service.getView().session).toBe(wanted);
  });
}
