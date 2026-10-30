import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({ net: { fetch: vi.fn() } }));

import { SECRETS, deferred, settle, type StubReply } from '../premium-test-support.js';
import {
  MINUTE,
  OTHER_USER,
  PAIR,
  createLicenceHarness,
  keyIdOf,
  signedLease,
  stampOf,
  type LicenceHarness,
  present,
} from './licence-test-support.js';

const renewals = (h: LicenceHarness) => h.licenceRequests().filter((request) => request.path === 'lease');

/** A holder that has restarted, so the first renewal is the only request at the start of the clock. */
async function restartedHolder(): Promise<{ h: LicenceHarness; t0: number }> {
  const h = createLicenceHarness();
  h.scriptHolder();
  await h.boot();
  await h.premium.clock.advance(0);
  const t0 = h.premium.clock.now();
  h.premium.stub.requests.length = 0;
  await h.restart();
  return { h, t0 };
}

describe('renewal rhythm', () => {
  it('renews at 0, 15 and 30 minutes', async () => {
    const { h, t0 } = await restartedHolder();
    const times: number[] = [];
    h.premium.stub.on('lease', (request) => {
      times.push(h.premium.clock.now());
      return h.lease(request);
    });
    h.premium.stub.requests.length = 0;
    await h.restart();

    await h.premium.clock.advance(31 * MINUTE);

    expect(times.map((at) => (at - t0) / MINUTE)).toEqual([0, 15, 30]);
  });

  it('after a failure at 30 minutes retries at 31, 33 and 38, then goes back to every 15', async () => {
    const h = createLicenceHarness();
    h.scriptHolder();
    await h.boot();
    const times: number[] = [];
    let calls = 0;
    h.premium.stub.on('lease', (request) => {
      times.push(h.premium.clock.now());
      calls += 1;
      return calls >= 3 && calls <= 5 ? { status: 503, body: { reason: 'busy' } } : h.lease(request);
    });
    h.premium.stub.requests.length = 0;
    await h.restart();
    const t0 = present(times[0]);

    await h.premium.clock.advance(54 * MINUTE);

    expect(times.map((at) => (at - t0) / MINUTE)).toEqual([0, 15, 30, 31, 33, 38, 53]);
  });

  it('honours Retry-After when it is longer than the schedule', async () => {
    const { h } = await restartedHolder();
    const times: number[] = [];
    h.premium.stub.on('lease', () => {
      times.push(h.premium.clock.now());
      return { status: 429, retryAfterSec: 300 };
    });
    await h.restart();
    const t0 = present(times[0]);

    await h.premium.clock.advance(6 * MINUTE);

    expect(times.map((at) => (at - t0) / MINUTE)).toEqual([0, 5]);
  });

  it('sends the pair, the fingerprint and the bundle facts with the bearer and a device signature', async () => {
    const { h } = await restartedHolder();
    if (h.stubRemoval !== null) h.stubRemoval.sequence = 7;

    await h.restart();

    const request = present(renewals(h).at(-1));
    expect(request.token).toBe(SECRETS.token);
    expect(request.device).toMatch(/^[A-Za-z0-9_-]{43}\.\d+\.[A-Za-z0-9_-]+$/);
    expect(request.body).toEqual({
      playing: PAIR,
      fingerprint: expect.stringMatching(/^[0-9a-f]{64}$/) as unknown,
      bundle: { sequence: 7, hostApi: '1.0.0', appVersion: '9.9.9', flavor: 'dev' },
    });
  });

  it('sends one renewal at once when the playing pair changes once linked, with the new pair', async () => {
    const { h } = await restartedHolder();
    await h.premium.clock.advance(0);
    const before = renewals(h).length;
    const other = { accountId: 'account-other-0002', steamId64: '76561198000000002' };

    h.premium.identity.current = { ...other, playerName: null };
    h.premium.service.noteAccountChanged();
    await settle();

    expect(renewals(h)).toHaveLength(before + 1);
    expect(present(renewals(h).at(-1)).body).toMatchObject({ playing: other });
  });

  it('sends one renewal for two triggers in the same second', async () => {
    const { h } = await restartedHolder();
    await h.premium.clock.advance(0);
    const before = renewals(h).length;
    let release: (reply: StubReply) => void = () => undefined;
    h.premium.stub.on(
      'lease',
      () =>
        new Promise<StubReply>((resolve) => {
          release = resolve;
        }),
    );

    h.licence.trigger('resume');
    h.licence.trigger('refresh');
    await settle();
    expect(renewals(h)).toHaveLength(before + 1);
    release({ status: 503 });
    await settle();

    expect(renewals(h)).toHaveLength(before + 1);
  });
});

