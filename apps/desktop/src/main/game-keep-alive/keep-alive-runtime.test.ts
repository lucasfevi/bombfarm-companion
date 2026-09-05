import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ABSENT_DEBOUNCE_MS, LAUNCH_WAIT_MS, POLL_INTERVAL_MS } from './keep-alive.js';
import type { SteamAskOutcome } from './steam-launch.js';
import { createGameKeepAlive, createProcessPresencePort, type GameKeepAliveClock } from './keep-alive-runtime.js';

const process_ = vi.hoisted(() => ({
  findProcessIdAsync: vi.fn<(processName: string) => Promise<number | null>>(),
  isProcessAlive: vi.fn<(pid: number) => boolean>(),
}));

vi.mock('../game-reader/process.js', () => process_);

function createFakeClock(startMs = 1_000) {
  let nowMs = startMs;
  let nextHandle = 1;
  const scheduled = new Map<number, { at: number; fn: () => void }>();

  const clock: GameKeepAliveClock = {
    now: () => nowMs,
    setTimeout: (fn, ms) => {
      const handle = nextHandle++;
      scheduled.set(handle, { at: nowMs + ms, fn });
      return handle as unknown as NodeJS.Timeout;
    },
    clearTimeout: (handle) => {
      scheduled.delete(handle as unknown as number);
    },
  };

  async function settle(): Promise<void> {
    for (let i = 0; i < 20; i += 1) {
      await Promise.resolve();
    }
  }

  async function advance(ms: number): Promise<void> {
    const target = nowMs + ms;
    for (;;) {
      let dueHandle: number | null = null;
      let dueAt = Number.POSITIVE_INFINITY;
      for (const [handle, entry] of scheduled) {
        if (entry.at <= target && entry.at < dueAt) {
          dueAt = entry.at;
          dueHandle = handle;
        }
      }
      if (dueHandle === null) break;

      const due = scheduled.get(dueHandle);
      scheduled.delete(dueHandle);
      nowMs = dueAt;
      due?.fn();
      await settle();
    }
    nowMs = target;
  }

  return { clock, advance, settle, now: () => nowMs, pendingTimers: () => scheduled.size };
}

function createHarness(options: { present?: boolean; platform?: NodeJS.Platform } = {}) {
  const fakeClock = createFakeClock();
  let present = options.present ?? true;
  let releasePresence: (() => void) | null = null;

  const processPresent = vi.fn(async () => {
    if (releasePresence !== null) {
      await new Promise<void>((resolve) => {
        releasePresence = resolve;
      });
    }
    return present;
  });
  const askSteam = vi.fn((): Promise<SteamAskOutcome> => Promise.resolve('asked'));
  const log = vi.fn();

  const keepAlive = createGameKeepAlive({
    clock: fakeClock.clock,
    processPresent,
    askSteam,
    log,
    platform: options.platform ?? 'win32',
  });

  return {
    ...fakeClock,
    keepAlive,
    processPresent,
    askSteam,
    log,
    setPresent: (next: boolean) => {
      present = next;
    },
    holdPresence: () => {
      releasePresence = () => undefined;
    },
    releasePresence: async () => {
      const resolve = releasePresence;
      releasePresence = null;
      resolve?.();
      await fakeClock.settle();
    },
  };
}

type Harness = ReturnType<typeof createHarness>;

async function sightingThenAbsence(harness: Harness): Promise<void> {
  harness.keepAlive.start();
  await harness.advance(POLL_INTERVAL_MS);
  harness.setPresent(false);
  await harness.advance(POLL_INTERVAL_MS);
}

describe('the keep-alive loop asks Steam only after a game it watched disappeared', () => {
  it('a sighting, then absence, then the debounce elapsing asks Steam exactly once', async () => {
    const harness = createHarness();
    harness.keepAlive.setEnabled(true);

    await sightingThenAbsence(harness);
    expect(harness.askSteam).not.toHaveBeenCalled();

    await harness.advance(ABSENT_DEBOUNCE_MS);

    expect(harness.askSteam).toHaveBeenCalledTimes(1);

    await harness.advance(POLL_INTERVAL_MS * 4);
    expect(harness.askSteam).toHaveBeenCalledTimes(1);
  });

  it('a game that never goes away is never asked about', async () => {
    const harness = createHarness();
    harness.keepAlive.setEnabled(true);
    harness.keepAlive.start();

    await harness.advance(POLL_INTERVAL_MS * 40);

    expect(harness.processPresent.mock.calls.length).toBeGreaterThan(10);
    expect(harness.askSteam).not.toHaveBeenCalled();
  });

  it('a game absent since this companion opened is left alone, however long it stays absent', async () => {
    const harness = createHarness({ present: false });
    harness.keepAlive.setEnabled(true);
    harness.keepAlive.start();

    await harness.advance(POLL_INTERVAL_MS * 40);

    expect(harness.askSteam).not.toHaveBeenCalled();
  });
});

