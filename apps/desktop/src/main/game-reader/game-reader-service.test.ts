import { describe, expect, it, vi } from 'vitest';

// game-reader-service.ts imports ../logging.js, which imports electron-log/main.js (fails
// outside a running Electron process) and env.js (imports electron's `app`). Neither has ever
// been exercised in a plain vitest run before this file — mirror the mocking shape already
// established in env.test.ts / logging.test.ts.
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

import { GameReaderService } from './game-reader-service.js';

describe('GameReaderService — cold boot status (design R-2 / APS-03)', () => {
  it('reports not_running on construction in memory mode, never a restored connected status', () => {
    const service = new GameReaderService('/fake/user-data', { mode: 'memory' });
    expect(service.getStatus().status).toBe('not_running');
  });

  it('reports connected on construction in fixture mode', () => {
    const service = new GameReaderService('/fake/user-data', { mode: 'fixture' });
    expect(service.getStatus().status).toBe('connected');
  });

  it('starts with no mapped snapshot and no raw state/inventory — nothing restored from disk', () => {
    const service = new GameReaderService('/fake/user-data', { mode: 'memory' });
    const snapshot = service.getSnapshot();
    expect(snapshot.mapped).toBeNull();
    expect(snapshot.raw).toEqual({ state: null, inventory: null });
  });

  it('a second instance over the same userDataDir starts fresh, independent of the first', () => {
    const first = new GameReaderService('/fake/user-data', { mode: 'memory' });
    const second = new GameReaderService('/fake/user-data', { mode: 'memory' });
    expect(second.getStatus()).toEqual(first.getStatus());
    expect(second.getStatus().status).toBe('not_running');
  });
});