describe('renewal answers', () => {
  it('discards an answer that lands after sign-out and seals nothing', async () => {
    const { h } = await restartedHolder();
    const late = deferred<StubReply>();
    h.premium.stub.on('lease', () => late.promise);
    const sealed = h.store.leaseWrites.length;
    await h.restart();

    await h.premium.service.signOut();
    late.resolve(h.lease(present(renewals(h).at(-1))));
    await settle();

    expect(h.licence.view().state).toBe('signed_out');
    expect(h.store.leaseWrites).toHaveLength(sealed);
    expect(h.gate.allows()).toBe(false);
  });

  it('ends the session through the existing path on a bearer 401', async () => {
    const { h } = await restartedHolder();
    h.premium.stub.on('lease', { status: 401 });

    await h.restart();

    expect(h.premium.service.getView()).toMatchObject({ session: 'signed-out', ended: 'expired' });
    expect(h.licence.view().state).toBe('signed_out');
  });

  it('corrects a ten-minute clock skew through the Date header after a device-signature 401', async () => {
    const { h } = await restartedHolder();
    const stamps: Array<{ at: number; stamp: number }> = [];
    let skewed = true;
    h.premium.stub.on('lease', (request) => {
      stamps.push({ at: h.premium.clock.now(), stamp: stampOf(request) });
      if (!skewed) return h.lease(request);
      skewed = false;
      return { status: 401, body: { reason: 'device_signature' }, dateMs: h.premium.clock.now() + 10 * MINUTE };
    });

    await h.restart();
    expect(h.licence.view()).toMatchObject({ state: 'unconfirmed', reason: 'device_signature' });
    await h.premium.clock.advance(MINUTE);

    expect(stamps).toHaveLength(2);
    expect(present(stamps[0]).stamp).toBe(Math.floor(present(stamps[0]).at / 1000));
    expect(present(stamps[1]).stamp).toBe(Math.floor((present(stamps[1]).at + 10 * MINUTE) / 1000));
    expect(h.licence.view().state).toBe('holds');
  });

  it('counts a Lease that fails a check as a failed renewal and logs only the check name', async () => {
    const { h } = await restartedHolder();
    h.premium.stub.requests.length = 0;
    h.premium.log.records.length = 0;
    h.premium.stub.on('lease', (request) => ({
      status: 200,
      body: signedLease({ deviceKeyId: keyIdOf(request), issuedAtMs: h.premium.clock.now(), user: OTHER_USER }),
    }));

    await h.restart();

    const rejected = h.premium.log.records.filter((record) => record['event'] === 'premium.lease_rejected');
    expect(rejected).toEqual([{ scope: 'premium', event: 'premium.lease_rejected', check: 'user' }]);
    expect(h.licence.view()).toMatchObject({ state: 'unconfirmed', reason: 'lease_invalid' });
    await h.premium.clock.advance(MINUTE);
    expect(renewals(h)).toHaveLength(2);
  });

  it('logs state changes with the state and reason only', async () => {
    const h = createLicenceHarness();
    h.scriptHolder();
    h.premium.stub.on('licenceActivate', { status: 503, body: { reason: 'busy' } });

    await h.boot();

    const states = h.premium.log.records.filter((record) => record['event'] === 'premium.licence_state');
    expect(states.length).toBeGreaterThan(0);
    for (const record of states) {
      expect(Object.keys(record).sort()).toEqual(
        record['reason'] === undefined ? ['event', 'scope', 'state'] : ['event', 'reason', 'scope', 'state'],
      );
    }
    expect(states.at(-1)).toMatchObject({ scope: 'premium', state: 'unconfirmed', reason: 'network' });
  });
});

describe('the lease gate', () => {
  it('is false after a restart until the first renewal of the run succeeds', async () => {
    const { h } = await restartedHolder();
    const pending = deferred<StubReply>();
    h.premium.stub.on('lease', () => pending.promise);

    await h.restart();
    expect(h.gate.allows()).toBe(false);
    pending.resolve(h.lease(present(renewals(h).at(-1))));
    await settle();

    expect(h.gate.allows()).toBe(true);
  });

  it('opens after a renewal and closes exactly at minute 60 when nothing renews', async () => {
    const { h } = await restartedHolder();
    let calls = 0;
    h.premium.stub.on('lease', (request) => {
      calls += 1;
      return calls === 1 ? h.lease(request) : { status: 503, body: { reason: 'busy' } };
    });
    await h.restart();
    expect(h.gate.allows()).toBe(true);

    await h.premium.clock.advance(60 * MINUTE - 1);
    expect(h.gate.allows()).toBe(true);
    await h.premium.clock.advance(1);

    expect(h.gate.allows()).toBe(false);
    expect(h.licence.view().state).toBe('unconfirmed');
    expect(h.gateHistory.at(-1)).toEqual([false, 'unconfirmed']);
  });

  it('flips false in the same tick the playing pair changes, before the stub sees a request', async () => {
    const { h } = await restartedHolder();
    await h.premium.clock.advance(0);
    expect(h.gate.allows()).toBe(true);
    const before = h.premium.stub.requests.length;
    let gateAtRequest: boolean | null = null;
    h.premium.stub.on('lease', (request) => {
      gateAtRequest = h.gate.allows();
      return h.lease(request, { playing: { accountId: 'account-other-0002', steamId64: '76561198000000002' } });
    });

    h.premium.identity.current = { accountId: 'account-other-0002', steamId64: '76561198000000002', playerName: null };
    h.premium.service.noteAccountChanged();

    expect(h.gate.allows()).toBe(false);
    expect(h.premium.stub.requests).toHaveLength(before);
    await settle();
    expect(gateAtRequest).toBe(false);
  });

  it('closes when another game account starts playing, even though the Lease is still inside its window', async () => {
    const { h } = await restartedHolder();
    await h.premium.clock.advance(0);
    expect(h.gate.allows()).toBe(true);

    h.premium.identity.current = null;
    h.premium.service.noteAccountChanged();

    expect(h.gate.allows()).toBe(false);
  });

  it('never asks for removal while merely paused', async () => {
    const { h } = await restartedHolder();
    h.premium.stub.on('lease', { status: 503, body: { reason: 'busy' } });
    await h.restart();

    await h.premium.clock.advance(90 * MINUTE);

    expect(h.licence.view().state).toBe('unconfirmed');
    expect(h.stubRemoval?.requests).toEqual([]);
  });
});