describe('the switch decides, and takes effect on the next poll', () => {
  it('off: nothing is asked; turned on later, the next eligible poll asks', async () => {
    const harness = createHarness();

    await sightingThenAbsence(harness);
    await harness.advance(ABSENT_DEBOUNCE_MS * 3);
    expect(harness.askSteam).not.toHaveBeenCalled();

    harness.keepAlive.setEnabled(true);

    await harness.advance(POLL_INTERVAL_MS);
    expect(harness.askSteam).not.toHaveBeenCalled();

    await harness.advance(ABSENT_DEBOUNCE_MS);
    expect(harness.askSteam).toHaveBeenCalledTimes(1);
  });

  it('turned off after the game vanished, the ask that was pending never happens', async () => {
    const harness = createHarness();
    harness.keepAlive.setEnabled(true);

    await sightingThenAbsence(harness);
    harness.keepAlive.setEnabled(false);

    await harness.advance(ABSENT_DEBOUNCE_MS * 4);

    expect(harness.askSteam).not.toHaveBeenCalled();
  });

  it('stop() ends the polling and asks nothing', async () => {
    const harness = createHarness();
    harness.keepAlive.setEnabled(true);

    await sightingThenAbsence(harness);
    harness.keepAlive.stop();
    const pollsWhenStopped = harness.processPresent.mock.calls.length;

    await harness.advance(ABSENT_DEBOUNCE_MS * 10);

    expect(harness.pendingTimers()).toBe(0);
    expect(harness.processPresent.mock.calls.length).toBe(pollsWhenStopped);
    expect(harness.askSteam).not.toHaveBeenCalled();
  });
});

describe('an ask that did not launch the game arms the next attempt immediately', () => {
  for (const outcome of ['updating', 'unavailable'] as const) {
    it(`'${outcome}' counts as a failed attempt: the poll right after it does not ask again`, async () => {
      const harness = createHarness();
      harness.askSteam.mockResolvedValue(outcome);
      harness.keepAlive.setEnabled(true);

      await sightingThenAbsence(harness);
      await harness.advance(ABSENT_DEBOUNCE_MS);
      expect(harness.askSteam).toHaveBeenCalledTimes(1);
      const askedAtMs = harness.now();

      await harness.advance(POLL_INTERVAL_MS * 2);
      expect(harness.askSteam).toHaveBeenCalledTimes(1);

      await harness.advance(POLL_INTERVAL_MS * 6);

      expect(harness.askSteam).toHaveBeenCalledTimes(2);
      expect(harness.now() - askedAtMs).toBeLessThan(LAUNCH_WAIT_MS);
    });
  }

  it('an ask that throws is swallowed, counted as failed, and the loop keeps polling', async () => {
    const rejections: unknown[] = [];
    const collect = (reason: unknown) => rejections.push(reason);
    process.on('unhandledRejection', collect);

    const harness = createHarness();
    harness.askSteam.mockRejectedValue(new Error('steam.exe is not there'));
    harness.keepAlive.setEnabled(true);

    await sightingThenAbsence(harness);
    await harness.advance(ABSENT_DEBOUNCE_MS);
    expect(harness.askSteam).toHaveBeenCalledTimes(1);
    const pollsWhenItThrew = harness.processPresent.mock.calls.length;

    await harness.advance(POLL_INTERVAL_MS * 8);
    await new Promise((resolve) => setImmediate(resolve));
    process.off('unhandledRejection', collect);

    expect(rejections).toEqual([]);
    expect(harness.processPresent.mock.calls.length).toBeGreaterThan(pollsWhenItThrew);
    expect(harness.askSteam).toHaveBeenCalledTimes(2);
  });
});

