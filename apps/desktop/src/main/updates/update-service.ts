import type { UpdateChannel, UpdateStatus } from '@bombfarm/contracts';
import { disabledUpdateStatus } from '@bombfarm/contracts';
import type { LogPort } from '../live-source/log-port.js';
import { classifyUpdateError, updateErrorMessage } from './update-error.js';

/** The delay before the first automatic check, so a launch never competes with window paint,
 *  storage open and the first game poll for the same few seconds. */
export const FIRST_CHECK_DELAY_MS = 30_000;
export const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

/** The slice of `electron-updater`'s `autoUpdater` this service uses, so the state machine can be
 *  driven by a fake in tests without an Electron process. */
export interface UpdaterPort {
  set autoDownload(value: boolean);
  set autoInstallOnAppQuit(value: boolean);
  set channel(value: string | null);
  on(event: 'checking-for-update' | 'update-not-available', handler: () => void): void;
  on(event: 'update-available' | 'update-downloaded', handler: (info: { version: string }) => void): void;
  on(event: 'download-progress', handler: (progress: { percent: number }) => void): void;
  on(event: 'error', handler: (error: unknown) => void): void;
  checkForUpdates(): Promise<unknown>;
  downloadUpdate(): Promise<unknown>;
  quitAndInstall(): void;
}

export interface UpdateScheduler {
  /** Fires once after `delayMs`; returns a cancel. */
  readonly scheduleOnce: (callback: () => void, delayMs: number) => () => void;
  /** Fires every `intervalMs`; returns a cancel. */
  readonly scheduleEvery: (callback: () => void, intervalMs: number) => () => void;
}

export interface UpdateServiceDeps {
  readonly updater: UpdaterPort;
  readonly scheduler: UpdateScheduler;
  readonly emit: (status: UpdateStatus) => void;
  readonly log: LogPort;
  readonly now: () => Date;
  readonly currentVersion: string;
  /** `null` disables the service outright — the `dev` flavor declares no channel. */
  readonly channel: UpdateChannel | null;
  /** An unpackaged run has no installer to replace, so `electron-updater` cannot work there
   *  regardless of channel. */
  readonly isPackaged: boolean;
}

export interface UpdateService {
  start(): void;
  stop(): void;
  getStatus(): UpdateStatus;
  check(): Promise<UpdateStatus>;
  download(): Promise<UpdateStatus>;
  installOnRestart(): UpdateStatus;
}

