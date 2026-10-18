import { describe, expect, it } from 'vitest';
import {
  SECRETS,
  START_MS,
  createFakeVault,
  createHarness,
  deferred,
  session,
  settle,
  unreachable,
  type Harness,
  type HarnessOptions,
  type StubReply,
} from './premium-test-support.js';

async function signedInHarness(options: HarnessOptions = {}, held = session(SECRETS.token)): Promise<Harness> {
  const h = createHarness({ vault: createFakeVault(held), ...options });
  h.service.start();
  await settle();
  return h;
}

describe('Manage Premium', () => {
  it('opens exactly the returned https URL, once, and asks the API with the token', async () => {
    const h = await signedInHarness();

    const result = await h.service.manage();

    expect(result).toEqual({ ok: true });
    expect(h.opened).toEqual([SECRETS.handOffUrl]);
    expect(h.stub.calls('handOff')).toHaveLength(1);
    expect(h.stub.calls('handOff')[0]).toMatchObject({ token: SECRETS.token, body: undefined });
  });

  it('asks for a fresh hand-off on every click', async () => {
    const h = await signedInHarness();
    h.stub.on('handOff', (_request, count) => ({
      status: 200,
      body: { url: `${SECRETS.handOffUrl}-${String(count)}`, expiresAt: 'x' },
    }));

    await h.service.manage();
    await h.service.manage();

    expect(h.opened).toEqual([`${SECRETS.handOffUrl}-1`, `${SECRETS.handOffUrl}-2`]);
  });

  it('rotates first when the token has come due, and asks with the new token', async () => {
    const h = await signedInHarness({}, session(SECRETS.token, START_MS + 1000));
    expect(h.stub.calls('rotate')).toEqual([]);
    await h.clock.advance(1000);

    await h.service.manage();

    expect(h.stub.calls('rotate')).toHaveLength(1);
    expect(h.stub.calls('handOff')[0]?.token).toBe(SECRETS.rotatedToken);
    expect(h.opened).toEqual([SECRETS.handOffUrl]);
  });

  it('opens nothing and says signed-out when nobody is signed in', async () => {
    const h = createHarness();
    h.service.start();
    await settle();

    expect(await h.service.manage()).toEqual({ ok: false, reason: 'signed-out' });
    expect(h.stub.calls('handOff')).toEqual([]);
    expect(h.opened).toEqual([]);
  });
});

describe('a hand-off that cannot be used', () => {
  const urls = ['http://manage.invalid/enter', 'file:///etc/hosts', 'javascript:alert(1)', 'not a url', ''];

  it.each(urls)('refuses to open %j from the API client and logs why', async (url) => {
    const h = await signedInHarness({
      api: (real) => ({ ...real, requestHandOff: () => Promise.resolve({ ok: true, url }) }),
    });

    expect(await h.service.manage()).toEqual({ ok: false, reason: 'failed' });

    expect(h.opened).toEqual([]);
    expect(h.log.records).toContainEqual({ scope: 'premium', event: 'handoff.failed', reason: 'bad-response' });
    expect(h.service.getView().session).toBe('signed-in');
  });

  it('opens nothing when the stub API body carries an http URL', async () => {
    const h = await signedInHarness();
    h.stub.on('handOff', { status: 200, body: { url: 'http://manage.invalid/enter', expiresAt: 'x' } });

    expect(await h.service.manage()).toEqual({ ok: false, reason: 'failed' });
    expect(h.opened).toEqual([]);
  });

  it.each([
    ['an unreadable body', { status: 200, body: { nothing: true } }, 'bad-response'],
    ['a 404', { status: 404 }, 'unreachable'],
    ['a 429', { status: 429 }, 'unreachable'],
    ['a 503', { status: 503 }, 'unreachable'],
    ['a network failure', unreachable, 'unreachable'],
  ] as const)('opens nothing after %s and stays signed in', async (_name, reply, reason) => {
    const h = await signedInHarness();
    h.stub.on('handOff', reply);

    expect(await h.service.manage()).toEqual({ ok: false, reason: 'failed' });

    expect(h.opened).toEqual([]);
    expect(h.log.records).toContainEqual({ scope: 'premium', event: 'handoff.failed', reason });
    expect(h.service.getView()).toMatchObject({ session: 'signed-in', ended: null });
    expect(h.vault.held()).not.toBeNull();
  });

  it('fails when the browser will not open the URL', async () => {
    const h = await signedInHarness();
    h.failOpening();

    expect(await h.service.manage()).toEqual({ ok: false, reason: 'failed' });

    expect(h.log.records).toContainEqual({ scope: 'premium', event: 'handoff.failed', reason: 'browser-unavailable' });
    expect(h.service.getView().session).toBe('signed-in');
  });

  it('signs out on a 401, clearing the token and the cache and reporting the sign-in ended', async () => {
    const h = await signedInHarness();
    h.stub.on('handOff', { status: 401 });

    expect(await h.service.manage()).toEqual({ ok: false, reason: 'signed-out' });

    expect(h.opened).toEqual([]);
    expect(h.service.getView()).toMatchObject({ session: 'signed-out', ended: 'expired', status: null });
    expect(h.vault.held()).toBeNull();
    expect(h.cache.read()).toBeNull();
  });

  it('opens nothing when the player signs out before the answer arrives', async () => {
    const gate = deferred<StubReply>();
    const h = await signedInHarness();
    h.stub.on('handOff', () => gate.promise);

    const pending = h.service.manage();
    await settle();
    await h.service.signOut();
    gate.resolve({ status: 200, body: { url: SECRETS.handOffUrl, expiresAt: 'x' } });

    expect(await pending).toEqual({ ok: false, reason: 'signed-out' });
    expect(h.opened).toEqual([]);
    expect(h.service.getView().session).toBe('signed-out');
  });
});

describe('the returned URL', () => {
  it('is in no log record and no emitted view, whether it was opened or refused', async () => {
    const opened = await signedInHarness();
    await opened.service.manage();
    opened.stub.on('handOff', { status: 503 });
    await opened.service.manage();

    const refused = await signedInHarness({
      api: (real) => ({ ...real, requestHandOff: () => Promise.resolve({ ok: true, url: `http://${SECRETS.handOffUrl}` }) }),
    });
    await refused.service.manage();

    for (const h of [opened, refused]) {
      expect(JSON.stringify(h.log.records)).not.toContain('handoff-fixture');
      expect(JSON.stringify([...h.views, h.service.getView()])).not.toContain('handoff-fixture');
    }
    expect(opened.opened).toEqual([SECRETS.handOffUrl]);
  });
});
