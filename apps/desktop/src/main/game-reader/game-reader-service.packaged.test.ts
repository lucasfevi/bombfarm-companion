import { afterEach, describe, expect, it, vi } from 'vitest';

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

describe('GameReaderService — packaged boot, fixtures unresolvable (live mode)', () => {
  it('constructs without throwing', () => {
    expect(() => new GameReaderService('/fake/user-data', { mode: 'live' })).not.toThrow();
  });

  it('starts and ticks without throwing', () => {
    const service = new GameReaderService('/fake/user-data', { mode: 'live' });
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

describe('GameReaderService — default mode selection respects isPackaged', () => {
  const savedEnv = process.env.BFC_GAME_READER;

  afterEach(() => {
    if (savedEnv === undefined) delete process.env.BFC_GAME_READER;
    else process.env.BFC_GAME_READER = savedEnv;
  });

  it('does not select fixture mode when packaged, even with BFC_GAME_READER=fixture set', () => {
    process.env.BFC_GAME_READER = 'fixture';
    const service = new GameReaderService('/fake/user-data', {}, { isPackaged: true });
    expect(service.getMode()).toBe('live');
    expect(service.getStatus().status).toBe('not_running');
  });

  it('still selects fixture mode when unpackaged and BFC_GAME_READER=fixture is set', () => {
    process.env.BFC_GAME_READER = 'fixture';
    const service = new GameReaderService('/fake/user-data', {}, { isPackaged: false });
    expect(service.getMode()).toBe('fixture');
    expect(service.getStatus().status).toBe('connected');
  });
});
