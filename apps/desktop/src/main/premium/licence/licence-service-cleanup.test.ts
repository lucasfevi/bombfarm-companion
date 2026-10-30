import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({ net: { fetch: vi.fn() } }));

import { settle, unreachable } from '../premium-test-support.js';
import { fingerprint } from './fingerprint.js';
import { MACHINE_GUID, MINUTE, SALT, USER, createLicenceHarness, type LicenceHarness, present } from './licence-test-support.js';

const cleanups = (h: LicenceHarness) => h.licenceRequests().filter((request) => request.path === 'licenceCleanup');
const renewals = (h: LicenceHarness) => h.licenceRequests().filter((request) => request.path === 'lease');

/** A holder that is told on its next renewal that the licence moved to another PC. */
async function movedAway(options: { removal?: 'stub' | 'default' } = {}): Promise<LicenceHarness> {
  const h = createLicenceHarness(options);
  h.scriptHolder();
  await h.boot();
  await h.premium.clock.advance(0);
  h.premium.stub.on('lease', (request) => h.lease(request, { state: 'moved', holderName: 'NEW-PC' }));
  h.licence.trigger('refresh');
  await settle();
  return h;
}

describe('removal hand-off and the cleanup report', () => {
  it('seals the marker before asking for removal, asks once, and sends no report before "gone"', async () => {
    const h = createLicenceHarness();
    h.scriptHolder();
    await h.boot();
    await h.premium.clock.advance(0);
    let markersWhenAsked = -1;
    present(h.stubRemoval).requestPremiumRemoval = (reason) => {
      markersWhenAsked = h.store.cleanupWrites.length;
      present(h.stubRemoval).requests.push(reason);
    };
    h.premium.stub.on('lease', (request) => h.lease(request, { state: 'moved', holderName: 'NEW-PC' }));

    h.licence.trigger('refresh');
    await settle();
    await h.premium.clock.advance(5 * MINUTE);

    expect(markersWhenAsked).toBe(1);
    expect(present(h.stubRemoval).requests).toEqual(['moved']);
    expect(h.store.readCleanup(USER)).toMatchObject({ reason: 'moved' });
    expect(cleanups(h)).toEqual([]);
    expect(h.licence.view()).toMatchObject({ state: 'moved', holderName: 'NEW-PC', removalDone: false });
  });

  it('sends exactly one signed report after "gone" and then clears the marker', async () => {
    const h = await movedAway();

    present(h.stubRemoval).answerGone();
    await settle();

    expect(cleanups(h)).toHaveLength(1);
    expect(present(cleanups(h)[0]).body).toEqual({ fingerprint: fingerprint(SALT, MACHINE_GUID), removed: true });
    expect(present(cleanups(h)[0]).device).toBeDefined();
    expect(h.store.readCleanup(USER)).toBeNull();
    expect(h.licence.view().removalDone).toBe(true);
  });

  it('reports without a hand answer when nothing was ever downloaded (the default port)', async () => {
    const h = await movedAway({ removal: 'default' });
    await settle();

    expect(cleanups(h)).toHaveLength(1);
    expect(h.store.readCleanup(USER)).toBeNull();
  });

  it('asks again after a restart and resends when the first report got 503, before any renewal', async () => {
    const h = await movedAway();
    h.premium.stub.on('licenceCleanup', { status: 503, body: { reason: 'busy' } });
    present(h.stubRemoval).answerGone();
    await settle();
    expect(cleanups(h)).toHaveLength(1);
    expect(h.store.readCleanup(USER)).not.toBeNull();
    const renewalsBefore = renewals(h).length;
    h.premium.stub.on('licenceCleanup', { status: 200, body: { cleanup: 'confirmed' } });

    await h.restart();
    expect(present(h.stubRemoval).requests).toEqual(['moved', 'moved']);
    expect(cleanups(h)).toHaveLength(1);
    expect(renewals(h)).toHaveLength(renewalsBefore);
    present(h.stubRemoval).answerGone();
    await settle();

    expect(cleanups(h)).toHaveLength(2);
    expect(h.store.readCleanup(USER)).toBeNull();
  });

  it('retries a refused report on the schedule', async () => {
    const h = await movedAway();
    h.premium.stub.on('licenceCleanup', { status: 503, body: { reason: 'busy' } });
    present(h.stubRemoval).answerGone();
    await settle();

    await h.premium.clock.advance(MINUTE);

    expect(cleanups(h)).toHaveLength(2);
  });

  it('keeps the marker over sign-out and reports the next time that subject signs in', async () => {
    const h = await movedAway();

    await h.premium.service.signOut();
    expect(h.store.readCleanup(USER)).toMatchObject({ reason: 'moved' });
    expect(h.store.clearedCleanups).toEqual([]);
    expect(cleanups(h)).toEqual([]);

    await h.premium.signedIn();
    await settle();
    expect(present(h.stubRemoval).requests).toEqual(['moved', 'moved']);
    present(h.stubRemoval).answerGone();
    await settle();

    expect(cleanups(h)).toHaveLength(1);
    expect(h.store.readCleanup(USER)).toBeNull();
  });

  it('clears the marker when the server says the PC has not left', async () => {
    const h = await movedAway();
    h.premium.stub.on('licenceCleanup', { status: 409, body: { reason: 'not_left' } });

    present(h.stubRemoval).answerGone();
    await settle();

    expect(h.store.readCleanup(USER)).toBeNull();
  });
});

describe('offline past the known end', () => {
  async function sealedHolder(until: string | null): Promise<LicenceHarness> {
    const h = createLicenceHarness();
    h.scriptHolder();
    h.premium.stub.on('lease', (request) => h.lease(request, { until }));
    h.premium.stub.on('licenceActivate', (request) => h.activation(request, { until }));
    await h.boot();
    await h.premium.clock.advance(0);
    h.premium.stub.on('lease', unreachable);
    h.premium.stub.on('licenceActivate', unreachable);
    h.premium.stub.on('licenceCleanup', unreachable);
    return h;
  }

  it('ends at start and asks for removal when the sealed Lease ended yesterday and the API is silent', async () => {
    const h = await sealedHolder('2026-10-19T00:00:00.000Z');

    await h.restart();

    expect(h.licence.view().state).toBe('ended');
    expect(present(h.stubRemoval).requests).toEqual(['ended']);
    expect(h.store.readCleanup(USER)).toMatchObject({ reason: 'ended' });
    expect(h.gate.allows()).toBe(false);
  });

  it('only pauses, however long it stays offline, when the Lease has no end date', async () => {
    const h = await sealedHolder(null);

    await h.restart();
    await h.premium.clock.advance(3 * 24 * 60 * MINUTE);

    expect(h.licence.view().state).toBe('unconfirmed');
    expect(present(h.stubRemoval).requests).toEqual([]);
  });

  it('ends on a renewal failure once the clock passes the end date, and a later failed contact does not undo it', async () => {
    const h = await sealedHolder('2026-10-21T00:00:00.000Z');
    await h.restart();
    expect(h.licence.view().state).toBe('unconfirmed');

    await h.premium.clock.advance(13 * 60 * MINUTE);
    expect(h.licence.view().state).toBe('ended');
    expect(present(h.stubRemoval).requests).toEqual(['ended']);

    h.licence.trigger('refresh');
    await settle();
    expect(h.licence.view().state).toBe('ended');
  });
});
