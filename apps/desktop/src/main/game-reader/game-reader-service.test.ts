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

// The non-fixture path reports status from real process detection. `findProcessId` is a
// PowerShell spawn; both are mocked here so every test controls whether "the game" is running
// without actually shelling out.
//
// `isProcessAlive` defaults to FALSE, which is what keeps the tests below reading as they always
// did: with no live pid to reuse, every tick falls through to `findProcessId` and the mocked
// return value drives the status directly. The cheap-path behaviour that default hides is the
// point of the change, so it is asserted explicitly in its own describe block rather than left
// implicit here.
vi.mock('./process.js', () => ({
  findProcessIdAsync: vi.fn(() => Promise.resolve(null as number | null)),
  isProcessAlive: vi.fn(() => false),
}));

// Wrapped rather than replaced, so the real parse still runs (the connected/stale gate depends
// on its actual return value) — this is a spy on call count and call arguments, used to prove the
// sequence-dedup skip below without a `mapped` snapshot to compare object identity against.
vi.mock('../live-source/tick-to-raw-state.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../live-source/tick-to-raw-state.js')>();
  return { tickToRawGameState: vi.fn(actual.tickToRawGameState) };
});

import type { AccountPayload, AccountView, LiveCurrency, LiveFrame, LiveTick } from '@bombfarm/contracts';
import { liveGap } from '@bombfarm/contracts';
import { log } from '../logging.js';
import { tickToRawGameState } from '../live-source/tick-to-raw-state.js';
import type { AccountCommitter } from './game-reader-service.js';
import { GameReaderService } from './game-reader-service.js';
import { findProcessIdAsync, isProcessAlive } from './process.js';

const mockedFindProcessId = vi.mocked(findProcessIdAsync);
const mockedIsProcessAlive = vi.mocked(isProcessAlive);
const mockedTickToRawGameState = vi.mocked(tickToRawGameState);

/** A `live` currency, the tap's own proof it is currently delivering — the signal `tickLive()`
 *  now requires before it will report `connected`, on top of a cached tick. */
function liveCurrency(at = '2026-08-22T00:00:00.000Z'): LiveCurrency {
  return { kind: 'live', lastFrameAt: at, sinceAt: at };
}

function liveFrame(tick: LiveTick, at = '2026-08-22T00:00:00.000Z', sequence = 1): LiveFrame {
  return { at, sequence, tick };
}

/** `tick()` is private; every test drives it through this cast rather than waiting on the real
 *  poll timer. Awaited, because a live tick may await a process lookup — without that, an
 *  assertion would read the status from before the lookup landed. */
async function forceTick(service: GameReaderService): Promise<void> {
  await (service as unknown as { tick(): Promise<void> }).tick();
}

