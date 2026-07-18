import path from 'node:path';
import { app, BrowserWindow, ipcMain } from 'electron';
import {
  DEFAULT_SETTINGS,
  isIpcChannel,
  type IpcInvokeChannel,
} from '@bombfarm/contracts';
import { resolveAppEnv, RENDERER_DEV_URL } from './env.js';
import { configureLogging, log, logBootLine } from './logging.js';
import { createStorage, type Storage } from './storage/index.js';

let mainWindow: BrowserWindow | null = null;
let storage: Storage | null = null;

function configurePaths(): void {
  const env = resolveAppEnv();
  app.setName(env.productName);

  const baseUserData = app.getPath('userData');
  if (env.userDataSuffix && !baseUserData.endsWith(env.userDataSuffix)) {
    app.setPath('userData', `${baseUserData}${env.userDataSuffix}`);
  }
}

function registerIpcHandlers(): void {
  const handlers: Record<IpcInvokeChannel, () => unknown> = {
    'app:getFlavor': () => resolveAppEnv().flavor,
    'app:ping': () => ({ ok: true as const, from: 'main' as const }),
    'settings:get': () => DEFAULT_SETTINGS,
    'storage:health': () => storage?.healthCheck() ?? { binding: 'unknown', ok: false },
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

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.webContents.on('did-finish-load', () => {
    log.info({ scope: 'main', event: 'renderer.loaded' });
  });

  if (env.isDev) {
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
  const env = resolveAppEnv();
  configureLogging(env.flavor);
  logBootLine('main');

  const dbPath = path.join(app.getPath('userData'), 'companion.db');
  storage = createStorage(dbPath);
  const health = storage.healthCheck();
  log.info({ scope: 'main', event: 'storage.ready', ...health });

  registerIpcHandlers();
  await createMainWindow();
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  configurePaths();

  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
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
    storage?.close();
    storage = null;
  });
}
