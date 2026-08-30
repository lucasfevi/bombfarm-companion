import type { UpdateChannel, UpdateStatus } from '@bombfarm/contracts';
import { describe, expect, it } from 'vitest';
import {
  CHECK_INTERVAL_MS,
  FIRST_CHECK_DELAY_MS,
  createUpdateService,
  unavailableUpdateService,
  type UpdaterPort,
} from './update-service.js';

type Handlers = {
  'checking-for-update'?: () => void;
  'update-available'?: (info: { version: string }) => void;
  'update-not-available'?: () => void;
  'download-progress'?: (progress: { percent: number }) => void;
  'update-downloaded'?: (info: { version: string }) => void;
  error?: (error: unknown) => void;
};

function harness(
  options: {
    channel?: UpdateChannel | null;
    isPackaged?: boolean;
    onCheck?: () => Promise<unknown>;
    onDownload?: () => Promise<unknown>;
  } = {},
) {
  const handlers: Handlers = {};
  const emitted: UpdateStatus[] = [];
  const logged: Record<string, unknown>[] = [];
  const calls = { check: 0, download: 0, quitAndInstall: 0 };
  const applied: { autoDownload?: boolean; autoInstallOnAppQuit?: boolean; channel?: string | null } = {};
  const timers: { once: Array<[() => void, number]>; every: Array<[() => void, number]> } = { once: [], every: [] };
  const cancelled = { once: 0, every: 0 };

  const updater: UpdaterPort = {
    set autoDownload(value: boolean) {
      applied.autoDownload = value;
    },
    set autoInstallOnAppQuit(value: boolean) {
      applied.autoInstallOnAppQuit = value;
    },
    set channel(value: string | null) {
      applied.channel = value;
    },
    on: (event: string, handler: unknown) => {
      (handlers as Record<string, unknown>)[event] = handler;
    },
    checkForUpdates: () => {
      calls.check += 1;
      return options.onCheck ? options.onCheck() : Promise.resolve(null);
    },
    downloadUpdate: () => {
      calls.download += 1;
      return options.onDownload ? options.onDownload() : Promise.resolve(null);
    },
    quitAndInstall: () => {
      calls.quitAndInstall += 1;
    },
  };

  const service = createUpdateService({
    updater,
    scheduler: {
      scheduleOnce: (callback, delayMs) => {
        timers.once.push([callback, delayMs]);
        return () => {
          cancelled.once += 1;
        };
      },
      scheduleEvery: (callback, intervalMs) => {
        timers.every.push([callback, intervalMs]);
        return () => {
          cancelled.every += 1;
        };
      },
    },
    emit: (status) => emitted.push(status),
    log: { info: (record) => logged.push(record), warn: (record) => logged.push(record) },
    now: () => new Date('2026-08-29T12:00:00.000Z'),
    currentVersion: '1.2.3',
    channel: options.channel === undefined ? 'beta' : options.channel,
    isPackaged: options.isPackaged ?? true,
  });

  return { service, handlers, emitted, logged, calls, applied, timers, cancelled };
}

describe('createUpdateService: the disabled path never contacts a feed', () => {
  it('an unpackaged run reports disabled and checking it changes nothing', async () => {
    const h = harness({ isPackaged: false });
    h.service.start();

    expect(h.service.getStatus().phase).toBe('disabled');
    await h.service.check();
    await h.service.download();
    h.service.installOnRestart();

    expect(h.calls).toEqual({ check: 0, download: 0, quitAndInstall: 0 });
    expect(h.timers.once).toHaveLength(0);
    expect(h.timers.every).toHaveLength(0);
  });

  it('the dev flavor is disabled by its null channel even in a packaged build', async () => {
    const h = harness({ channel: null, isPackaged: true });
    h.service.start();

    expect(h.service.getStatus()).toMatchObject({ phase: 'disabled', channel: null });
    await h.service.check();
    expect(h.calls.check).toBe(0);
  });
});

describe('createUpdateService: start()', () => {
  it('turns off automatic download and quit-time install, and pins the flavor channel', () => {
    const h = harness({ channel: 'nightly' });
    h.service.start();

    expect(h.applied).toEqual({ autoDownload: false, autoInstallOnAppQuit: false, channel: 'nightly' });
  });

  it('schedules the first check after the launch delay and repeats every six hours', () => {
    const h = harness();
    h.service.start();

    expect(h.timers.once).toEqual([[expect.any(Function), FIRST_CHECK_DELAY_MS]]);
    expect(h.timers.every).toEqual([[expect.any(Function), CHECK_INTERVAL_MS]]);
    expect(CHECK_INTERVAL_MS).toBe(6 * 60 * 60 * 1000);
  });

  it('is idempotent — a second start() adds no second pair of timers', () => {
    const h = harness();
    h.service.start();
    h.service.start();

    expect(h.timers.once).toHaveLength(1);
    expect(h.timers.every).toHaveLength(1);
  });

  it('stop() cancels both timers', () => {
    const h = harness();
    h.service.start();
    h.service.stop();

    expect(h.cancelled).toEqual({ once: 1, every: 1 });
  });

  it('each scheduled callback runs a real check', async () => {
    const h = harness();
    h.service.start();

    h.timers.once[0]?.[0]();
    await Promise.resolve();
    h.handlers['update-not-available']?.();
    h.timers.every[0]?.[0]();
    await Promise.resolve();

    expect(h.calls.check).toBe(2);
  });

  it('the launch check and the six-hourly one collapse into one when they coincide', async () => {
    // Both timers can come due in the same tick; the second must not start a second HTTP check
    // against the release feed while the first is still open.
    const h = harness({ onCheck: () => new Promise(() => {}) });
    h.service.start();

    h.timers.once[0]?.[0]();
    h.timers.every[0]?.[0]();
    await Promise.resolve();

    expect(h.calls.check).toBe(1);
  });
});

