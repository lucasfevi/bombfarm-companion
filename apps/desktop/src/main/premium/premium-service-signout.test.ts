import { PREMIUM_REFRESH_EVERY_MS } from '@bombfarm/contracts';
import { describe, expect, it } from 'vitest';
import {
  ACTIVE_STATUS_BODY,
  SECRETS,
  START_MS,
  createFakeVault,
  createHarness,
  deferred,
  session,
  settle,
  tokenBody,
  unreachable,
  type Harness,
  type StubReply,
} from './premium-test-support.js';

async function signedInHarness(): Promise<Harness> {
  const h = createHarness({ vault: createFakeVault(session(SECRETS.token)) });
  h.service.start();
  await settle();
  expect(h.cache.read()).not.toBeNull();
  return h;
}

describe('signing out', () => {
  it('sends the token to the API first, then clears the token and the cache', async () => {
    const h = await signedInHarness();
    const heldWhenSent: unknown[] = [];
    h.stub.on('signOut', (request) => {
      heldWhenSent.push(request.token, h.vault.held()?.token);
      return { status: 204 };
    });

    const view = await h.service.signOut();

    expect(heldWhenSent).toEqual([SECRETS.token, SECRETS.token]);
    expect(h.stub.calls('signOut')).toHaveLength(1);
    expect(h.vault.held()).toBeNull();
    expect(h.vault.clears).toBe(1);
    expect(h.cache.read()).toBeNull();
    expect(h.cache.clears).toBe(1);
    expect(view).toMatchObject({ session: 'signed-out', ended: null, status: null, me: null, fetchedAt: null });
    expect(h.service.getView()).toEqual(view);
  });

  it.each([
    ['a network failure', unreachable],
    ['a 503', { status: 503 }],
    ['a 401', { status: 401 }],
  ] as const)('clears everything locally when the API answers with %s', async (_name, reply) => {
    const h = await signedInHarness();
    h.stub.on('signOut', reply);

    const view = await h.service.signOut();

    expect(view).toMatchObject({ session: 'signed-out', ended: null });
    expect(h.vault.held()).toBeNull();
    expect(h.cache.read()).toBeNull();
  });

  it('logs that the API could not be reached when the client gives up, and still clears locally', async () => {
    const h = createHarness({
      vault: createFakeVault(session(SECRETS.token)),
      api: (real) => ({ ...real, signOut: () => Promise.reject(new Error('down')) }),
    });
    h.service.start();
    await settle();

    const view = await h.service.signOut();

    expect(view.session).toBe('signed-out');
    expect(h.vault.held()).toBeNull();
    expect(h.log.records).toContainEqual({ scope: 'premium', event: 'signout.unreachable' });
  });

  it('shows signed out at once, before the API has answered', async () => {
    const gate = deferred<StubReply>();
    const h = await signedInHarness();
    h.stub.on('signOut', () => gate.promise);

    const pending = h.service.signOut();
    await settle();

    expect(h.service.getView().session).toBe('signed-out');
    gate.resolve({ status: 204 });
    await pending;
  });

  it('does nothing when already signed out', async () => {
    const h = createHarness();
    h.service.start();
    await settle();

    const view = await h.service.signOut();

    expect(view.session).toBe('signed-out');
    expect(h.stub.calls('signOut')).toEqual([]);
  });

  it('lets the player sign in again afterwards', async () => {
    const h = await signedInHarness();
    await h.service.signOut();

    await h.signedIn();

    expect(h.service.getView()).toMatchObject({ session: 'signed-in', status: { active: false } });
  });
});

describe('signing out during a sign-in', () => {
  it('cancels the attempt first and sends nothing to the API', async () => {
    const h = createHarness();
    h.service.start();
    await h.service.signIn();

    const view = await h.service.signOut();

    expect(h.listeners.made[0]?.closed).toBe(1);
    expect(view).toMatchObject({ session: 'signed-out', lastSignInEnd: 'cancelled' });
    expect(h.stub.calls('signOut')).toEqual([]);
    h.listeners.made[0]?.finish({ kind: 'code', code: SECRETS.code });
    await settle();
    expect(h.stub.calls('token')).toEqual([]);
    expect(h.service.getView().session).toBe('signed-out');
  });
});

describe('an answer that lands after sign-out', () => {
  it('is dropped: a status answer brings back no signed-in state and no cache', async () => {
    const gate = deferred<StubReply>();
    const h = createHarness({ vault: createFakeVault(session(SECRETS.token)) });
    h.stub.on('status', () => gate.promise);
    h.service.start();
    await settle();

    await h.service.signOut();
    gate.resolve({ status: 200, body: ACTIVE_STATUS_BODY });
    await settle();

    expect(h.service.getView()).toMatchObject({ session: 'signed-out', status: null, me: null, fetchedAt: null });
    expect(h.cache.read()).toBeNull();
    expect(h.cache.writes).toEqual([]);
  });

  it('is dropped: a me answer', async () => {
    const gate = deferred<StubReply>();
    const h = createHarness({ vault: createFakeVault(session(SECRETS.token)) });
    h.stub.on('me', () => gate.promise);
    h.service.start();
    await settle();

    await h.service.signOut();
    gate.resolve({ status: 200, body: { v: 1, signInMethods: ['steam'], steamVerified: true, gameAccountLinked: true, admitted: true } });
    await settle();

    expect(h.service.getView()).toMatchObject({ session: 'signed-out', me: null, visible: false });
  });

  it('is dropped: a 401 cannot flag an expiry on the signed-out session', async () => {
    const gate = deferred<StubReply>();
    const h = createHarness({ vault: createFakeVault(session(SECRETS.token)) });
    h.stub.on('status', () => gate.promise);
    h.service.start();
    await settle();

    await h.service.signOut();
    gate.resolve({ status: 401 });
    await settle();

    expect(h.service.getView()).toMatchObject({ session: 'signed-out', ended: null });
  });

  it('is dropped: a rotation, so the discarded token is not stored again', async () => {
    const gate = deferred<StubReply>();
    const h = createHarness({ vault: createFakeVault(session(SECRETS.token, START_MS - 1)) });
    h.stub.on('rotate', () => gate.promise);
    h.service.start();
    await settle();

    await h.service.signOut();
    gate.resolve({ status: 200, body: tokenBody(SECRETS.rotatedToken) });
    await settle();

    expect(h.vault.stores).toEqual([]);
    expect(h.vault.held()).toBeNull();
    expect(h.stub.calls('status')).toEqual([]);
  });

  it('is dropped: a sign-in code exchange from a cancelled attempt', async () => {
    const gate = deferred<StubReply>();
    const h = createHarness();
    h.stub.on('token', () => gate.promise);
    await h.service.signIn();
    h.listeners.made[0]?.finish({ kind: 'code', code: SECRETS.code });
    await settle();

    await h.service.signOut();
    gate.resolve({ status: 200, body: tokenBody(SECRETS.token) });
    await settle();

    expect(h.service.getView().session).toBe('signed-out');
    expect(h.vault.stores).toEqual([]);
  });
});

describe('the hourly timer', () => {
  it('is replaced on sign-out: one timer remains and it fetches visibility only', async () => {
    const h = await signedInHarness();
    expect(h.clock.pending()).toBe(1);

    await h.service.signOut();
    expect(h.clock.pending()).toBe(1);
    await h.clock.advance(PREMIUM_REFRESH_EVERY_MS);

    expect(h.stub.calls('status')).toHaveLength(1);
    expect(h.stub.calls('visibility')).toHaveLength(2);
  });
});
