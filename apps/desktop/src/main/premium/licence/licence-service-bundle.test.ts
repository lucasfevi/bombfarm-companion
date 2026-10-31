import { createHash, createPublicKey, verify } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({ net: { fetch: vi.fn() } }));

import { SECRETS, deferred, settle, type StubReply } from '../premium-test-support.js';
import { BytesTooLargeError, type BundleRoute } from '../premium-transport.js';
import { USER, createLicenceHarness, keyIdOf, present, signedLease, type LicenceHarness } from './licence-test-support.js';

const FILE: BundleRoute = { r: 'file', sequence: 7, path: 'ui/index.js' };
const MANIFEST: BundleRoute = { r: 'bundle', query: { hostApi: '1.0.0', appVersion: '9.9.9', flavor: 'dev' } };
const EMPTY_SHA256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

const get = (h: LicenceHarness, route: BundleRoute, maxBytes = 1024) =>
  h.licence.deviceGet({ route, maxBytes, signal: new AbortController().signal });

async function holder(): Promise<LicenceHarness> {
  const h = createLicenceHarness();
  h.scriptHolder();
  await h.boot();
  expect(h.gate.allows()).toBe(true);
  return h;
}

/** The API's check of a `BFC-Device` header on a GET: the message is METHOD, pathname, seconds, sha256 of no bytes. */
function serverAccepts(h: LicenceHarness, header: string, pathname: string): boolean {
  const record = present(h.store.readDevice(USER));
  const [keyId, seconds, signature] = header.split('.') as [string, string, string];
  if (keyId !== record.keyId) return false;
  const publicKey = createPublicKey({ key: { kty: 'OKP', crv: 'Ed25519', x: record.publicKey }, format: 'jwk' });
  const message = `GET\n${pathname}\n${seconds}\n${EMPTY_SHA256}`;
  return verify(null, Buffer.from(message), publicKey, Buffer.from(signature, 'base64url'));
}

describe('the digest of an empty body', () => {
  it('is the fixed vector the server hashes for a GET', () => {
    expect(createHash('sha256').update('').digest('hex')).toBe(EMPTY_SHA256);
  });
});

describe('deviceGet', () => {
  it('signs the file pathname with an empty body and sends the bearer token', async () => {
    const h = await holder();

    const result = await get(h, FILE);

    expect(result).toEqual({ ok: true, status: 200, bytes: new Uint8Array([1, 2, 3]), retryAfterSec: null });
    const sent = present(h.bytes.requests.at(-1));
    expect(sent.route).toEqual(FILE);
    expect(sent.token).toBe(SECRETS.token);
    expect(sent.maxBytes).toBe(1024);
    expect(serverAccepts(h, sent.device, '/v1/premium/bundle/7/files/ui/index.js')).toBe(true);
    expect(serverAccepts(h, sent.device, '/v1/premium/bundle/8/files/ui/index.js')).toBe(false);
  });

  it('signs the manifest pathname without its query', async () => {
    const h = await holder();

    await get(h, MANIFEST);

    const sent = present(h.bytes.requests.at(-1));
    expect(serverAccepts(h, sent.device, '/v1/premium/bundle')).toBe(true);
    expect(sent.device.split('.')[0]).toBe(present(h.store.readDevice(USER)).keyId);
  });

  it('sends nothing while the gate is closed', async () => {
    const h = createLicenceHarness();
    h.scriptHolder();
    await h.boot();
    h.premium.stub.on('lease', { status: 503, body: { reason: 'busy' } });
    await h.restart();
    expect(h.gate.allows()).toBe(false);

    expect(await get(h, FILE)).toEqual({ ok: false, reason: 'gate_closed' });
    expect(h.bytes.requests).toHaveLength(0);
  });

  it('sends nothing after the service stops', async () => {
    const h = await holder();
    h.licence.stop();

    expect(await get(h, FILE)).toEqual({ ok: false, reason: 'gate_closed' });
    expect(h.bytes.requests).toHaveLength(0);
  });

  it('ends the session through the existing path on a bearer 401', async () => {
    const h = await holder();
    h.bytes.reply = { status: 401, bytes: new TextEncoder().encode('{"reason":"unauthorized"}'), retryAfterSec: null };

    expect(await get(h, FILE)).toEqual({ ok: false, reason: 'unauthorized' });
    await settle();

    expect(h.premium.service.getView()).toMatchObject({ session: 'signed-out', ended: 'expired' });
    expect(h.licence.view().state).toBe('signed_out');
  });

  it('leaves the session alone on a device-signature 401 and corrects the clock from its Date', async () => {
    const h = await holder();
    const sentAt: number[] = [];
    h.bytes.reply = (req) => {
      sentAt.push(Number(req.device.split('.')[1]));
      return {
        status: 401,
        bytes: new TextEncoder().encode('{"reason":"device_signature"}'),
        retryAfterSec: null,
        dateMs: h.premium.clock.now() + 10 * 60_000,
      };
    };

    const first = await get(h, FILE);
    await get(h, FILE);

    expect(first).toMatchObject({ ok: true, status: 401 });
    expect(h.premium.service.getView()).toMatchObject({ session: 'signed-in' });
    expect(present(sentAt[1]) - present(sentAt[0])).toBe(600);
  });

  it('passes a refusal status and Retry-After on for the host to judge', async () => {
    const h = await holder();
    h.bytes.reply = { status: 429, bytes: new Uint8Array(0), retryAfterSec: 30 };

    expect(await get(h, FILE)).toEqual({ ok: true, status: 429, bytes: new Uint8Array(0), retryAfterSec: 30 });
    expect(h.premium.service.getView()).toMatchObject({ session: 'signed-in' });
  });

  it('reports an over-long body and a network failure as what they are', async () => {
    const h = await holder();
    h.bytes.reply = () => {
      throw new BytesTooLargeError();
    };
    expect(await get(h, FILE)).toEqual({ ok: false, reason: 'too_large' });
    h.bytes.reply = () => {
      throw new Error('network down');
    };
    expect(await get(h, FILE)).toEqual({ ok: false, reason: 'unreachable' });
    expect(h.premium.service.getView()).toMatchObject({ session: 'signed-in' });
  });
});

