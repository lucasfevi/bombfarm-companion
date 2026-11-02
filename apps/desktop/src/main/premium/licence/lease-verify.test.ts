import { generateKeyPairSync, sign, type KeyObject } from 'node:crypto';
import { LEASE_PUBLIC_KEYS } from '@bombfarm/contracts';
import { describe, expect, it } from 'vitest';
import {
  createLeaseKeyTable,
  LEASE_CHECK_ORDER,
  shippedLeaseKeys,
  verifyLease,
  type LeaseCheck,
  type LeaseContext,
  type LeaseEnvelope,
} from './lease-verify.js';

const TEST_KEY_ID = 'testkey1';
const SUBJECT = 'user-1';
const DEVICE = 'device-key-id-1';

const pair = generateKeyPairSync('ed25519');
const otherPair = generateKeyPairSync('ed25519');
const keys = createLeaseKeyTable([
  { keyId: TEST_KEY_ID, x: String(pair.publicKey.export({ format: 'jwk' }).x) },
]);
const ctx: LeaseContext = { subject: SUBJECT, deviceKeyId: DEVICE, keys };

function goodPayload(): Record<string, unknown> {
  return {
    v: 1,
    user: SUBJECT,
    deviceKeyId: DEVICE,
    state: 'active',
    playing: { accountId: 'acc-1', steamId64: '76561198000000001' },
    until: '2026-12-01T00:00:00.000Z',
    issuedAt: '2026-10-30T10:00:00.000Z',
    expiresAt: '2026-10-30T11:00:00.000Z',
    minSequence: 0,
  };
}

function seal(text: string, privateKey: KeyObject = pair.privateKey, keyId = TEST_KEY_ID): LeaseEnvelope {
  const bytes = Buffer.from(text, 'utf8');
  return {
    lease: bytes.toString('base64url'),
    sig: sign(null, bytes, privateKey).toString('base64url'),
    keyId,
  };
}

const sealed = (payload: Record<string, unknown>, privateKey?: KeyObject, keyId?: string): LeaseEnvelope =>
  seal(JSON.stringify(payload), privateKey, keyId);

function failed(check: LeaseCheck): { ok: false; check: LeaseCheck } {
  return { ok: false, check };
}

describe('a valid Lease', () => {
  it('verifies and returns the exact signed bytes and the parsed payload', () => {
    const text = JSON.stringify(goodPayload());
    const verdict = verifyLease(seal(text), ctx);
    expect(verdict.ok).toBe(true);
    if (!verdict.ok) return;
    expect(verdict.bytes.toString('utf8')).toBe(text);
    expect(verdict.payload).toEqual(goodPayload());
  });

  it('verifies signed bytes that carry whitespace, since it never re-serialises before verifying', () => {
    const text = JSON.stringify(goodPayload(), null, 2);
    const verdict = verifyLease(seal(text), ctx);
    expect(verdict.ok).toBe(true);
    if (verdict.ok) expect(verdict.bytes.toString('utf8')).toBe(text);
  });

  it('keeps holderName and a null playing pair and a null until', () => {
    const verdict = verifyLease(
      sealed({ ...goodPayload(), state: 'moved', holderName: 'DESKTOP-B', playing: null, until: null }),
      ctx,
    );
    expect(verdict.ok).toBe(true);
    if (verdict.ok) {
      expect(verdict.payload.holderName).toBe('DESKTOP-B');
      expect(verdict.payload.playing).toBeNull();
      expect(verdict.payload.until).toBeNull();
    }
  });

  it.each(['active', 'paused_other_account', 'ended', 'released', 'moved'])('accepts state %s', (state) => {
    expect(verifyLease(sealed({ ...goodPayload(), state }), ctx).ok).toBe(true);
  });
});

describe('the checks, in the order they run', () => {
  it('lists the eight checks in the stated order', () => {
    expect([...LEASE_CHECK_ORDER]).toEqual([
      'unknown_key',
      'signature',
      'parse',
      'version',
      'user',
      'device',
      'state',
      'lifetime',
    ]);
  });

  const rows: ReadonlyArray<readonly [LeaseCheck, () => LeaseEnvelope]> = [
    ['unknown_key', () => sealed(goodPayload(), pair.privateKey, 'nosuchkey')],
    ['signature', () => sealed(goodPayload(), otherPair.privateKey)],
    ['parse', () => seal('this is not json')],
    ['version', () => sealed({ ...goodPayload(), v: 2 })],
    ['user', () => sealed({ ...goodPayload(), user: 'someone-else' })],
    ['device', () => sealed({ ...goodPayload(), deviceKeyId: 'another-device' })],
    ['state', () => sealed({ ...goodPayload(), state: 'resting' })],
    ['lifetime', () => sealed({ ...goodPayload(), expiresAt: '2026-10-30T11:00:00.001Z' })],
  ];

  it.each(rows)('rejects with %s', (check, make) => {
    expect(verifyLease(make(), ctx)).toEqual(failed(check));
  });

  it('rejects a payload that is JSON but not an object, as parse', () => {
    expect(verifyLease(seal('[1,2,3]'), ctx)).toEqual(failed('parse'));
    expect(verifyLease(seal('null'), ctx)).toEqual(failed('parse'));
  });

  it('rejects a payload with a field of the wrong type, as parse', () => {
    expect(verifyLease(sealed({ ...goodPayload(), user: 7 }), ctx)).toEqual(failed('parse'));
    expect(verifyLease(sealed({ ...goodPayload(), issuedAt: 'yesterday' }), ctx)).toEqual(failed('parse'));
    expect(verifyLease(sealed({ ...goodPayload(), playing: { accountId: 1 } }), ctx)).toEqual(failed('parse'));
  });

  it('rejects a signature that is not base64url, as signature', () => {
    const env = sealed(goodPayload());
    expect(verifyLease({ ...env, sig: '!!!' }, ctx)).toEqual(failed('signature'));
    expect(verifyLease({ ...env, lease: 'not base64url!' }, ctx)).toEqual(failed('signature'));
  });

  it('rejects a signature of the wrong length, as signature', () => {
    const env = sealed(goodPayload());
    expect(verifyLease({ ...env, sig: env.sig.slice(0, 20) }, ctx)).toEqual(failed('signature'));
  });
});

