import { describe, expect, it } from 'vitest';
import {
  ACTIVE_STATUS_BODY,
  INACTIVE_STATUS_BODY,
  SECRETS,
  createFakeListener,
  createFakeVault,
  createHarness,
  deferred,
  session,
  settle,
  type Harness,
  type StubReply,
} from './premium-test-support.js';

const OLD_TOKEN = 'desktop-token-old-5c07a1e2';

async function startedSignedIn(): Promise<Harness> {
  const h = createHarness({ vault: createFakeVault(session(OLD_TOKEN)) });
  h.stub.on('status', { status: 200, body: INACTIVE_STATUS_BODY });
  h.service.start();
  await settle();
  return h;
}

async function acrossReSignIn(h: Harness): Promise<void> {
  await h.service.signOut();
  await h.signedIn();
}

describe('an unreadable game identity while signed out', () => {
  it.each([
    ['no identity at all', null],
    ['an identity without a SteamID', { accountId: SECRETS.accountId, steamId64: null, playerName: null }],
  ])('leaves the report untouched after an account change with %s', async (_name, identity) => {
    const h = createHarness();
    h.identity.current = identity;
    h.service.start();

    h.service.noteAccountChanged();
    await settle();

    expect(h.service.getView()).toMatchObject({ session: 'signed-out', report: null, reportedAccountId: null });
    expect(h.stub.calls('report')).toHaveLength(0);
  });
});

describe('a listener that is still binding', () => {
  it('is closed exactly once when the bind resolves after a cancel', async () => {
    const bind = deferred<ReturnType<typeof createFakeListener>['listener']>();
    const fake = createFakeListener();
    const h = createHarness({ listener: () => () => bind.promise });

    const pending = h.service.signIn();
    expect(h.service.cancelSignIn()).toBe(true);
    bind.resolve(fake.listener);
    await pending;
    await settle();

    expect(fake.closed).toBe(1);
    expect(h.service.getView()).toMatchObject({ session: 'signed-out', lastSignInEnd: 'cancelled' });
    expect(h.stub.calls('signInRequest')).toHaveLength(0);
  });

  it('is closed exactly once when the bind resolves after the service stops', async () => {
    const bind = deferred<ReturnType<typeof createFakeListener>['listener']>();
    const fake = createFakeListener();
    const h = createHarness({ listener: () => () => bind.promise });
    h.service.start();

    const pending = h.service.signIn();
    h.service.stop();
    bind.resolve(fake.listener);
    await pending;
    await settle();

    expect(fake.closed).toBe(1);
    expect(h.stub.calls('signInRequest')).toHaveLength(0);
  });
});

describe('answers that belong to an earlier sign-in', () => {
  it('does not sign the new session out on a 401 for a request started before the sign-out', async () => {
    const gate = deferred<StubReply>();
    const h = createHarness({ vault: createFakeVault(session(OLD_TOKEN)) });
    h.stub.on('status', (_request, count) => (count === 1 ? gate.promise : { status: 200, body: ACTIVE_STATUS_BODY }));
    h.service.start();
    await settle();

    await acrossReSignIn(h);
    gate.resolve({ status: 401 });
    await settle();

    expect(h.service.getView()).toMatchObject({ session: 'signed-in', ended: null });
    expect(h.vault.held()?.token).toBe(SECRETS.token);
  });

  it('fetches again for the new session with its own token instead of reusing the fetch in flight', async () => {
    const gate = deferred<StubReply>();
    const h = createHarness({ vault: createFakeVault(session(OLD_TOKEN)) });
    h.stub.on('status', (_request, count) => (count === 1 ? gate.promise : { status: 200, body: ACTIVE_STATUS_BODY }));
    h.service.start();
    await settle();

    await acrossReSignIn(h);

    expect(h.stub.calls('status').map((request) => request.token)).toEqual([OLD_TOKEN, SECRETS.token]);
    expect(h.service.getView().status?.active).toBe(true);

    gate.resolve({ status: 200, body: INACTIVE_STATUS_BODY });
    await settle();

    expect(h.service.getView().status?.active).toBe(true);
  });
});

describe('after the service stops', () => {
  it('refuses a refresh and sends nothing', async () => {
    const h = await startedSignedIn();
    const before = h.stub.requests.length;
    h.service.stop();

    expect(await h.service.refresh('button')).toEqual({ ok: false, reason: 'unavailable' });
    expect(h.stub.requests).toHaveLength(before);
  });

  it('refuses Manage Premium, sends nothing and opens nothing', async () => {
    const h = await startedSignedIn();
    const before = h.stub.requests.length;
    h.service.stop();

    expect(await h.service.manage()).toEqual({ ok: false, reason: 'unavailable' });
    expect(h.stub.requests).toHaveLength(before);
    expect(h.opened).toEqual([]);
  });

  it('does not report a changed game account', async () => {
    const h = await startedSignedIn();
    expect(h.stub.calls('report')).toHaveLength(1);
    h.service.stop();

    h.identity.current = { accountId: 'account-fixture-9921', steamId64: '76561198099999999', playerName: null };
    h.service.noteAccountChanged();
    await settle();

    expect(h.stub.calls('report')).toHaveLength(1);
  });
});
