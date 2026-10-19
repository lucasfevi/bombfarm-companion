import { describe, expect, it } from 'vitest';
import {
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

const DAY = 86_400_000;

function due(): ReturnType<typeof session> {
  return session(SECRETS.token, START_MS - 1000);
}

function startWith(held: ReturnType<typeof session>, memoryOnly = false): Harness {
  const h = createHarness({ vault: createFakeVault(held, memoryOnly ? 'memory-only' : 'persisted') });
  return h;
}

function order(h: Harness): string[] {
  return h.stub.requests.map((request) => request.path);
}

describe('rotating the session', () => {
  it('rotates before the first bearer call after rotateAfter and stores the new session in one write', async () => {
    const h = startWith(due());
    h.service.start();
    await settle();

    expect(h.stub.calls('rotate').map((request) => request.token)).toEqual([SECRETS.token]);
    expect(order(h).indexOf('rotate')).toBeLessThan(order(h).indexOf('status'));
    expect(order(h).indexOf('rotate')).toBeLessThan(order(h).indexOf('me'));
    expect(h.stub.calls('status')[0]?.token).toBe(SECRETS.rotatedToken);
    expect(h.stub.calls('me')[0]?.token).toBe(SECRETS.rotatedToken);
    expect(h.vault.stores).toEqual([session(SECRETS.rotatedToken, START_MS + 2 * DAY)]);
    expect(h.vault.held()?.token).toBe(SECRETS.rotatedToken);
    expect(h.service.getView()).toMatchObject({ session: 'signed-in', rememberedAcrossRestarts: true });
  });

  it('makes no rotate call before rotateAfter', async () => {
    const h = startWith(session(SECRETS.token, START_MS + 1000));
    h.service.start();
    await settle();

    expect(h.stub.calls('rotate')).toEqual([]);
    expect(h.stub.calls('status')[0]?.token).toBe(SECRETS.token);
    expect(h.vault.stores).toEqual([]);
  });

  it('rotates when the clock is exactly at rotateAfter', async () => {
    const h = startWith(session(SECRETS.token, START_MS));
    h.service.start();
    await settle();

    expect(h.stub.calls('rotate')).toHaveLength(1);
  });

  it('does not rotate on a rotateAfter it cannot read', async () => {
    const held = { ...session(SECRETS.token), rotateAfter: 'not a date' };
    const h = startWith(held);
    h.service.start();
    await settle();

    expect(h.stub.calls('rotate')).toEqual([]);
    expect(h.stub.calls('status')[0]?.token).toBe(SECRETS.token);
  });

  it('causes one rotation when two calls arrive at once', async () => {
    const gate = deferred<StubReply>();
    const h = startWith(due());
    h.stub.on('rotate', () => gate.promise);
    h.service.start();
    await settle();

    expect(h.stub.calls('rotate')).toHaveLength(1);
    expect(h.stub.calls('status')).toEqual([]);
    expect(h.stub.calls('me')).toEqual([]);

    gate.resolve({ status: 200, body: tokenBody(SECRETS.rotatedToken, START_MS + 2 * DAY) });
    await settle();

    expect(h.stub.calls('rotate')).toHaveLength(1);
    expect(h.stub.calls('status')[0]?.token).toBe(SECRETS.rotatedToken);
    expect(h.stub.calls('me')[0]?.token).toBe(SECRETS.rotatedToken);
  });

  it('does not rotate again until the new rotateAfter, then rotates once more', async () => {
    const h = startWith(due());
    h.service.start();
    await settle();

    await h.clock.advance(3_600_000);
    expect(h.stub.calls('rotate')).toHaveLength(1);
    expect(h.stub.calls('status')).toHaveLength(2);

    await h.clock.advance(2 * DAY - 3_600_000);
    expect(h.stub.calls('rotate')).toHaveLength(2);
    expect(h.stub.calls('rotate')[1]?.token).toBe(SECRETS.rotatedToken);
  });
});

describe('a rotation that does not produce a new token', () => {
  it('keeps the held token on a 409 and carries on with it', async () => {
    const h = startWith(due());
    h.stub.on('rotate', { status: 409 });
    h.service.start();
    await settle();

    expect(h.stub.calls('status')[0]?.token).toBe(SECRETS.token);
    expect(h.vault.stores).toEqual([]);
    expect(h.vault.held()).toEqual(due());
    expect(h.service.getView()).toMatchObject({ session: 'signed-in', lastRefreshFailed: false });
  });

  it('signs out on a 401, clearing the token and the cache and asking nothing else of the API', async () => {
    const h = startWith(due());
    h.stub.on('rotate', { status: 401 });
    h.service.start();
    await settle();

    expect(h.service.getView()).toMatchObject({ session: 'signed-out', ended: 'expired', status: null });
    expect(h.vault.held()).toBeNull();
    expect(h.cache.clears).toBe(1);
    expect(h.stub.calls('status')).toEqual([]);
    expect(h.stub.calls('me')).toEqual([]);
  });

  it.each([
    ['a 503', { status: 503 }],
    ['a 429', { status: 429 }],
    ['an unreadable body', { status: 200, body: { token: 'x' } }],
    ['a network failure', unreachable],
  ] as const)('carries on with the held token after %s and tries again on the next call', async (_name, reply) => {
    const h = startWith(due());
    h.stub.on('rotate', reply);
    h.service.start();
    await settle();

    expect(h.stub.calls('status')[0]?.token).toBe(SECRETS.token);
    expect(h.vault.stores).toEqual([]);
    expect(h.service.getView().session).toBe('signed-in');

    await h.clock.advance(3_600_000);
    expect(h.stub.calls('rotate')).toHaveLength(2);
  });

  it('drops a rotation that answers after the service stopped', async () => {
    const gate = deferred<StubReply>();
    const h = startWith(due());
    h.stub.on('rotate', () => gate.promise);
    h.service.start();
    await settle();

    h.service.stop();
    gate.resolve({ status: 200, body: tokenBody(SECRETS.rotatedToken) });
    await settle();

    expect(h.vault.stores).toEqual([]);
    expect(h.stub.calls('status')).toEqual([]);
  });
});

describe('a session that cannot be remembered', () => {
  it('rotates in memory, uses the new token and says it is not remembered', async () => {
    const h = startWith(due(), true);
    h.service.start();
    await settle();

    expect(h.vault.stores).toEqual([session(SECRETS.rotatedToken, START_MS + 2 * DAY)]);
    expect(h.stub.calls('status')[0]?.token).toBe(SECRETS.rotatedToken);
    expect(h.service.getView()).toMatchObject({ session: 'signed-in', rememberedAcrossRestarts: false });

    await h.clock.advance(3_600_000);
    expect(h.stub.calls('status')[1]?.token).toBe(SECRETS.rotatedToken);
    expect(h.stub.calls('rotate')).toHaveLength(1);
  });
});
