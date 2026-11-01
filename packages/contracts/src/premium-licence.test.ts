import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  IPC_CHANNELS,
  LEASE_PUBLIC_KEYS,
  LICENCE_REASONS,
  LICENCE_STATES,
  PLUGIN_API_VERSION,
  SUPPORT_URL,
  signedOutPremiumView,
} from './index.js';

function keyIdOf(x: string): string {
  const raw = Buffer.from(x, 'base64url');
  expect(raw.length).toBe(32);
  return createHash('sha256').update(raw).digest('base64url').slice(0, 8);
}

describe('lease public keys', () => {
  it('ships exactly two keys, distinct in id and in bytes', () => {
    expect(LEASE_PUBLIC_KEYS).toHaveLength(2);
    expect(new Set(LEASE_PUBLIC_KEYS.map((k) => k.keyId)).size).toBe(2);
    expect(new Set(LEASE_PUBLIC_KEYS.map((k) => k.x)).size).toBe(2);
  });

  it('names the current key first and the spare second', () => {
    expect(LEASE_PUBLIC_KEYS[0]?.keyId).toBe('lCwiDkHw');
    expect(LEASE_PUBLIC_KEYS[1]?.keyId).toBe('zkPxZDIt');
  });

  it.each(LEASE_PUBLIC_KEYS.map((k) => [k.keyId, k.x] as const))(
    'key %s is a 32-byte base64url key whose id is the first 8 characters of its sha256',
    (keyId, x) => {
      expect(x).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(keyIdOf(x)).toBe(keyId);
    },
  );
});

describe('licence constants', () => {
  it('pins the plugin API version', () => {
    expect(PLUGIN_API_VERSION).toBe('1.1.0');
  });

  it('has no support link yet', () => {
    expect(SUPPORT_URL).toBeNull();
  });

  it('lists the ten licence states', () => {
    expect([...LICENCE_STATES]).toEqual([
      'signed_out',
      'inactive',
      'holds',
      'elsewhere',
      'unconfirmed',
      'mismatch',
      'moved',
      'released',
      'ended',
      'move_limit',
    ]);
  });

  it('lists the reasons an unconfirmed state can carry', () => {
    expect([...LICENCE_REASONS]).toEqual([
      'no_secure_storage',
      'no_fingerprint',
      'device_signature',
      'lease_invalid',
      'network',
    ]);
  });
});

describe('licence on the Premium view and the invoke allowlist', () => {
  it('starts with no licence on the signed-out view', () => {
    expect(signedOutPremiumView.licence).toBeNull();
  });

  it('allows the premium:useHere invoke', () => {
    expect(IPC_CHANNELS).toContain('premium:useHere');
  });
});
