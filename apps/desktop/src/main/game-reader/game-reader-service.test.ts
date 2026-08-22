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

// The non-fixture path now reports status from real process detection (`findProcessId`,
// process.ts — a synchronous PowerShell spawn, deliberately left untouched and out of scope
// for this feature). Mocked here so every test controls whether "the game" is running without
// actually shelling out, the same way `process.ts` itself is never exercised for real in a unit
// test elsewhere in this repo.
vi.mock('./process.js', () => ({
  findProcessId: vi.fn(() => null as number | null),
}));

import type { AccountPayload, AccountView, LiveCurrency, LiveTick } from '@bombfarm/contracts';
import { liveGap } from '@bombfarm/contracts';
import type { AccountCommitter } from './game-reader-service.js';
import { GameReaderService } from './game-reader-service.js';
import { findProcessId } from './process.js';

const mockedFindProcessId = vi.mocked(findProcessId);

/** A `live` currency, the tap's own proof it is currently delivering — the signal `tickLive()`
 *  now requires before it will report `connected`, on top of a cached tick. */
function liveCurrency(at = '2026-08-22T00:00:00.000Z'): LiveCurrency {
  return { kind: 'live', lastFrameAt: at, sinceAt: at };
}

describe('GameReaderService — cold boot status (design R-2 / APS-03)', () => {
  it('reports not_running on construction in memory mode, never a restored connected status', () => {
    const service = new GameReaderService('/fake/user-data', { mode: 'live' });
    expect(service.getStatus().status).toBe('not_running');
  });

  it('reports connected on construction in fixture mode', () => {
    const service = new GameReaderService('/fake/user-data', { mode: 'fixture' });
    expect(service.getStatus().status).toBe('connected');
  });

  it('starts with no mapped snapshot and no raw state/inventory — nothing restored from disk', () => {
    const service = new GameReaderService('/fake/user-data', { mode: 'live' });
    const snapshot = service.getSnapshot();
    expect(snapshot.mapped).toBeNull();
    expect(snapshot.raw).toEqual({ state: null, inventory: null });
  });

  it('a second instance over the same userDataDir starts fresh, independent of the first', () => {
    const first = new GameReaderService('/fake/user-data', { mode: 'live' });
    const second = new GameReaderService('/fake/user-data', { mode: 'live' });
    // Compare everything but updatedAt directly -- two back-to-back `new Date().toISOString()`
    // calls may legitimately land in different milliseconds under load.
    const { updatedAt: _firstUpdatedAt, ...firstRest } = first.getStatus();
    const { updatedAt: secondUpdatedAt, ...secondRest } = second.getStatus();
    expect(secondRest).toEqual(firstRest);
    expect(secondUpdatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(second.getStatus().status).toBe('not_running');
  });
});

describe('GameReaderService — the live (non-fixture) tick never fabricates a reading', () => {
  it('reports not_running when process detection finds nothing, regardless of any ingested tick', () => {
    mockedFindProcessId.mockReturnValue(null);
    const service = new GameReaderService('/fake/user-data', { mode: 'live' });
    service.ingestLiveTick({ heroes: [], gold: 500, phase: 12 });

    (service as unknown as { tick(): void }).tick();

    expect(service.getStatus().status).toBe('not_running');
    expect(service.getSnapshot().mapped).toBeNull();
  });

  it('reports stale — not a fabricated snapshot — when the process is running but no live-tap frame has arrived yet', () => {
    mockedFindProcessId.mockReturnValue(4242);
    const service = new GameReaderService('/fake/user-data', { mode: 'live' });

    (service as unknown as { tick(): void }).tick();

    expect(service.getStatus().status).toBe('stale');
    expect(service.getSnapshot().mapped).toBeNull();
  });

  it('reports stale when the ingested tick carries no gold, rather than inventing gold: 0', () => {
    mockedFindProcessId.mockReturnValue(4242);
    const service = new GameReaderService('/fake/user-data', { mode: 'live' });
    service.ingestLiveTick({ heroes: [] });

    (service as unknown as { tick(): void }).tick();

    expect(service.getStatus().status).toBe('stale');
    expect(service.getSnapshot().mapped).toBeNull();
  });

  it('reports connected and maps the snapshot from the live tap once a real frame has been ingested', () => {
    mockedFindProcessId.mockReturnValue(4242);
    const service = new GameReaderService('/fake/user-data', { mode: 'live' });
    const tick: LiveTick = { heroes: [], gold: 123456, phase: 26, wave: 3 };
    service.ingestLiveTick(tick, '2026-08-22T00:00:00.000Z');
    service.ingestLiveCurrency(liveCurrency());

    (service as unknown as { tick(): void }).tick();

    expect(service.getStatus().status).toBe('connected');
    const snapshot = service.getSnapshot();
    expect(snapshot.mapped?.gold).toBe(123456);
    expect(snapshot.mapped?.phase).toBe(26);
    expect(snapshot.raw.state).toEqual({ t: 'snap', gold: 123456, kinds: [], hps: [], phase: 26, wave: 3 });
    expect(snapshot.raw.inventory).toBeNull();
  });

  it('reports stale despite a cached tick when the tap has ingested a frame but never reported a live currency', () => {
    // A cached tick with no accompanying proof of liveness must not read as connected — this is
    // the exact shape a caller that forgets to wire ingestLiveCurrency() would produce.
    mockedFindProcessId.mockReturnValue(4242);
    const service = new GameReaderService('/fake/user-data', { mode: 'live' });
    service.ingestLiveTick({ heroes: [], gold: 123456 }, '2026-08-22T00:00:00.000Z');

    (service as unknown as { tick(): void }).tick();

    expect(service.getStatus().status).toBe('stale');
    expect(service.getSnapshot().mapped).toBeNull();
  });

  it('a later tick reflects a newer ingested frame — the snapshot channel tracks the tap, not a frozen first read', () => {
    mockedFindProcessId.mockReturnValue(4242);
    const service = new GameReaderService('/fake/user-data', { mode: 'live' });
    service.ingestLiveCurrency(liveCurrency());

    service.ingestLiveTick({ heroes: [], gold: 100 }, '2026-08-22T00:00:00.000Z');
    (service as unknown as { tick(): void }).tick();
    expect(service.getSnapshot().mapped?.gold).toBe(100);

    service.ingestLiveTick({ heroes: [], gold: 900 }, '2026-08-22T00:00:01.000Z');
    (service as unknown as { tick(): void }).tick();
    expect(service.getSnapshot().mapped?.gold).toBe(900);
  });

  it('degrades from connected to stale when the tap reports it has stopped delivering, even though the last tick is still cached — the frozen-tick regression this guards against', () => {
    mockedFindProcessId.mockReturnValue(4242);
    const service = new GameReaderService('/fake/user-data', { mode: 'live' });
    const tick: LiveTick = { heroes: [], gold: 123456, phase: 26 };
    service.ingestLiveTick(tick, '2026-08-22T00:00:00.000Z');
    service.ingestLiveCurrency(liveCurrency('2026-08-22T00:00:00.000Z'));

    (service as unknown as { tick(): void }).tick();
    expect(service.getStatus().status).toBe('connected');
    expect(service.getSnapshot().mapped?.gold).toBe(123456);

    // The tap itself detects the client has stopped streaming (or the hook has gone silent) and
    // reports a gap — exactly what `Tap`'s own staleness watch does, forwarded through
    // `ingestLiveCurrency()`. No new tick ever arrives: `latestLiveTick` is untouched.
    service.ingestLiveCurrency(liveGap('clientNotStreaming', '2026-08-22T00:01:00.000Z'));

    (service as unknown as { tick(): void }).tick();

    expect(service.getStatus().status).toBe('stale');
    // The previous snapshot is left in place rather than being wiped — only the status flips.
    expect(service.getSnapshot().mapped?.gold).toBe(123456);
  });

  it('reports not_running (never a stale connected) when the process disappears entirely, even with a live currency still cached', () => {
    mockedFindProcessId.mockReturnValue(4242);
    const service = new GameReaderService('/fake/user-data', { mode: 'live' });
    service.ingestLiveTick({ heroes: [], gold: 500 }, '2026-08-22T00:00:00.000Z');
    service.ingestLiveCurrency(liveCurrency());
    (service as unknown as { tick(): void }).tick();
    expect(service.getStatus().status).toBe('connected');

    mockedFindProcessId.mockReturnValue(null);
    (service as unknown as { tick(): void }).tick();

    expect(service.getStatus().status).toBe('not_running');
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

  it('never calls accountStore.commit() from a live (non-fixture) tick — F2 owns that call site, sourced from the authenticated route', () => {
    mockedFindProcessId.mockReturnValue(4242);
    const { committer, calls } = fakeCommitter();
    const service = new GameReaderService('/fake/user-data', { mode: 'live' });
    service.setAccountStore(committer);
    service.ingestLiveTick({ heroes: [], gold: 500 });

    (service as unknown as { tick(): void }).tick();
    (service as unknown as { tick(): void }).tick();

    expect(calls).toHaveLength(0);
    expect(service.getAccountView()).toBeNull();
  });

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

    // Recovers the same way tickLive() already does: logged and marked stale, not left
    // mid-crash.
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

describe('GameReaderService — status pushes', () => {
  function statusSpy() {
    const channels: string[] = [];
    const provider = () =>
      ({
        webContents: {
          send: (channel: string) => {
            channels.push(channel);
          },
        },
      }) as never;
    return { provider, channels };
  }

  const statusPushes = (channels: string[]) =>
    channels.filter((channel) => channel === 'bfc:event:game:status').length;

  it('does not push a status event for ticks that only carry a newer read timestamp', () => {
    const { provider, channels } = statusSpy();
    const service = new GameReaderService('/fake/user-data', { mode: 'fixture' });
    service.setWindowProvider(provider);

    service.start();
    // start() settles on `connected`, which is a genuine transition and does push once.
    const afterStart = statusPushes(channels);

    // `updatedAt` is an ISO string, so ticks inside one millisecond stamp the SAME value and
    // would not have re-emitted even under the old whole-object comparison. Step the clock
    // between ticks so every one of them genuinely carries a newer timestamp — otherwise this
    // test could pass with the defect present.
    for (let i = 0; i < 20; i += 1) {
      const startedAt = Date.now();
      while (Date.now() === startedAt) {
        /* advance past this millisecond */
      }
      (service as unknown as { tick(): void }).tick();
    }
    service.stop();

    // Every one of those ticks stamps a fresh `updatedAt` while the status itself is unchanged.
    // Comparing whole objects made each one a change, so the renderer took a state update — and
    // re-rendered everything above the planning tree — at the poll interval.
    expect(statusPushes(channels)).toBe(afterStart);
  });

  it('still pushes when the status itself changes', () => {
    const { provider, channels } = statusSpy();
    const service = new GameReaderService('/fake/user-data', { mode: 'fixture' });
    service.setWindowProvider(provider);

    service.start();
    const afterStart = statusPushes(channels);

    (
      service as unknown as { updateStatus(next: { status: string; updatedAt: string }): void }
    ).updateStatus({ status: 'stale', updatedAt: new Date().toISOString() });
    service.stop();

    expect(statusPushes(channels)).toBe(afterStart + 1);
  });
});