export function createUpdateService(deps: UpdateServiceDeps): UpdateService {
  const enabled = deps.isPackaged && deps.channel !== null;

  let status: UpdateStatus = enabled
    ? {
        phase: 'idle',
        currentVersion: deps.currentVersion,
        channel: deps.channel,
        availableVersion: null,
        percent: null,
        error: null,
        lastCheckedAt: null,
      }
    : disabledUpdateStatus(deps.currentVersion);

  let started = false;
  let cancelFirstCheck: (() => void) | null = null;
  let cancelInterval: (() => void) | null = null;
  let checkInFlight = false;
  let downloadInFlight = false;

  function set(patch: Partial<UpdateStatus>): UpdateStatus {
    status = { ...status, ...patch };
    deps.emit(status);
    return status;
  }

  function stamp(): string {
    return deps.now().toISOString();
  }

  function fail(error: unknown): UpdateStatus {
    checkInFlight = false;
    downloadInFlight = false;
    const reason = classifyUpdateError(error);
    deps.log.warn({ scope: 'updater', event: 'update.failed', reason, error: updateErrorMessage(error) });
    return set({ phase: 'error', error: reason, percent: null, lastCheckedAt: stamp() });
  }

  function bindUpdaterEvents(): void {
    deps.updater.on('checking-for-update', () => {
      set({ phase: 'checking', error: null });
    });

    deps.updater.on('update-available', (info) => {
      checkInFlight = false;
      deps.log.info({ scope: 'updater', event: 'update.available', version: info.version });
      set({ phase: 'available', availableVersion: info.version, error: null, lastCheckedAt: stamp() });
    });

    deps.updater.on('update-not-available', () => {
      checkInFlight = false;
      set({ phase: 'not-available', availableVersion: null, error: null, lastCheckedAt: stamp() });
    });

    deps.updater.on('download-progress', (progress) => {
      set({ phase: 'downloading', percent: Math.round(progress.percent), error: null });
    });

    deps.updater.on('update-downloaded', (info) => {
      downloadInFlight = false;
      deps.log.info({ scope: 'updater', event: 'update.downloaded', version: info.version });
      set({ phase: 'ready', availableVersion: info.version, percent: 100, error: null });
    });

    deps.updater.on('error', (error) => {
      fail(error);
    });
  }

  async function check(): Promise<UpdateStatus> {
    // `ready` is terminal until restart, and a check mid-download would race the transfer it
    // would invalidate. Both return the current status rather than throwing: the six-hourly timer
    // fires regardless of what the player is doing.
    if (!enabled || checkInFlight || downloadInFlight || status.phase === 'downloading' || status.phase === 'ready') {
      return status;
    }
    checkInFlight = true;
    try {
      await deps.updater.checkForUpdates();
    } catch (error) {
      return fail(error);
    } finally {
      checkInFlight = false;
    }
    return status;
  }

  async function download(): Promise<UpdateStatus> {
    if (!enabled || status.phase !== 'available' || downloadInFlight) {
      return status;
    }
    downloadInFlight = true;
    set({ phase: 'downloading', percent: 0, error: null });
    try {
      await deps.updater.downloadUpdate();
    } catch (error) {
      return fail(error);
    }
    return status;
  }

  function installOnRestart(): UpdateStatus {
    if (!enabled || status.phase !== 'ready') {
      return status;
    }
    deps.log.info({ scope: 'updater', event: 'update.installing', version: status.availableVersion });
    deps.updater.quitAndInstall();
    return status;
  }

  function start(): void {
    if (started) return;
    started = true;

    if (!enabled) {
      deps.log.info({
        scope: 'updater',
        event: 'update.disabled',
        isPackaged: deps.isPackaged,
        channel: deps.channel,
      });
      return;
    }

    deps.updater.autoDownload = false;
    deps.updater.autoInstallOnAppQuit = false;
    deps.updater.channel = deps.channel;
    bindUpdaterEvents();

    cancelFirstCheck = deps.scheduler.scheduleOnce(() => {
      void check();
    }, FIRST_CHECK_DELAY_MS);
    cancelInterval = deps.scheduler.scheduleEvery(() => {
      void check();
    }, CHECK_INTERVAL_MS);
  }

  function stop(): void {
    cancelFirstCheck?.();
    cancelInterval?.();
    cancelFirstCheck = null;
    cancelInterval = null;
    started = false;
  }

  return {
    start,
    stop,
    getStatus: () => status,
    check,
    download,
    installOnRestart,
  };
}

/**
 * The stand-in for a service that could not be built at all — `electron-updater` failed to load,
 * or constructing the port threw. There is no port to drive, so every action reports the same
 * failure rather than retrying: nothing that failed to load comes back within a session.
 *
 * It reports `error`, not `disabled`. `disabled` is the honest answer for a build with no channel
 * to check, and printing it here would tell a player on an installed build that their flavor does
 * not update — which is false, and hides the failure instead of showing it.
 */
export function unavailableUpdateService(
  currentVersion: string,
  channel: UpdateChannel | null,
): UpdateService {
  const status: UpdateStatus = {
    phase: 'error',
    currentVersion,
    channel,
    availableVersion: null,
    percent: null,
    error: 'unknown',
    lastCheckedAt: null,
  };

  return {
    start: () => undefined,
    stop: () => undefined,
    getStatus: () => status,
    check: () => Promise.resolve(status),
    download: () => Promise.resolve(status),
    installOnRestart: () => status,
  };
}
