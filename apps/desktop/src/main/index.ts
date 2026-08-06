import path from 'node:path';
import { app, BrowserWindow, ipcMain } from 'electron';
import {
  DEFAULT_SETTINGS,
  isIpcChannel,
  type IpcInvokeChannel,
} from '@bombfarm/contracts';
import { applyAppIdentity } from './app-identity.js';
import { createBootRecord } from './boot-record.js';
import { InvalidFlavorError, resolveAppEnv, RENDERER_DEV_URL, type AppEnv } from './env.js';
import { GameReaderService } from './game-reader/game-reader-service.js';
import { configureLogging, log } from './logging.js';
import { createStorage, type Storage } from './storage/index.js';

let mainWindow: BrowserWindow | null = null;
let storage: Storage | null = null;
let gameReader: GameReaderService | null = null;

function registerIpcHandlers(): void {
  const handlers: Record<IpcInvokeChannel, () => unknown> = {
    'app:getFlavor': () => resolveAppEnv().flavor,
    'app:getEnvironment': () => {
      const env = resolveAppEnv();
      return {
        flavor: env.flavor,
        productName: env.productName,
        badgeLabel: env.descriptor.badgeLabel,
        updateChannel: env.descriptor.updateChannel,
        isPackaged: env.isPackaged,
        version: app.getVersion(),
      };
    },
    'app:ping': () => ({ ok: true as const, from: 'main' as const }),
    'settings:get': () => DEFAULT_SETTINGS,
    'storage:health': () => storage?.healthCheck() ?? { binding: 'unknown', ok: false },
    'game:getStatus': () => gameReader?.getStatus() ?? {
      status: 'not_running' as const,
      updatedAt: new Date().toISOString(),
    },
    'game:getSnapshot': () => gameReader?.getSnapshot() ?? {
      status: {
        status: 'not_running' as const,
        updatedAt: new Date().toISOString(),
      },
      mapped: null,
      raw: { state: null, inventory: null },
    },
  };

  ipcMain.handle('bfc:invoke', (_event, channel: string) => {
    if (!isIpcChannel(channel)) {
      throw new Error(`Unknown IPC channel: ${channel}`);
    }
    return handlers[channel]();
  });
}

async function createMainWindow(): Promise<void> {
  const env = resolveAppEnv();

  mainWindow = new BrowserWindow({
    width: 1024,
    height: 640,
    show: false,
    title: env.productName,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  gameReader?.setWindowProvider(() => mainWindow);

  const reveal = (): void => {
    if (!mainWindow || mainWindow.isDestroyed() || mainWindow.isVisible()) return;
    mainWindow.show();
    mainWindow.focus();
    log.info({ scope: 'main', event: 'window.shown' });
  };

  mainWindow.on('ready-to-show', reveal);
  // Fallback: under heavy HMR, ready-to-show can lag; still surface the window after load.
  mainWindow.webContents.on('did-finish-load', () => {
    log.info({ scope: 'main', event: 'renderer.loaded' });
    reveal();
  });

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    log.error({
      scope: 'main',
      event: 'renderer.load_failed',
      errorCode,
      errorDescription,
      validatedURL,
    });
    reveal();
  });

  if (env.isDev) {
    log.info({ scope: 'main', event: 'renderer.load_url', url: RENDERER_DEV_URL });
    await mainWindow.loadURL(RENDERER_DEV_URL);
    if (process.env.BFC_OPEN_DEVTOOLS === '1') {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
  } else {
    const indexPath = path.join(__dirname, '../../renderer/out/index.html');
    await mainWindow.loadFile(indexPath);
  }
}

async function bootstrap(): Promise<void> {
  const dbPath = path.join(app.getPath('userData'), 'companion.db');
  storage = createStorage(dbPath);
  const health = storage.healthCheck();
  log.info({ scope: 'main', event: 'storage.ready', ...health });

  gameReader = new GameReaderService(app.getPath('userData'));
  registerIpcHandlers();
  await createMainWindow();
  gameReader.start();
  log.info({
    scope: 'main',
    event: 'game-reader.started',
    mode: process.env.BFC_GAME_READER === 'fixture' ? 'fixture' : 'memory',
  });
}

function resolveBootEnv(): AppEnv {
  try {
    return resolveAppEnv();
  } catch (error: unknown) {
    if (error instanceof InvalidFlavorError) {
      process.stderr.write(`Invalid BFC_FLAVOR: ${error.rejectedValue}\n`);
    } else {
      process.stderr.write(`${String(error)}\n`);
    }
    app.exit(1);
    throw error;
  }
}

const env = resolveBootEnv();
const { gotLock } = applyAppIdentity(app, {
  productName: env.productName,
  appId: env.appId,
  userDataPath: env.userDataPath,
});

configureLogging(env);

if (env.envConflict) {
  log.warn({
    scope: 'main',
    event: 'flavor.env_ignored',
    requested: env.envConflict.requested,
    effective: env.envConflict.effective,
  });
}

log.info(createBootRecord(env, 'main'));

if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    log.info({ scope: 'main', event: 'app.second_instance' });
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(bootstrap).catch((error: unknown) => {
    log.error({ scope: 'main', event: 'boot.failed', error: String(error) });
    app.quit();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('before-quit', () => {
    gameReader?.stop();
    gameReader = null;
    storage?.close();
    storage = null;
  });
}