describe('createUpdateService: the phase walk from available to installed', () => {
  it('an available update is announced but not downloaded until asked', async () => {
    const h = harness();
    h.service.start();

    await h.service.check();
    h.handlers['update-available']?.({ version: '1.3.0' });

    expect(h.service.getStatus()).toMatchObject({
      phase: 'available',
      availableVersion: '1.3.0',
      error: null,
      lastCheckedAt: '2026-08-29T12:00:00.000Z',
    });
    expect(h.calls.download).toBe(0);
  });

  it('download() reports progress and settles on ready', async () => {
    const h = harness();
    h.service.start();
    h.handlers['update-available']?.({ version: '1.3.0' });

    await h.service.download();
    h.handlers['download-progress']?.({ percent: 41.7 });

    // Rounded, because the renderer prints it as a whole percent beside a bar.
    expect(h.service.getStatus()).toMatchObject({ phase: 'downloading', percent: 42 });

    h.handlers['update-downloaded']?.({ version: '1.3.0' });
    expect(h.service.getStatus()).toMatchObject({ phase: 'ready', percent: 100, availableVersion: '1.3.0' });
  });

  it('download() is a no-op unless an update is actually available', async () => {
    const h = harness();
    h.service.start();

    await h.service.download();
    expect(h.calls.download).toBe(0);
  });

  it('installOnRestart() only quits once the download is ready', () => {
    const h = harness();
    h.service.start();
    h.handlers['update-available']?.({ version: '1.3.0' });

    h.service.installOnRestart();
    expect(h.calls.quitAndInstall).toBe(0);

    h.handlers['update-downloaded']?.({ version: '1.3.0' });
    h.service.installOnRestart();
    expect(h.calls.quitAndInstall).toBe(1);
  });
});

describe('createUpdateService: a check never disturbs work already in flight', () => {
  it('does not re-check while a download is running', async () => {
    const h = harness();
    h.service.start();
    h.handlers['update-available']?.({ version: '1.3.0' });
    await h.service.download();

    await h.service.check();

    expect(h.calls.check).toBe(0);
    expect(h.service.getStatus().phase).toBe('downloading');
  });

  it('does not re-check once an update is ready — that phase is terminal until restart', async () => {
    const h = harness();
    h.service.start();
    h.handlers['update-available']?.({ version: '1.3.0' });
    h.handlers['update-downloaded']?.({ version: '1.3.0' });

    await h.service.check();

    expect(h.calls.check).toBe(0);
    expect(h.service.getStatus().phase).toBe('ready');
  });
});

describe('createUpdateService: failures land as a reason, never as updater prose', () => {
  it('a rejected check becomes a classified error phase', async () => {
    const h = harness({ onCheck: () => Promise.reject(new Error('net::ERR_INTERNET_DISCONNECTED')) });
    h.service.start();

    const status = await h.service.check();

    expect(status).toMatchObject({ phase: 'error', error: 'offline' });
    expect(h.logged).toContainEqual(
      expect.objectContaining({ event: 'update.failed', reason: 'offline', error: 'net::ERR_INTERNET_DISCONNECTED' }),
    );
  });

  it("the updater's own error event is classified the same way", () => {
    const h = harness();
    h.service.start();

    h.handlers.error?.(new Error('HttpError: 404 Not Found'));

    expect(h.service.getStatus()).toMatchObject({ phase: 'error', error: 'no-release' });
  });

  it('a failed check can be retried — the error phase does not latch', async () => {
    let attempt = 0;
    const h = harness({
      onCheck: () => {
        attempt += 1;
        return attempt === 1 ? Promise.reject(new Error('getaddrinfo ENOTFOUND')) : Promise.resolve(null);
      },
    });
    h.service.start();

    await h.service.check();
    expect(h.service.getStatus().phase).toBe('error');

    await h.service.check();
    h.handlers['update-not-available']?.();
    expect(h.service.getStatus()).toMatchObject({ phase: 'not-available', error: null });
  });
});

describe('createUpdateService: every transition reaches the renderer', () => {
  it('emits the same status it returns, on each transition', async () => {
    const h = harness();
    h.service.start();

    await h.service.check();
    h.handlers['checking-for-update']?.();
    h.handlers['update-available']?.({ version: '1.3.0' });

    expect(h.emitted.map((status) => status.phase)).toEqual(['checking', 'available']);
    expect(h.emitted.at(-1)).toEqual(h.service.getStatus());
  });

  it('carries the channel and installed version on every emission', () => {
    const h = harness({ channel: 'latest' });
    h.service.start();
    h.handlers['checking-for-update']?.();

    expect(h.emitted[0]).toMatchObject({ channel: 'latest', currentVersion: '1.2.3' });
  });
});

describe('unavailableUpdateService', () => {
  it('reports a failure rather than the no-channel status, which would deny that the build updates', () => {
    const status = unavailableUpdateService('0.5.1', 'beta').getStatus();

    expect(status.phase).toBe('error');
    expect(status.error).toBe('unknown');
    expect(status.channel).toBe('beta');
    expect(status.currentVersion).toBe('0.5.1');
  });

  it('re-reports the same failure from every action instead of retrying a port it never had', async () => {
    const service = unavailableUpdateService('0.5.1', 'nightly');
    const status = service.getStatus();

    expect(await service.check()).toEqual(status);
    expect(await service.download()).toEqual(status);
    expect(service.installOnRestart()).toEqual(status);

    service.start();
    service.stop();
    expect(service.getStatus()).toEqual(status);
  });
});
