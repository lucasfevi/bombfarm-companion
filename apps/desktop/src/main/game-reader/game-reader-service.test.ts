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

describe('GameReaderService — shutdown ordering (fix/fixture-tick-after-db-close)', () => {
  const FAKE_VIEW: AccountView = {
    payload: {},
    gameRunning: true,
    store: { status: 'ok', reason: null, binding: 'node:sqlite' },
  };

  function fakeCommitter(): { committer: AccountCommitter; calls: unknown[] } {
    const calls: unknown[] = [];
    return {
      committer: {
        commit: () => {
          calls.push(undefined);
          return FAKE_VIEW;
        },
      },
      calls,
    };
  }

  // Reproduces the reported crash directly: a producer whose `commit()` finds the store
  // already closed throws the SQLite driver's raw "database is not open" — exactly what
  // `AccountStore.persist()`/`getMeta()` do once the underlying handle is closed (see
  // account-store-close.test.ts for that half of the fix). Before this fix, `tick()` for
  // fixture mode called `tickFixture()` outside any try/catch, so this exception escaped the
  // `setTimeout` callback uncaught — the exact shape that pops Electron's crash dialog and
  // hangs Playwright's worker teardown for 120s.
  it('a fixture tick recovers when accountStore.commit() throws, instead of the exception escaping uncaught', () => {
    const throwingCommitter: AccountCommitter = {
      commit: () => {
        throw new Error('database is not open');
      },
    };
    const service = new GameReaderService('/fake/user-data', { mode: 'fixture' });
    service.setAccountStore(throwingCommitter);

    expect(() => {
      service.start();
    }).not.toThrow();
    service.stop();

    // Recovers the same way tickMemory() already did before this fix: logged and marked
    // stale, not left mid-crash.
    expect(service.getStatus().status).toBe('stale');
  });

  // The other half of the ordering contract: `stop()` must make every *future* tick a no-op,
  // not just rely on `clearTimeout` succeeding. This directly exercises the private `tick()`
  // dispatcher the way a `setTimeout` callback that fired despite an already-cleared timer
  // would call it — the scenario the diagnosis in the fix commit names as the second possible
  // cause of the crash ("a tick is already in-flight/scheduled when [stop] does" run).
  //
  // Before this fix there was no latch: a stray post-stop `tick()` call would run
  // `tickFixture()` (or, before the try/catch was added, throw uncaught) exactly as if
  // shutdown had never happened.
  it('stop() latches immediately — a tick invoked after stop() never reaches accountStore.commit() again', () => {
    const { committer, calls } = fakeCommitter();
    const service = new GameReaderService('/fake/user-data', { mode: 'fixture' });
    service.setAccountStore(committer);

    service.start();
    expect(calls).toHaveLength(1); // start()'s own synchronous tick commits once
    service.stop();

    // Simulate a timer callback that still fires after stop() cleared it (the private
    // dispatcher is exactly what scheduleNext()'s setTimeout callback invokes).
    (service as unknown as { tick(): void }).tick();

    expect(calls).toHaveLength(1); // unchanged — the post-stop tick was a no-op
  });
});
