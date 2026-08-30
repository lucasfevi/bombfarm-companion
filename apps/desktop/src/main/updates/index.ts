import { app } from 'electron';
import log from 'electron-log/main.js';
import type { UpdateStatus } from '@bombfarm/contracts';
import { resolveAppEnv } from '../env.js';
import { createUpdateService, type UpdaterPort, type UpdateScheduler, type UpdateService } from './update-service.js';

export {
  createUpdateService,
  unavailableUpdateService,
  CHECK_INTERVAL_MS,
  FIRST_CHECK_DELAY_MS,
} from './update-service.js';
export type { UpdaterPort, UpdateScheduler, UpdateService } from './update-service.js';
export { classifyUpdateError } from './update-error.js';

const timerScheduler: UpdateScheduler = {
  scheduleOnce: (callback, delayMs) => {
    const handle = setTimeout(callback, delayMs);
    return () => {
      clearTimeout(handle);
    };
  },
  scheduleEvery: (callback, intervalMs) => {
    const handle = setInterval(callback, intervalMs);
    return () => {
      clearInterval(handle);
    };
  },
};

/**
 * Imported lazily so an unpackaged run never loads `electron-updater` at all. The module reads
 * `app-update.yml` out of the resources directory on import, which does not exist in a
 * `pnpm dev` tree, and the `dev` flavor has no channel to check anyway.
 *
 * The port is read off `.default` — the CommonJS `module.exports` — rather than as a named
 * binding. This bundle is CommonJS but the `import()` survives into it verbatim, so Node's ESM
 * loader builds the namespace from the exports it can find by static analysis. `autoUpdater` is
 * the one export the package installs through `Object.defineProperty` with an arrow getter, so it
 * is the one export that analysis misses; destructured off the namespace it reads `undefined`.
 */
async function loadUpdaterPort(): Promise<UpdaterPort> {
  const { autoUpdater } = (await import('electron-updater')).default;
  autoUpdater.logger = log;
  return autoUpdater;
}

export async function createElectronUpdateService(
  emit: (status: UpdateStatus) => void,
): Promise<UpdateService> {
  const env = resolveAppEnv();
  const channel = env.descriptor.updateChannel;
  const enabled = app.isPackaged && channel !== null;

  return createUpdateService({
    updater: enabled ? await loadUpdaterPort() : inertUpdater(),
    scheduler: timerScheduler,
    emit,
    log: {
      info: (record) => {
        log.info(record);
      },
      warn: (record) => {
        log.warn(record);
      },
    },
    now: () => new Date(),
    currentVersion: app.getVersion(),
    channel,
    isPackaged: app.isPackaged,
  });
}

/** Never reached by the service when disabled — supplied only so `UpdateServiceDeps.updater`
 *  stays non-optional and the disabled path needs no branch of its own. */
function inertUpdater(): UpdaterPort {
  return {
    set autoDownload(_value: boolean) {},
    set autoInstallOnAppQuit(_value: boolean) {},
    set channel(_value: string | null) {},
    on: () => {},
    checkForUpdates: () => Promise.resolve(null),
    downloadUpdate: () => Promise.resolve(null),
    quitAndInstall: () => {},
  };
}
