import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  BUNDLE_PUBLIC_KEYS,
  IPC_CHANNELS,
  LEASE_PUBLIC_KEYS,
  PLUGIN_API_VERSION,
  PREMIUM_CAPABILITIES,
  PREMIUM_SHARED_MODULES,
  signedOutPremiumView,
} from './index.js';
import { PLUGIN_API_VERSION as fromHost } from './premium-host.js';
import { PLUGIN_API_VERSION as fromLicence } from './premium-licence.js';

function keyIdOf(x: string): string {
  const raw = Buffer.from(x, 'base64url');
  expect(raw.length).toBe(32);
  return createHash('sha256').update(raw).digest('base64url').slice(0, 8);
}

describe('shared modules and capabilities', () => {
  it('lists the five shared modules in order and is frozen', () => {
    expect([...PREMIUM_SHARED_MODULES]).toEqual([
      'react',
      'react/jsx-runtime',
      'react-dom',
      'react/compiler-runtime',
      '@bombfarm/ui',
    ]);
    expect(Object.isFrozen(PREMIUM_SHARED_MODULES)).toBe(true);
  });

  it('grants no capability yet, and the list is frozen', () => {
    expect([...PREMIUM_CAPABILITIES]).toEqual([]);
    expect(Object.isFrozen(PREMIUM_CAPABILITIES)).toBe(true);
  });
});

describe('bundle public keys', () => {
  it('ships exactly two keys, distinct in id and in bytes', () => {
    expect(BUNDLE_PUBLIC_KEYS).toHaveLength(2);
    expect(new Set(BUNDLE_PUBLIC_KEYS.map((k) => k.keyId)).size).toBe(2);
    expect(new Set(BUNDLE_PUBLIC_KEYS.map((k) => k.x)).size).toBe(2);
  });

  it.each(BUNDLE_PUBLIC_KEYS.map((k) => [k.keyId, k.x] as const))(
    'key %s is a 32-byte base64url key whose id is the first 8 characters of its sha256',
    (keyId, x) => {
      expect(x).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(keyIdOf(x)).toBe(keyId);
    },
  );

  it('does not reuse a lease key', () => {
    const lease = new Set(LEASE_PUBLIC_KEYS.map((k) => k.x));
    expect(BUNDLE_PUBLIC_KEYS.some((k) => lease.has(k.x))).toBe(false);
  });
});

describe('plugin API version', () => {
  it('is 1.0.0 from either module', () => {
    expect(fromHost).toBe('1.0.0');
    expect(fromLicence).toBe('1.0.0');
    expect(PLUGIN_API_VERSION).toBe('1.0.0');
  });

  it('is the same value through both modules', () => {
    expect(fromLicence).toBe(fromHost);
  });
});

describe('host on the Premium view and the invoke allowlist', () => {
  it('starts with no host on the signed-out view', () => {
    expect(signedOutPremiumView.host).toBeNull();
  });

  it('allows the premium:hostMountFailed invoke for the main window', () => {
    expect(IPC_CHANNELS).toContain('premium:hostMountFailed');
  });
});