describe('one poll at a time', () => {
  it('a presence read still in flight is not joined by another poll', async () => {
    const harness = createHarness();
    harness.keepAlive.setEnabled(true);
    harness.keepAlive.start();
    harness.holdPresence();

    await harness.advance(POLL_INTERVAL_MS);
    expect(harness.processPresent).toHaveBeenCalledTimes(1);

    await harness.advance(POLL_INTERVAL_MS * 5);
    expect(harness.processPresent).toHaveBeenCalledTimes(1);

    await harness.releasePresence();
    await harness.advance(POLL_INTERVAL_MS);
    expect(harness.processPresent).toHaveBeenCalledTimes(2);
  });

  it('a poll that resumes after stop() asks nothing', async () => {
    const harness = createHarness();
    harness.keepAlive.setEnabled(true);

    await sightingThenAbsence(harness);
    harness.holdPresence();
    await harness.advance(ABSENT_DEBOUNCE_MS);

    harness.keepAlive.stop();
    await harness.releasePresence();
    await harness.advance(ABSENT_DEBOUNCE_MS * 4);

    expect(harness.askSteam).not.toHaveBeenCalled();
    expect(harness.pendingTimers()).toBe(0);
  });
});

describe('the launcher is Windows-only', () => {
  it('elsewhere, start() schedules nothing and never reads the process list', async () => {
    const harness = createHarness({ platform: 'darwin' });
    harness.keepAlive.setEnabled(true);
    harness.keepAlive.start();

    expect(harness.pendingTimers()).toBe(0);

    await harness.advance(POLL_INTERVAL_MS * 20);

    expect(harness.processPresent).not.toHaveBeenCalled();
    expect(harness.askSteam).not.toHaveBeenCalled();
  });
});

describe('what it reports', () => {
  it('emits structured event keys with no prose and no account data', async () => {
    const harness = createHarness();
    harness.keepAlive.setEnabled(true);

    await sightingThenAbsence(harness);
    await harness.advance(ABSENT_DEBOUNCE_MS);
    harness.setPresent(true);
    await harness.advance(POLL_INTERVAL_MS);

    const events = harness.log.mock.calls.map((call) => call[0] as string);
    expect(events.length).toBeGreaterThan(0);
    for (const event of events) {
      expect(event).toMatch(/^keep_alive\.[a-z_]+$/);
    }
    expect(events).toContain('keep_alive.asked');
  });
});

describe('the production presence port', () => {
  beforeEach(() => {
    process_.findProcessIdAsync.mockReset();
    process_.isProcessAlive.mockReset();
    delete process.env.BFC_GAME_PROCESS;
  });

  afterEach(() => {
    delete process.env.BFC_GAME_PROCESS;
  });

  it('re-checks a pid it already holds instead of listing the processes again', async () => {
    process_.findProcessIdAsync.mockResolvedValue(4_242);
    process_.isProcessAlive.mockReturnValue(true);
    const isPresent = createProcessPresencePort();

    await expect(isPresent()).resolves.toBe(true);
    await expect(isPresent()).resolves.toBe(true);
    await expect(isPresent()).resolves.toBe(true);

    expect(process_.findProcessIdAsync).toHaveBeenCalledTimes(1);
    expect(process_.isProcessAlive).toHaveBeenCalledWith(4_242);
  });

  it('falls back to the listing once the pid it held is gone, and reports absence', async () => {
    process_.findProcessIdAsync.mockResolvedValueOnce(4_242).mockResolvedValueOnce(null);
    process_.isProcessAlive.mockReturnValue(false);
    const isPresent = createProcessPresencePort();

    await expect(isPresent()).resolves.toBe(true);
    await expect(isPresent()).resolves.toBe(false);

    expect(process_.findProcessIdAsync).toHaveBeenCalledTimes(2);
  });

  it('watches the game the app already names, and honours the same environment override', async () => {
    process_.findProcessIdAsync.mockResolvedValue(null);

    await createProcessPresencePort()();
    expect(process_.findProcessIdAsync).toHaveBeenLastCalledWith('BombFarm.exe');

    process.env.BFC_GAME_PROCESS = 'some-other-build.exe';
    await createProcessPresencePort()();
    expect(process_.findProcessIdAsync).toHaveBeenLastCalledWith('some-other-build.exe');

    await createProcessPresencePort('explicit.exe')();
    expect(process_.findProcessIdAsync).toHaveBeenLastCalledWith('explicit.exe');
  });
});

describe('the source itself', () => {
  const source = readFileSync(join(__dirname, 'keep-alive-runtime.ts'), 'utf8');

  it('has no way to stop anything', () => {
    expect(source).not.toMatch(/taskkill/i);
    expect(source).not.toMatch(/process\.kill/);
  });

  it('polls for the game on its own, never through the attach-consent reader', () => {
    expect(source).not.toContain('live-source');
  });
});
