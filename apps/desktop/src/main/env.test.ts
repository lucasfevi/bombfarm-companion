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
    const env = buildAppEnv({ ...baseDeps, rawFlavor: ' BETA ' });
    expect(env.flavor).toBe('beta');
    expect(env.productName).toBe('Bomb Farm Companion (Beta)');
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
      rawFlavor: 'beta',
    });
    expect(env.flavor).toBe('prod');
    expect(env.envConflict).toEqual({ requested: 'beta', effective: 'prod' });
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

  it('marks isDev when NODE_ENV is explicitly development', () => {
    expect(buildAppEnv({ ...baseDeps, rawFlavor: 'dev' }).isDev).toBe(true);
  });

  describe('isDev', () => {
    it('is true when unpackaged and NODE_ENV is development, with no renderer URL override', () => {
      const env = buildAppEnv({
        ...baseDeps,
        rawFlavor: 'dev',
        isPackaged: false,
        nodeEnv: 'development',
        rendererUrlOverride: undefined,
      });
      expect(env.isDev).toBe(true);
    });

    it('is true when unpackaged and a renderer URL override is set, with NODE_ENV unset', () => {
      const env = buildAppEnv({
        ...baseDeps,
        rawFlavor: 'dev',
        isPackaged: false,
        nodeEnv: undefined,
        rendererUrlOverride: 'http://127.0.0.1:3000',
      });
      expect(env.isDev).toBe(true);
    });

    it('is true when unpackaged with both signals set', () => {
      const env = buildAppEnv({
        ...baseDeps,
        rawFlavor: 'dev',
        isPackaged: false,
        nodeEnv: 'development',
        rendererUrlOverride: 'http://127.0.0.1:3000',
      });
      expect(env.isDev).toBe(true);
    });

    it('is false when unpackaged with neither NODE_ENV nor a renderer URL override set', () => {
      const env = buildAppEnv({
        ...baseDeps,
        rawFlavor: 'dev',
        isPackaged: false,
        nodeEnv: undefined,
        rendererUrlOverride: undefined,
      });
      expect(env.isDev).toBe(false);
    });

    it('is false when unpackaged and NODE_ENV is production', () => {
      const env = buildAppEnv({
        ...baseDeps,
        rawFlavor: 'dev',
        isPackaged: false,
        nodeEnv: 'production',
        rendererUrlOverride: undefined,
      });
      expect(env.isDev).toBe(false);
    });

    it('is false when packaged, even with NODE_ENV development and a renderer URL override set', () => {
      const env = buildAppEnv({
        ...baseDeps,
        rawFlavor: 'beta',
        isPackaged: true,
        bakedFlavor: 'beta',
        nodeEnv: 'development',
        rendererUrlOverride: 'http://127.0.0.1:3000',
      });
      expect(env.isDev).toBe(false);
    });

    it('is false when packaged, even with NODE_ENV unset', () => {
      const env = buildAppEnv({
        ...baseDeps,
        rawFlavor: 'beta',
        isPackaged: true,
        bakedFlavor: 'beta',
        nodeEnv: undefined,
      });
      expect(env.isDev).toBe(false);
    });

    it('is false when packaged and NODE_ENV is production', () => {
      const env = buildAppEnv({
        ...baseDeps,
        rawFlavor: 'beta',
        isPackaged: true,
        bakedFlavor: 'beta',
        nodeEnv: 'production',
      });
      expect(env.isDev).toBe(false);
    });
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

  it('threads process.env.BFC_RENDERER_URL through as the rendererUrlOverride, driving isDev', async () => {
    vi.resetModules();
    const previousUrl = process.env.BFC_RENDERER_URL;
    process.env.BFC_RENDERER_URL = 'http://127.0.0.1:3000';
    try {
      const { resolveAppEnv: resolveFresh } = await import('./env.js');
      expect(resolveFresh().isDev).toBe(true);
    } finally {
      if (previousUrl === undefined) {
        delete process.env.BFC_RENDERER_URL;
      } else {
        process.env.BFC_RENDERER_URL = previousUrl;
      }
    }
  });
});