describe('GameReaderService — cold boot status (design R-2)', () => {
  it('reports not_running on construction in live mode, never a restored connected status', () => {
    const service = new GameReaderService('/fake/user-data', { mode: 'live' }, { consent: () => true });
    expect(service.getStatus().status).toBe('not_running');
  });

  it('reports connected on construction in fixture mode', () => {
    const service = new GameReaderService('/fake/user-data', { mode: 'fixture' });
    expect(service.getStatus().status).toBe('connected');
  });

  it('a second instance over the same userDataDir starts fresh, independent of the first', () => {
    const first = new GameReaderService('/fake/user-data', { mode: 'live' }, { consent: () => true });
    const second = new GameReaderService('/fake/user-data', { mode: 'live' }, { consent: () => true });
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
  it('reports not_running when process detection finds nothing, regardless of any ingested tick', async () => {
    mockedFindProcessId.mockResolvedValue(null);
    const service = new GameReaderService('/fake/user-data', { mode: 'live' }, { consent: () => true });
    service.ingestLiveTick(liveFrame({ heroes: [], gold: 500, phase: 12 }));

    await forceTick(service);

    expect(service.getStatus().status).toBe('not_running');
  });

  it('reports stale — not a fabricated connected status — when the process is running but no live-tap frame has arrived yet', async () => {
    mockedFindProcessId.mockResolvedValue(4242);
    const service = new GameReaderService('/fake/user-data', { mode: 'live' }, { consent: () => true });

    await forceTick(service);

    expect(service.getStatus().status).toBe('stale');
  });

  it('reports stale when the ingested tick carries no gold, rather than inventing gold: 0', async () => {
    mockedFindProcessId.mockResolvedValue(4242);
    const service = new GameReaderService('/fake/user-data', { mode: 'live' }, { consent: () => true });
    service.ingestLiveTick(liveFrame({ heroes: [] }));

    await forceTick(service);

    expect(service.getStatus().status).toBe('stale');
  });

  it('reports connected once a real frame has been ingested and parses', async () => {
    mockedFindProcessId.mockResolvedValue(4242);
    mockedTickToRawGameState.mockClear();
    const service = new GameReaderService('/fake/user-data', { mode: 'live' }, { consent: () => true });
    const tick: LiveTick = { heroes: [], gold: 123456, phase: 26, wave: 3 };
    service.ingestLiveTick(liveFrame(tick, '2026-08-22T00:00:00.000Z'));
    service.ingestLiveCurrency(liveCurrency());

    await forceTick(service);

    expect(service.getStatus().status).toBe('connected');
    expect(mockedTickToRawGameState).toHaveBeenCalledWith(tick);
  });

  it('reports stale despite a cached tick when the tap has ingested a frame but never reported a live currency', async () => {
    // A cached tick with no accompanying proof of liveness must not read as connected — this is
    // the exact shape a caller that forgets to wire ingestLiveCurrency() would produce.
    mockedFindProcessId.mockResolvedValue(4242);
    const service = new GameReaderService('/fake/user-data', { mode: 'live' }, { consent: () => true });
    service.ingestLiveTick(liveFrame({ heroes: [], gold: 123456 }, '2026-08-22T00:00:00.000Z'));

    await forceTick(service);

    expect(service.getStatus().status).toBe('stale');
  });

  it('a later tick reflects a newer ingested frame — the parse chain tracks the tap, not a frozen first read', async () => {
    mockedFindProcessId.mockResolvedValue(4242);
    mockedTickToRawGameState.mockClear();
    const service = new GameReaderService('/fake/user-data', { mode: 'live' }, { consent: () => true });
    service.ingestLiveCurrency(liveCurrency());

    const firstTick: LiveTick = { heroes: [], gold: 100 };
    service.ingestLiveTick(liveFrame(firstTick, '2026-08-22T00:00:00.000Z', 1));
    await forceTick(service);
    expect(mockedTickToRawGameState).toHaveBeenLastCalledWith(firstTick);

    const secondTick: LiveTick = { heroes: [], gold: 900 };
    service.ingestLiveTick(liveFrame(secondTick, '2026-08-22T00:00:01.000Z', 2));
    await forceTick(service);
    expect(mockedTickToRawGameState).toHaveBeenLastCalledWith(secondTick);
    expect(service.getStatus().status).toBe('connected');
  });

  it('processes two frames that share the same `at` timestamp but carry distinct sequence numbers — the dedup key this guards against being millisecond-resolution', async () => {
    mockedFindProcessId.mockResolvedValue(4242);
    mockedTickToRawGameState.mockClear();
    const service = new GameReaderService('/fake/user-data', { mode: 'live' }, { consent: () => true });
    service.ingestLiveCurrency(liveCurrency());

    const firstTick: LiveTick = { heroes: [], gold: 100 };
    service.ingestLiveTick(liveFrame(firstTick, '2026-08-22T00:00:00.000Z', 1));
    await forceTick(service);
    expect(mockedTickToRawGameState).toHaveBeenLastCalledWith(firstTick);

    const secondTick: LiveTick = { heroes: [], gold: 900 };
    service.ingestLiveTick(liveFrame(secondTick, '2026-08-22T00:00:00.000Z', 2));
    await forceTick(service);
    expect(mockedTickToRawGameState).toHaveBeenLastCalledWith(secondTick);
  });

  it('degrades from connected to stale when the tap reports it has stopped delivering, even though the last tick is still cached — the frozen-tick regression this guards against', async () => {
    mockedFindProcessId.mockResolvedValue(4242);
    const service = new GameReaderService('/fake/user-data', { mode: 'live' }, { consent: () => true });
    const tick: LiveTick = { heroes: [], gold: 123456, phase: 26 };
    service.ingestLiveTick(liveFrame(tick, '2026-08-22T00:00:00.000Z'));
    service.ingestLiveCurrency(liveCurrency('2026-08-22T00:00:00.000Z'));

    await forceTick(service);
    expect(service.getStatus().status).toBe('connected');

    // The tap itself detects the client has stopped streaming (or the hook has gone silent) and
    // reports a gap — exactly what `Tap`'s own staleness watch does, forwarded through
    // `ingestLiveCurrency()`. No new tick ever arrives: `latestLiveTick` is untouched.
    service.ingestLiveCurrency(liveGap('clientNotStreaming', '2026-08-22T00:01:00.000Z'));

    await forceTick(service);

    expect(service.getStatus().status).toBe('stale');
  });

  it('reports not_running (never a stale connected) when the process disappears entirely, even with a live currency still cached', async () => {
    mockedFindProcessId.mockResolvedValue(4242);
    const service = new GameReaderService('/fake/user-data', { mode: 'live' }, { consent: () => true });
    service.ingestLiveTick(liveFrame({ heroes: [], gold: 500 }, '2026-08-22T00:00:00.000Z'));
    service.ingestLiveCurrency(liveCurrency());
    await forceTick(service);
    expect(service.getStatus().status).toBe('connected');

    mockedFindProcessId.mockResolvedValue(null);
    await forceTick(service);

    expect(service.getStatus().status).toBe('not_running');
  });

  it('does not re-run the parse chain for an unchanged frame', async () => {
    mockedFindProcessId.mockResolvedValue(4242);
    mockedTickToRawGameState.mockClear();
    const service = new GameReaderService('/fake/user-data', { mode: 'live' }, { consent: () => true });
    service.ingestLiveTick(liveFrame({ heroes: [], gold: 123456, phase: 26 }, '2026-08-22T00:00:00.000Z'));
    service.ingestLiveCurrency(liveCurrency());

    await forceTick(service);
    expect(service.getStatus().status).toBe('connected');
    expect(mockedTickToRawGameState).toHaveBeenCalledTimes(1);

    // Same cached frame, no new ingestLiveTick() in between — the poll that finds nothing new
    // must not re-run the parse from scratch.
    await forceTick(service);

    expect(service.getStatus().status).toBe('connected');
    expect(mockedTickToRawGameState).toHaveBeenCalledTimes(1);
  });

  it('reports a staleAgeMs derived from the tap-reported gap\'s sinceAt when the tap has stalled', async () => {
    mockedFindProcessId.mockResolvedValue(4242);
    const service = new GameReaderService('/fake/user-data', { mode: 'live' }, { consent: () => true });
    const sinceAt = new Date(Date.now() - 5_000).toISOString();
    service.ingestLiveCurrency(liveGap('clientNotStreaming', sinceAt));

    await forceTick(service);

    expect(service.getStatus().status).toBe('stale');
    expect(service.getStatus().staleAgeMs).toBeGreaterThanOrEqual(5_000);
    expect(service.getStatus().staleAgeMs).toBeLessThan(10_000);
  });

  it('leaves staleAgeMs unset when the process is running but no currency has ever been reported', async () => {
    mockedFindProcessId.mockResolvedValue(4242);
    const service = new GameReaderService('/fake/user-data', { mode: 'live' }, { consent: () => true });

    await forceTick(service);

    expect(service.getStatus().status).toBe('stale');
    expect(service.getStatus().staleAgeMs).toBeUndefined();
  });
});

describe('GameReaderService — consent gates the live process lookup', () => {
  it('performs zero process-list calls while consent is withheld, even with the game running', async () => {
    mockedFindProcessId.mockClear();
    mockedFindProcessId.mockResolvedValue(4242);
    const service = new GameReaderService('/fake/user-data', { mode: 'live' }, { consent: () => false });

    await forceTick(service);
    await forceTick(service);

    expect(mockedFindProcessId).not.toHaveBeenCalled();
    expect(service.getStatus().status).toBe('not_running');
  });

  it('logs nothing naming the process while consent is withheld', async () => {
    const errorSpy = vi.spyOn(log, 'error').mockClear();
    const infoSpy = vi.spyOn(log, 'info').mockClear();
    const debugSpy = vi.spyOn(log, 'debug').mockClear();
    mockedFindProcessId.mockClear();
    mockedFindProcessId.mockResolvedValue(4242);
    const service = new GameReaderService('/fake/user-data', { mode: 'live' }, { consent: () => false });

    await forceTick(service);

    const processName = service.getStatus().processName;
    for (const call of [...errorSpy.mock.calls, ...infoSpy.mock.calls, ...debugSpy.mock.calls]) {
      for (const arg of call) {
        expect(JSON.stringify(arg)).not.toContain(String(processName));
      }
    }
  });

  it('begins probing once consent is granted, and stops probing again once it is revoked', async () => {
    mockedFindProcessId.mockClear();
    mockedFindProcessId.mockResolvedValue(4242);
    let granted = false;
    const service = new GameReaderService('/fake/user-data', { mode: 'live' }, { consent: () => granted });

    await forceTick(service);
    expect(mockedFindProcessId).not.toHaveBeenCalled();
    expect(service.getStatus().status).toBe('not_running');

    // Consent absent also wipes any cached tick (the same honesty the "process not found"
    // branch already has), so the ingested frame is supplied only once probing has resumed.
    granted = true;
    service.ingestLiveTick(liveFrame({ heroes: [], gold: 500 }));
    service.ingestLiveCurrency(liveCurrency());
    await forceTick(service);
    expect(mockedFindProcessId).toHaveBeenCalledTimes(1);
    expect(service.getStatus().status).toBe('connected');

    granted = false;
    await forceTick(service);
    expect(mockedFindProcessId).toHaveBeenCalledTimes(1);
    expect(service.getStatus().status).toBe('not_running');
  });
});

describe('GameReaderService — pollNow nudges an immediate re-check', () => {
  it('runs a tick immediately instead of waiting out the poll interval', async () => {
    vi.useFakeTimers();
    try {
      mockedFindProcessId.mockClear();
      mockedFindProcessId.mockResolvedValue(null);
      const service = new GameReaderService('/fake/user-data', { mode: 'live' }, { consent: () => true });

      service.start();
      await vi.advanceTimersByTimeAsync(0);
      mockedFindProcessId.mockClear();

      await vi.advanceTimersByTimeAsync(9_000);
      expect(mockedFindProcessId).not.toHaveBeenCalled();

      service.pollNow();
      await vi.advanceTimersByTimeAsync(0);

      expect(mockedFindProcessId).toHaveBeenCalledTimes(1);
      service.stop();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('GameReaderService — account store wiring (T10, design §8)', () => {
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

  it('never calls accountStore.commit() from a live (non-fixture) tick — sourced from the authenticated route', async () => {
    mockedFindProcessId.mockResolvedValue(4242);
    const { committer, calls } = fakeCommitter();
    const service = new GameReaderService('/fake/user-data', { mode: 'live' }, { consent: () => true });
    service.setAccountStore(committer);
    service.ingestLiveTick(liveFrame({ heroes: [], gold: 500 }));

    await forceTick(service);
    await forceTick(service);

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
  it('stop() latches immediately — a tick invoked after stop() never reaches accountStore.commit() again', async () => {
    const { committer, calls } = fakeCommitter();
    const service = new GameReaderService('/fake/user-data', { mode: 'fixture' });
    service.setAccountStore(committer);

    service.start();
    expect(calls).toHaveLength(1); // start()'s own synchronous tick commits once
    service.stop();

    // Simulate a timer callback that still fires after stop() cleared it (the private
    // dispatcher is exactly what scheduleNext()'s setTimeout callback invokes).
    await forceTick(service);

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

  it('does not push a status event for ticks that only carry a newer read timestamp', async () => {
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
      await forceTick(service);
    }
    service.stop();

    // Every one of those ticks stamps a fresh `updatedAt` while the status itself is unchanged.
    // Comparing whole objects made each one a change, so the renderer took a state update — and
    // re-rendered the whole content area — at the poll interval.
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

describe('GameReaderService — onConnected fires only on a transition into connected', () => {
  it('fires exactly once when a poll first reports connected', async () => {
    mockedFindProcessId.mockResolvedValue(4242);
    const service = new GameReaderService('/fake/user-data', { mode: 'live' }, { consent: () => true });
    const onConnected = vi.fn();
    service.onConnected = onConnected;
    service.ingestLiveTick(liveFrame({ heroes: [], gold: 500 }));
    service.ingestLiveCurrency(liveCurrency());

    await forceTick(service);

    expect(service.getStatus().status).toBe('connected');
    expect(onConnected).toHaveBeenCalledTimes(1);
  });

  it('does not fire again while later polls keep reporting connected', async () => {
    mockedFindProcessId.mockResolvedValue(4242);
    const service = new GameReaderService('/fake/user-data', { mode: 'live' }, { consent: () => true });
    const onConnected = vi.fn();
    service.onConnected = onConnected;
    service.ingestLiveTick(liveFrame({ heroes: [], gold: 500 }));
    service.ingestLiveCurrency(liveCurrency());

    await forceTick(service);
    await forceTick(service);
    await forceTick(service);

    expect(service.getStatus().status).toBe('connected');
    expect(onConnected).toHaveBeenCalledTimes(1);
  });

  it('does not fire on a transition into a non-connected status', async () => {
    mockedFindProcessId.mockResolvedValue(null);
    const service = new GameReaderService('/fake/user-data', { mode: 'live' }, { consent: () => true });
    const onConnected = vi.fn();
    service.onConnected = onConnected;

    await forceTick(service);

    expect(service.getStatus().status).toBe('not_running');
    expect(onConnected).not.toHaveBeenCalled();
  });

  it('fires again on a second transition after dropping back to a non-connected status in between', async () => {
    mockedFindProcessId.mockResolvedValue(4242);
    const service = new GameReaderService('/fake/user-data', { mode: 'live' }, { consent: () => true });
    const onConnected = vi.fn();
    service.onConnected = onConnected;
    service.ingestLiveTick(liveFrame({ heroes: [], gold: 500 }));
    service.ingestLiveCurrency(liveCurrency());

    await forceTick(service);
    expect(onConnected).toHaveBeenCalledTimes(1);

    mockedFindProcessId.mockResolvedValue(null);
    await forceTick(service);
    expect(onConnected).toHaveBeenCalledTimes(1);

    mockedFindProcessId.mockResolvedValue(4242);
    // The not_running branch wipes the cached tick/currency (the same honesty
    // "consent withdrawn" already has), so a reconnect needs a fresh frame before it can settle
    // on connected again rather than a stale one.
    service.ingestLiveTick(liveFrame({ heroes: [], gold: 500 }, '2026-08-22T00:00:01.000Z', 2));
    service.ingestLiveCurrency(liveCurrency('2026-08-22T00:00:01.000Z'));
    await forceTick(service);

    expect(service.getStatus().status).toBe('connected');
    expect(onConnected).toHaveBeenCalledTimes(2);
  });
});

/**
 * A gold-per-hour readout needs a balance that moves. The fixture account is a still photograph,
 * so before this the balance sat at its captured value for the whole session and any rate built
 * on it read zero — with the replay tap delivering the capture's own gold the entire time.
 */
describe('fixture mode advances the account balance from the streamed gold', () => {
  /** Read from the first commit rather than hardcoded: which payload `buildFixtureAccountPayload`
   *  loads depends on whether `BFC_FIXTURE_ACCOUNT_FILE` is set, and what this asserts is the
   *  GAIN applied on top of that baseline, whatever it happens to be. */
  /** Comfortably past `pollAttachedMs`, so one advance is one further fixture tick. */
  const ONE_TICK_MS = 80;

  function fixtureService() {
    const committed: AccountPayload[] = [];
    const service = new GameReaderService(
      '/fake/user-data',
      { mode: 'fixture' },
      { isPackaged: false, consent: () => true },
    );
    service.setAccountStore({
      commit: (live) => {
        committed.push(live);
        return { payload: live, gameRunning: true, store: { status: 'ok', reason: null, binding: null } };
      },
    });
    return { service, committed };
  }

  function frameWithGold(gold: number, sequence: number): LiveFrame {
    return { at: new Date(sequence).toISOString(), sequence, tick: { heroes: [], gold } };
  }

  function latestGold(committed: readonly AccountPayload[]): number {
    const account = committed[committed.length - 1]?.account;
    return Number(account?.gold);
  }

  it('holds the fixture baseline until a frame has arrived', async () => {
    vi.useFakeTimers();
    try {
      const { service, committed } = fixtureService();
      service.start();
      await vi.advanceTimersByTimeAsync(ONE_TICK_MS);
      service.stop();

      expect(committed.length).toBeGreaterThan(0);
      const baseline = Number((committed[0]?.account as Record<string, unknown>).gold);
      expect(Number.isFinite(baseline)).toBe(true);
      expect(latestGold(committed)).toBe(baseline);
    } finally {
      vi.useRealTimers();
    }
  });

  it("adds what the stream earned, rather than adopting the capture account's own balance", async () => {
    vi.useFakeTimers();
    try {
      const { service, committed } = fixtureService();
      service.start();
      const baseline = Number((committed[0]?.account as Record<string, unknown>).gold);

      service.ingestLiveTick(frameWithGold(36_736_079, 1));
      await vi.advanceTimersByTimeAsync(ONE_TICK_MS);
      service.ingestLiveTick(frameWithGold(36_767_047, 2));
      await vi.advanceTimersByTimeAsync(ONE_TICK_MS);
      service.stop();

      // The capture's own balance is ~36.7M; the fixture's is its own. What lands is the fixture's
      // plus the stream's gain, never the capture's total.
      expect(latestGold(committed)).toBe(baseline + (36_767_047 - 36_736_079));
      expect(latestGold(committed)).not.toBe(36_767_047);
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps the balance a digit string, the way the wire sends it', async () => {
    vi.useFakeTimers();
    try {
      const { service, committed } = fixtureService();
      service.start();
      service.ingestLiveTick(frameWithGold(36_736_079, 1));
      await vi.advanceTimersByTimeAsync(ONE_TICK_MS);
      service.ingestLiveTick(frameWithGold(36_740_000, 2));
      await vi.advanceTimersByTimeAsync(ONE_TICK_MS);
      service.stop();

      const account = committed[committed.length - 1]?.account as Record<string, unknown>;
      expect(typeof account.gold).toBe('string');
    } finally {
      vi.useRealTimers();
    }
  });

  it('never lets the balance fall, even if a later frame reports less gold', async () => {
    vi.useFakeTimers();
    try {
      const { service, committed } = fixtureService();
      service.start();
      service.ingestLiveTick(frameWithGold(36_767_047, 1));
      await vi.advanceTimersByTimeAsync(ONE_TICK_MS);
      const high = latestGold(committed);

      service.ingestLiveTick(frameWithGold(36_736_079, 2));
      await vi.advanceTimersByTimeAsync(ONE_TICK_MS);
      service.stop();

      expect(latestGold(committed)).toBeGreaterThanOrEqual(high);
    } finally {
      vi.useRealTimers();
    }
  });
});

/**
 * The balance this mode commits is persisted, so a reading that fell would be written to disk.
 * These drive the paths a reset could arrive on — a stop/start cycle, and a cleared frame cache —
 * rather than only the happy sequence.
 */
describe('the streamed balance never falls, whatever resets upstream', () => {
  const ONE_TICK_MS = 80;

  function fixtureService() {
    const committed: AccountPayload[] = [];
    const service = new GameReaderService(
      '/fake/user-data',
      { mode: 'fixture' },
      { isPackaged: false, consent: () => true },
    );
    service.setAccountStore({
      commit: (live) => {
        committed.push(live);
        return { payload: live, gameRunning: true, store: { status: 'ok', reason: null, binding: null } };
      },
    });
    return { service, committed };
  }

  function frameWithGold(gold: number, sequence: number): LiveFrame {
    return { at: new Date(sequence).toISOString(), sequence, tick: { heroes: [], gold } };
  }

  function latestGold(committed: readonly AccountPayload[]): number {
    return Number(committed[committed.length - 1]?.account?.gold);
  }

  it('holds the earned balance across a stop and a restart', async () => {
    vi.useFakeTimers();
    try {
      const { service, committed } = fixtureService();
      service.start();
      service.ingestLiveTick(frameWithGold(36_736_079, 1));
      await vi.advanceTimersByTimeAsync(ONE_TICK_MS);
      service.ingestLiveTick(frameWithGold(36_767_047, 2));
      await vi.advanceTimersByTimeAsync(ONE_TICK_MS);
      const earned = latestGold(committed);
      service.stop();

      // A restart re-baselining on the next frame would silently give the whole gain back.
      service.start();
      service.ingestLiveTick(frameWithGold(36_767_047, 3));
      await vi.advanceTimersByTimeAsync(ONE_TICK_MS);
      service.stop();

      expect(latestGold(committed)).toBeGreaterThanOrEqual(earned);
    } finally {
      vi.useRealTimers();
    }
  });

  it('holds it when a frame arrives reporting a balance below the first one seen', async () => {
    vi.useFakeTimers();
    try {
      const { service, committed } = fixtureService();
      service.start();
      service.ingestLiveTick(frameWithGold(36_767_047, 1));
      await vi.advanceTimersByTimeAsync(ONE_TICK_MS);
      service.ingestLiveTick(frameWithGold(36_800_000, 2));
      await vi.advanceTimersByTimeAsync(ONE_TICK_MS);
      const earned = latestGold(committed);

      service.ingestLiveTick(frameWithGold(1_000, 3));
      await vi.advanceTimersByTimeAsync(ONE_TICK_MS);
      service.stop();

      expect(latestGold(committed)).toBe(earned);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('GameReaderService — the recurring tick must never spawn a process', () => {
  /**
   * Finding the game costs a PowerShell cold start: ~166ms with Electron's single-threaded main
   * process blocked for all of it. This tick runs every 50ms while the game is connected, so
   * paying that here meant the main process sat inside a child process more than three times its
   * own poll budget, permanently. The window message loop is on that same thread, which is why a
   * window being dragged froze and jumped in step with it.
   *
   * Checking a pid already in hand is a syscall instead. These assert the CALL COUNT, not the
   * resulting status: the status is identical either way, so a status assertion would pass with
   * the whole cheap path deleted.
   */
  it('looks the game up once, then verifies the pid it already holds instead of looking again', async () => {
    mockedFindProcessId.mockResolvedValue(4242);
    mockedIsProcessAlive.mockReturnValue(true);
    const service = new GameReaderService('/fake/user-data', { mode: 'live' }, { consent: () => true });
    mockedFindProcessId.mockClear();

    for (let i = 0; i < 20; i++) await forceTick(service);

    expect(mockedFindProcessId).toHaveBeenCalledTimes(1);
    expect(mockedIsProcessAlive).toHaveBeenCalledWith(4242);
  });

  it('looks again as soon as the process it was holding is gone, rather than reporting a dead pid', async () => {
    mockedFindProcessId.mockResolvedValue(4242);
    mockedIsProcessAlive.mockReturnValue(true);
    const service = new GameReaderService('/fake/user-data', { mode: 'live' }, { consent: () => true });
    await forceTick(service);
    mockedFindProcessId.mockClear();

    // The game exits: the held pid stops existing, and nothing else has changed.
    mockedIsProcessAlive.mockReturnValue(false);
    mockedFindProcessId.mockResolvedValue(null);
    await forceTick(service);

    expect(mockedFindProcessId).toHaveBeenCalledTimes(1);
    expect(service.getStatus().status).toBe('not_running');
  });

  it('does not keep a pid it is no longer allowed to have once consent is withdrawn', async () => {
    mockedFindProcessId.mockResolvedValue(4242);
    mockedIsProcessAlive.mockReturnValue(true);
    let granted = true;
    const service = new GameReaderService('/fake/user-data', { mode: 'live' }, { consent: () => granted });
    await forceTick(service);

    granted = false;
    await forceTick(service);
    mockedFindProcessId.mockClear();
    mockedIsProcessAlive.mockClear();

    granted = true;
    await forceTick(service);

    // Nothing was carried across the revocation: the pid is found again from scratch.
    expect(mockedIsProcessAlive).not.toHaveBeenCalled();
    expect(mockedFindProcessId).toHaveBeenCalledTimes(1);
  });
});