describe('noteLeaseFloor', () => {
  const withFloor = (h: LicenceHarness, floors: number[]): void => {
    let next = 0;
    h.premium.stub.on('lease', (request) => h.lease(request, { minSequence: floors[Math.min(next++, floors.length - 1)] ?? 0 }));
  };

  it('receives the minSequence of every Lease the machine accepts, in order', async () => {
    const h = createLicenceHarness();
    h.scriptHolder();
    h.premium.stub.on('licenceActivate', (request) => h.activation(request, { minSequence: 3 }));
    await h.boot();
    expect(h.stubRemoval?.floors).toEqual([3]);

    withFloor(h, [5, 9]);
    h.licence.trigger('refresh');
    await settle();
    h.licence.trigger('refresh');
    await settle();

    expect(h.stubRemoval?.floors).toEqual([3, 5, 9]);
  });

  it('sends nothing for a Lease that fails verification', async () => {
    const h = await holder();
    const before = present(h.stubRemoval).floors.length;
    h.premium.stub.on('lease', (request) => ({
      status: 200,
      body: signedLease({ deviceKeyId: keyIdOf(request), issuedAtMs: h.premium.clock.now(), user: 'someone-else', minSequence: 99 }),
    }));

    h.licence.trigger('refresh');
    await settle();

    expect(h.premium.log.records.filter((record) => record['event'] === 'premium.lease_rejected')).toHaveLength(1);
    expect(present(h.stubRemoval).floors).toHaveLength(before);
  });

  it('sends nothing for a failed renewal', async () => {
    const h = await holder();
    const before = present(h.stubRemoval).floors.length;
    h.premium.stub.on('lease', { status: 503, body: { reason: 'busy' } });

    h.licence.trigger('refresh');
    await settle();

    expect(present(h.stubRemoval).floors).toHaveLength(before);
  });

  it('sends nothing for a stale answer that lands after sign-out', async () => {
    const h = await holder();
    const before = present(h.stubRemoval).floors.length;
    const late = deferred<StubReply>();
    h.premium.stub.on('lease', () => late.promise);

    h.licence.trigger('refresh');
    await settle();
    await h.premium.service.signOut();
    late.resolve(h.lease(present(h.licenceRequests().filter((r) => r.path === 'lease').at(-1)), { minSequence: 99 }));
    await settle();

    expect(present(h.stubRemoval).floors).toHaveLength(before);
  });

  it('is ignored by the default port', async () => {
    const h = createLicenceHarness({ removal: 'default' });
    h.scriptHolder();
    h.premium.stub.on('licenceActivate', (request) => h.activation(request, { minSequence: 4 }));

    await h.boot();

    expect(h.licence.view().state).toBe('holds');
  });
});
