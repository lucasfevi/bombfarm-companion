import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getPath: () => '/appdata',
    getAppPath: () => '/app',
  },
}));

vi.mock('electron-log/main.js', () => ({
  default: {
    transports: {
      file: { level: undefined as string | false | undefined },
      console: { level: undefined as string | false | undefined },
    },
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Simulates a packaged install: the game-data fixtures directory (a dev/CI-only asset that is
// never shipped in the installer) is not resolvable from any of resolveFixturesDir()'s candidate
// paths.
vi.mock('./fixture-data.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./fixture-data.js')>();
  return {
    ...actual,
    loadFixtureBundle: () => {
      throw new Error('game-data fixtures directory not found');
    },
  };
});

import { GameReaderService } from './game-reader-service.js';

describe('GameReaderService — packaged boot, fixtures unresolvable (memory mode)', () => {
  it('constructs without throwing', () => {
    expect(() => new GameReaderService('/fake/user-data', { mode: 'memory' })).not.toThrow();
  });

  it('starts and ticks without throwing', () => {
    const service = new GameReaderService('/fake/user-data', { mode: 'memory' });
    expect(() => {
      service.start();
      service.stop();
    }).not.toThrow();
  });
});

describe('GameReaderService — fixture mode, fixtures genuinely missing', () => {
  it('throws a clear error only when the fixture loader is actually reached', () => {
    const service = new GameReaderService('/fake/user-data', { mode: 'fixture' });
    expect(() => (service as unknown as { getFixtureBundle(): unknown }).getFixtureBundle()).toThrow(
      /game-data fixtures directory not found/,
    );
  });
});
