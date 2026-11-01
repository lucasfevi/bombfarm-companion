import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  BUNDLE_PUBLIC_KEYS,
  IPC_CHANNELS,
  IPC_EVENT_CHANNELS,
  LEASE_PUBLIC_KEYS,
  PLUGIN_API_VERSION,
  PREMIUM_CAPABILITIES,
  PREMIUM_NOTIFICATIONS,
  PREMIUM_SHARED_MODULES,
  type PremiumStatusAnswer,
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

  it('grants the four capabilities, in order, and the list is frozen', () => {
    expect([...PREMIUM_CAPABILITIES]).toEqual(['premium.status', 'store', 'log', 'notify']);
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
  it('is 1.1.0 from either module', () => {
    expect(fromHost).toBe('1.1.0');
    expect(fromLicence).toBe('1.1.0');
    expect(PLUGIN_API_VERSION).toBe('1.1.0');
  });

  it('is the same value through both modules', () => {
    expect(fromLicence).toBe(fromHost);
  });
});

describe('premium.status answer', () => {
  it('has exactly the five fields and rejects an extra one', () => {
    const answer: PremiumStatusAnswer = {
      active: true,
      until: null,
      paused: false,
      pausedReason: null,
      audience: 'owner',
    };
    expect(Object.keys(answer).sort()).toEqual(['active', 'audience', 'paused', 'pausedReason', 'until']);
    // @ts-expect-error a status answer carries no field beyond the five
    const extra: PremiumStatusAnswer = { ...answer, userId: 'u-1' };
    expect(extra).toBeDefined();
  });
});

describe('notifications', () => {
  it.each(Object.entries(PREMIUM_NOTIFICATIONS))('%s has a title and a body in both locales', (_id, texts) => {
    expect(Object.keys(texts).sort()).toEqual(['en', 'pt-BR']);
    for (const text of Object.values(texts)) {
      expect(text.title).not.toBe('');
      expect(text.body).not.toBe('');
    }
  });

  it('ships the test notification', () => {
    expect(Object.keys(PREMIUM_NOTIFICATIONS)).toEqual(['premium.test']);
  });
});

describe('host on the Premium view and the invoke allowlist', () => {
  it('starts with no host on the signed-out view', () => {
    expect(signedOutPremiumView.host).toBeNull();
  });

  it('allows the premium:hostMountFailed invoke for the main window', () => {
    expect(IPC_CHANNELS).toContain('premium:hostMountFailed');
  });

  it('registers the UI capability call and the show-tab event', () => {
    expect(IPC_CHANNELS).toContain('premium:uiCall');
    expect(IPC_EVENT_CHANNELS).toContain('premium:showTab');
  });
});
