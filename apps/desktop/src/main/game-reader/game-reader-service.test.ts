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

import type { AccountPayload, AccountView } from '@bombfarm/contracts';
import type { AccountCommitter } from './game-reader-service.js';
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
    // Compare everything but updatedAt directly -- two back-to-back `new Date().toISOString()`
    // calls may legitimately land in different milliseconds under load.
    const { updatedAt: _firstUpdatedAt, ...firstRest } = first.getStatus();
    const { updatedAt: secondUpdatedAt, ...secondRest } = second.getStatus();
    expect(secondRest).toEqual(firstRest);
    expect(secondUpdatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(second.getStatus().status).toBe('not_running');
  });
});

describe('GameReaderService — account store wiring (T10, design §8/TD-8)', () => {
  const FAKE_VIEW: AccountView = {
    payload: {},
    gameRunning: true,
    store: { status: 'ok', reason: null, binding: 'node:sqlite' },
  };

  function fakeCommitter(): { committer: AccountCommitter; calls: [AccountPayload, { gameRunning: boolean }][] } {
    const calls: [AccountPayload, { gameRunning: boolean }][] = [];
    return {
      committer: {
        commit: (live, opts) => {
          calls.push([live, opts]);
          return FAKE_VIEW;
        },
      },
      calls,
    };
  }

  it('has no account view before any tick has run', () => {
    const service = new GameReaderService('/fake/user-data', { mode: 'fixture' });
    expect(service.getAccountView()).toBeNull();
  });

  it('calls accountStore.commit() with a partially-resolved payload on a fixture tick', () => {
    const { committer, calls } = fakeCommitter();
    const service = new GameReaderService('/fake/user-data', { mode: 'fixture' });
    service.setAccountStore(committer);

    service.start();
    service.stop();

    expect(calls).toHaveLength(1);
    const call = calls[0];
    if (!call) throw new Error('expected a recorded commit call');
    const [live, opts] = call;
    expect(opts).toEqual({ gameRunning: true });
    expect(live.fidelity?.account.status).toBe('resolved');
    expect(live.fidelity?.heroes.status).toBe('resolved');
    expect(live.fidelity?.items.status).toBe('resolved');
    expect(live.fidelity?.skills.status).toBe('missing');
    expect(live.fidelity?.casa.status).toBe('missing');
    expect(service.getAccountView()).toBe(FAKE_VIEW);
  });

  it('does not call accountStore.commit() during a memory-mode tick (F2 owns that call site)', async () => {
    const { committer, calls } = fakeCommitter();
    const service = new GameReaderService('/fake/user-data', { mode: 'memory', pollDetachedMs: 5 });
    service.setAccountStore(committer);

    service.start();
    await new Promise((resolve) => setTimeout(resolve, 200));
    service.stop();

    expect(calls).toHaveLength(0);
    expect(service.getAccountView()).toBeNull();
  }, 10_000);

  it('does nothing when no account store has been set (fixture mode)', () => {
    const service = new GameReaderService('/fake/user-data', { mode: 'fixture' });
    expect(() => {
      service.start();
      service.stop();
    }).not.toThrow();
    expect(service.getAccountView()).toBeNull();
  });
});
