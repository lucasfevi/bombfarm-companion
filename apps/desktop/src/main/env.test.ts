import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getPath: () => '/appdata',
    getAppPath: () => '/app',
  },
}));

vi.mock('node:fs', () => ({
  readFileSync: () => '{}',
}));

import { APP_FLAVORS, FLAVORS } from '@bombfarm/contracts';
import { buildAppEnv } from './env.js';

const APP_DATA = '/appdata';

const baseDeps = {
  isPackaged: false,
  bakedFlavor: null as AppFlavor | null,
  appDataPath: APP_DATA,
  nodeEnv: 'development' as string | undefined,
};

type AppFlavor = (typeof APP_FLAVORS)[number];

describe('buildAppEnv', () => {
  it('defaults unpackaged runs to dev when BFC_FLAVOR is unset', () => {
    const env = buildAppEnv({ ...baseDeps, rawFlavor: undefined });
    expect(env.flavor).toBe('dev');
    expect(env.envConflict).toBeNull();
  });

  it('resolves a whitespace and case-insensitive flavor token', () => {
    const env = buildAppEnv({ ...baseDeps, rawFlavor: ' NIGHTLY ' });
    expect(env.flavor).toBe('nightly');
    expect(env.productName).toBe('Bomb Farm Companion (Nightly)');
  });

  it('throws for an invalid unpackaged flavor token', () => {
    expect(() => buildAppEnv({ ...baseDeps, rawFlavor: 'beeta' })).toThrowError(
      /Invalid BFC_FLAVOR: beeta/,
    );
  });

  it('uses the baked flavor when packaged and reports an env conflict', () => {
    const env = buildAppEnv({
      ...baseDeps,
      isPackaged: true,
      bakedFlavor: 'prod',
      rawFlavor: 'nightly',
    });
    expect(env.flavor).toBe('prod');
    expect(env.envConflict).toEqual({ requested: 'nightly', effective: 'prod' });
  });

  it('throws for an invalid packaged flavor token', () => {
    expect(() =>
      buildAppEnv({
        ...baseDeps,
        isPackaged: true,
        bakedFlavor: 'prod',
        rawFlavor: 'beeta',
      }),
    ).toThrowError(/Invalid BFC_FLAVOR: beeta/);
  });

  it('throws when a packaged build has a missing baked stamp', () => {
    expect(() =>
      buildAppEnv({
        ...baseDeps,
        isPackaged: true,
        bakedFlavor: null,
        rawFlavor: undefined,
      }),
    ).toThrowError(/Invalid BFC_FLAVOR: \(missing stamp\)/);
  });

  it('marks isDev when NODE_ENV is not production', () => {
    expect(buildAppEnv({ ...baseDeps, rawFlavor: 'dev' }).isDev).toBe(true);
  });

  it('marks isPackaged from deps', () => {
    expect(
      buildAppEnv({
        ...baseDeps,
        isPackaged: true,
        bakedFlavor: 'beta',
        rawFlavor: 'beta',
        nodeEnv: 'production',
      }).isPackaged,
    ).toBe(true);
  });

  for (const flavor of APP_FLAVORS) {
    it(`computes userDataPath for ${flavor}`, () => {
      const descriptor = FLAVORS[flavor];
      const env = buildAppEnv({
        ...baseDeps,
        rawFlavor: flavor,
        isPackaged: flavor !== 'dev',
        bakedFlavor: flavor !== 'dev' ? flavor : null,
      });
      expect(env.userDataPath).toBe(path.join(APP_DATA, descriptor.dataDirName));
      expect(env.appId).toBe(descriptor.appId);
      expect(env.productName).toBe(descriptor.productName);
      expect(env.descriptor).toBe(descriptor);
    });
  }

  describe('userDataOverride (BFC_USER_DATA_DIR)', () => {
    it('is used verbatim as userDataPath when unpackaged', () => {
      const env = buildAppEnv({
        ...baseDeps,
        rawFlavor: 'dev',
        isPackaged: false,
        userDataOverride: 'C:\\temp\\bfc-smoke-abc123',
      });
      expect(env.userDataPath).toBe('C:\\temp\\bfc-smoke-abc123');
    });

    it('is ignored when packaged — the flavor path wins even though an override was set', () => {
      const env = buildAppEnv({
        ...baseDeps,
        rawFlavor: 'beta',
        isPackaged: true,
        bakedFlavor: 'beta',
        userDataOverride: 'C:\\temp\\should-be-ignored',
      });
      expect(env.userDataPath).toBe(path.join(APP_DATA, FLAVORS.beta.dataDirName));
      expect(env.userDataPath).not.toBe('C:\\temp\\should-be-ignored');
    });

    it('an absent override behaves byte-identically to not passing the field at all', () => {
      const withoutField = buildAppEnv({ ...baseDeps, rawFlavor: 'dev' });
      const withUndefined = buildAppEnv({ ...baseDeps, rawFlavor: 'dev', userDataOverride: undefined });
      expect(withUndefined.userDataPath).toBe(withoutField.userDataPath);
      expect(withUndefined.userDataPath).toBe(path.join(APP_DATA, FLAVORS.dev.dataDirName));
    });

    it('an empty-string override is treated as absent (falls back to the flavor path)', () => {
      const env = buildAppEnv({ ...baseDeps, rawFlavor: 'dev', isPackaged: false, userDataOverride: '' });
      expect(env.userDataPath).toBe(path.join(APP_DATA, FLAVORS.dev.dataDirName));
    });
  });
});

describe('resolveAppEnv', () => {
  it('returns the same object on repeated calls', async () => {
    vi.resetModules();
    const { resolveAppEnv: resolveFresh } = await import('./env.js');
    const first = resolveFresh();
    const second = resolveFresh();
    expect(second).toBe(first);
  });

  it('threads process.env.BFC_USER_DATA_DIR through as the userDataOverride', async () => {
    vi.resetModules();
    const previous = process.env.BFC_USER_DATA_DIR;
    process.env.BFC_USER_DATA_DIR = '/tmp/bfc-smoke-xyz';
    try {
      const { resolveAppEnv: resolveFresh } = await import('./env.js');
      expect(resolveFresh().userDataPath).toBe('/tmp/bfc-smoke-xyz');
    } finally {
      if (previous === undefined) {
        delete process.env.BFC_USER_DATA_DIR;
      } else {
        process.env.BFC_USER_DATA_DIR = previous;
      }
    }
  });
});