describe('a Lease failing two checks at once reports the earlier one', () => {
  const pairs: ReadonlyArray<readonly [string, LeaseCheck, () => LeaseEnvelope]> = [
    [
      'unknown_key and signature',
      'unknown_key',
      () => sealed(goodPayload(), otherPair.privateKey, 'nosuchkey'),
    ],
    ['signature and parse', 'signature', () => seal('not json', otherPair.privateKey)],
    ['parse and version', 'parse', () => sealed({ v: 2, user: SUBJECT })],
    ['version and user', 'version', () => sealed({ ...goodPayload(), v: 2, user: 'someone-else' })],
    [
      'user and device',
      'user',
      () => sealed({ ...goodPayload(), user: 'someone-else', deviceKeyId: 'another-device' }),
    ],
    [
      'device and state',
      'device',
      () => sealed({ ...goodPayload(), deviceKeyId: 'another-device', state: 'resting' }),
    ],
    [
      'state and lifetime',
      'state',
      () => sealed({ ...goodPayload(), state: 'resting', expiresAt: '2026-10-30T13:00:00.000Z' }),
    ],
  ];

  it.each(pairs)('%s', (_name, expected, make) => {
    expect(verifyLease(make(), ctx)).toEqual(failed(expected));
  });
});

describe('the signature covers the exact bytes', () => {
  it('fails signature when the bytes are re-serialised with the whitespace changed', () => {
    const original = seal(JSON.stringify(goodPayload()));
    const reserialised = Buffer.from(JSON.stringify(goodPayload(), null, 2), 'utf8').toString('base64url');
    expect(verifyLease({ ...original, lease: reserialised }, ctx)).toEqual(failed('signature'));
  });

  it('fails signature when one byte of the signed text changes', () => {
    const env = sealed(goodPayload());
    const bytes = Buffer.from(env.lease, 'base64url');
    const last = bytes.length - 2;
    bytes[last] = bytes[last] === 0x30 ? 0x31 : 0x30;
    expect(verifyLease({ ...env, lease: bytes.toString('base64url') }, ctx)).toEqual(failed('signature'));
  });
});

describe('the validity window', () => {
  const at = (issuedAt: string, expiresAt: string) =>
    verifyLease(sealed({ ...goodPayload(), issuedAt, expiresAt }), ctx);

  it('is the Lease lifetime when it is under an hour', () => {
    const verdict = at('2026-10-30T10:00:00.000Z', '2026-10-30T10:15:00.000Z');
    expect(verdict.ok && verdict.windowMs).toBe(15 * 60_000);
  });

  it('is an hour for a full 60-minute Lease', () => {
    const verdict = at('2026-10-30T10:00:00.000Z', '2026-10-30T11:00:00.000Z');
    expect(verdict.ok && verdict.windowMs).toBe(3_600_000);
  });

  it('never exceeds an hour, because a longer Lease is rejected', () => {
    expect(at('2026-10-30T10:00:00.000Z', '2026-10-30T11:00:01.000Z')).toEqual(failed('lifetime'));
  });

  it('is zero for a Lease that expires before it was issued', () => {
    const verdict = at('2026-10-30T10:00:00.000Z', '2026-10-30T09:00:00.000Z');
    expect(verdict.ok && verdict.windowMs).toBe(0);
  });
});

describe('the shipped key table', () => {
  it('holds exactly the two shipped lease keys by id', () => {
    const table = shippedLeaseKeys();
    expect([...table.keys()].sort()).toEqual(LEASE_PUBLIC_KEYS.map((k) => k.keyId).sort());
  });

  it('refuses a Lease signed by a key that is not shipped', () => {
    expect(verifyLease(sealed(goodPayload()), { ...ctx, keys: shippedLeaseKeys() })).toEqual(failed('unknown_key'));
  });

  it('refuses a Lease that names a shipped key but was signed by another', () => {
    const shippedId = LEASE_PUBLIC_KEYS.map((k) => k.keyId)[0] ?? 'missing';
    expect(
      verifyLease(sealed(goodPayload(), pair.privateKey, shippedId), { ...ctx, keys: shippedLeaseKeys() }),
    ).toEqual(failed('signature'));
  });
});
