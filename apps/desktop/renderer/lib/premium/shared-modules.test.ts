import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { PREMIUM_SHARED_MODULES } from '@bombfarm/contracts';
import { SHARED_MODULES, installSharedModules } from './shared-modules';

const DESKTOP_ROOT = path.resolve(__dirname, '..', '..', '..');

describe('the shared-module table', () => {
  it('has exactly the shared module names, in order', () => {
    expect(Object.keys(SHARED_MODULES)).toEqual([...PREMIUM_SHARED_MODULES]);
  });

  it('holds every name the shims re-export', async () => {
    // @ts-expect-error -- a build script without type declarations
    const script = (await import('../../../scripts/write-premium-shims.mjs')) as {
      premiumShimExports: (options: { root: string }) => Promise<Record<string, string[]>>;
    };
    const shims = await script.premiumShimExports({ root: DESKTOP_ROOT });
    expect(Object.keys(shims)).toEqual(Object.keys(SHARED_MODULES));
    for (const [name, exported] of Object.entries(shims)) {
      const live = SHARED_MODULES[name as keyof typeof SHARED_MODULES] as Record<string, unknown>;
      const missing = exported.filter((key) => !(key in live));
      expect({ name, missing }).toEqual({ name, missing: [] });
    }
  }, 30_000);

  it('is published once, frozen, and cannot be replaced', () => {
    const target: Record<string, unknown> = {};
    installSharedModules(target);
    installSharedModules(target);

    const published = target.__bfcPremiumShared;
    expect(published).toBe(SHARED_MODULES);
    expect(Object.isFrozen(published)).toBe(true);
    const descriptor = Object.getOwnPropertyDescriptor(target, '__bfcPremiumShared');
    expect(descriptor).toMatchObject({ writable: false, configurable: false });
    expect(() => {
      'use strict';
      target.__bfcPremiumShared = {};
    }).toThrow();
    expect(() => Object.defineProperty(target, '__bfcPremiumShared', { value: {} })).toThrow();
  });
});
