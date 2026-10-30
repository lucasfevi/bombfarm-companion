import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({ net: { fetch: vi.fn() } }));

import { SECRETS, settle } from '../premium-test-support.js';
import { fingerprint } from './fingerprint.js';
import {
  COMPUTER_NAME,
  MACHINE_GUID,
  MINUTE,
  OTHER_USER,
  SALT,
  USER,
  createLicenceHarness,
  keyIdOf,
  present,
} from './licence-test-support.js';

const sha256Url = (raw: string): string => createHash('sha256').update(Buffer.from(raw, 'base64url')).digest('base64url');

describe('device identity: the first activation', () => {
  it('generates one key, seals it before the activation is sent, and names it in the signature', async () => {
    const h = createLicenceHarness();
    h.scriptHolder();
    let sealedWhenSent = 0;
    h.premium.stub.on('licenceActivate', (request) => {
      sealedWhenSent = h.store.deviceWrites.length;
      return h.activation(request);
    });

    await h.boot();

    const activation = h.licenceRequests().find((request) => request.path === 'licenceActivate');
    const record = h.store.readDevice(USER);
    expect(sealedWhenSent).toBeGreaterThan(0);
    expect(record).not.toBeNull();
    expect(new Set(h.store.deviceWrites.map((written) => written.keyId)).size).toBe(1);
    expect(keyIdOf(present(activation))).toBe(present(record).keyId);
    expect(present(record).keyId).toBe(sha256Url(present(record).publicKey));
    expect((present(activation).body as { publicKey: string }).publicKey).toBe(present(record).publicKey);
  });

  it('fetches the salt first, keeps it sealed in the device record, and keys the fingerprint with it', async () => {
    const h = createLicenceHarness();
    h.scriptHolder();

    await h.boot();

    const [first, second] = h.licenceRequests();
    expect(first).toMatchObject({ path: 'licence', method: 'GET', token: SECRETS.token });
    expect(second?.path).toBe('licenceActivate');
    expect(h.store.readDevice(USER)?.fingerprintSalt).toBe(SALT);
    expect((present(second).body as { fingerprint: string }).fingerprint).toBe(fingerprint(SALT, MACHINE_GUID));
    expect((present(second).body as { fingerprint: string }).fingerprint).toMatch(/^[0-9a-f]{64}$/);
  });

  it('sends the computer name on the activation only, never on a renewal', async () => {
    const h = createLicenceHarness();
    h.scriptHolder();

    await h.boot();
    await h.restart();

    const activations = h.licenceRequests().filter((request) => request.path === 'licenceActivate');
    const renewals = h.licenceRequests().filter((request) => request.path === 'lease');
    expect(activations).toHaveLength(1);
    expect((present(activations[0]).body as { computerName: string }).computerName).toBe(COMPUTER_NAME);
    expect(renewals.length).toBeGreaterThan(0);
    for (const renewal of renewals) expect(renewal.raw).not.toContain(COMPUTER_NAME);
  });

  it('never lets the machine id into a request, a log record or the view', async () => {
    const h = createLicenceHarness();
    h.scriptHolder();

    await h.boot();
    await h.premium.clock.advance(16 * MINUTE);

    const everything = JSON.stringify([
      h.premium.stub.requests,
      h.premium.log.records,
      h.views,
      h.licence.view(),
    ]);
    expect(everything).not.toContain(MACHINE_GUID);
    expect(h.identity.reads).toBeGreaterThan(0);
  });
});

describe('device identity: reuse and separation', () => {
  it('reuses the sealed key after a restart and generates nothing new', async () => {
    const h = createLicenceHarness();
    h.scriptHolder();
    await h.boot();
    const first = present(h.store.readDevice(USER)).keyId;

    await h.restart();

    expect(h.store.readDevice(USER)?.keyId).toBe(first);
    expect(new Set(h.store.deviceWrites.map((written) => written.keyId))).toEqual(new Set([first]));
    const renewals = h.licenceRequests().filter((request) => request.path === 'lease');
    expect(renewals.every((request) => keyIdOf(request) === first)).toBe(true);
  });

  it('gives a second subject its own key, keeps the first one over sign-out, and never signs with the wrong one', async () => {
    const h = createLicenceHarness();
    h.scriptHolder();
    await h.boot();
    const first = present(h.store.readDevice(USER)).keyId;

    await h.premium.service.signOut();
    h.premium.stub.on('me', { status: 200, body: { v: 1, signInMethods: ['discord'], steamVerified: true, gameAccountLinked: false, admitted: false, userId: OTHER_USER } });
    h.premium.stub.on('licenceActivate', (request) => h.activation(request, { user: OTHER_USER }));
    await h.premium.signedIn();
    await settle();

    const second = h.store.readDevice(OTHER_USER)?.keyId;
    expect(second).toBeDefined();
    expect(second).not.toBe(first);
    expect(h.store.readDevice(USER)?.keyId).toBe(first);
    const activations = h.licenceRequests().filter((request) => request.path === 'licenceActivate');
    expect(activations.map(keyIdOf)).toEqual([first, second]);
  });

  it('forgets the key and activates again as a new PC when the API says the key is someone else\'s', async () => {
    const h = createLicenceHarness();
    h.scriptHolder();
    h.premium.stub.on('licenceActivate', (request, count) =>
      count === 1 ? { status: 403, body: { reason: 'device_foreign' } } : h.activation(request),
    );

    await h.boot();

    const activations = h.licenceRequests().filter((request) => request.path === 'licenceActivate');
    expect(h.store.clearedDevices).toContain(USER);
    expect(activations).toHaveLength(2);
    expect(keyIdOf(present(activations[1]))).not.toBe(keyIdOf(present(activations[0])));
    expect(h.licence.view().state).toBe('holds');
  });
});

describe('device identity: what blocks an activation', () => {
  it('generates no key and sends nothing while the OS cannot seal secrets', async () => {
    const h = createLicenceHarness();
    h.scriptHolder();
    h.secure.value = false;

    await h.boot();

    expect(h.store.deviceWrites).toEqual([]);
    expect(h.licenceRequests()).toEqual([]);
    expect(h.licence.view()).toMatchObject({ state: 'unconfirmed', reason: 'no_secure_storage' });
  });

  it('sends no activation when the machine id cannot be read', async () => {
    const h = createLicenceHarness({ guid: null });
    h.scriptHolder();

    await h.boot();

    expect(h.licenceRequests().filter((request) => request.path === 'licenceActivate')).toEqual([]);
    expect(h.licence.view()).toMatchObject({ state: 'unconfirmed', reason: 'no_fingerprint' });
  });
});
