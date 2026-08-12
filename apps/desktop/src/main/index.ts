import path from 'node:path';
import { app, BrowserWindow, ipcMain } from 'electron';
import {
  DEFAULT_SETTINGS,
  isIpcChannel,
  type AccountView,
  type ConsentRecord,
  type IpcEventChannel,
  type IpcEvents,
  type IpcInvokeChannel,
} from '@bombfarm/contracts';
import { type ConsentEvent, createPacingGate, initialConsent, reduceConsent } from '@bombfarm/game-api';
import { applyAppIdentity } from './app-identity.js';
import { createBootRecord } from './boot-record.js';
import { InvalidFlavorError, resolveAppEnv, RENDERER_DEV_URL, type AppEnv } from './env.js';
import { GameReaderService } from './game-reader/game-reader-service.js';
import { createAccountRefresh, type AccountRefreshHandle } from './game-api/account-refresh.js';
import { createConsentStore, type ConsentStore } from './game-api/consent-store.js';
import { nodeHttpsTransport } from './game-api/https-transport.js';
import { configureLogging, log } from './logging.js';
import { createAccountStore, type AccountStore } from './storage/account-store.js';
import { createStorage, openAccountDatabase, type Storage } from './storage/index.js';

let mainWindow: BrowserWindow | null = null;
let storage: Storage | null = null;
let gameReader: GameReaderService | null = null;
let accountStore: AccountStore | null = null;
let accountRefresh: AccountRefreshHandle | null = null;
let consentStore: ConsentStore | null = null;

function emitEvent<C extends IpcEventChannel>(channel: C, payload: IpcEvents[C]): void {
  mainWindow?.webContents.send(`bfc:event:${channel}`, payload);
}

/** Reads, transitions, persists, and announces one consent event — the single path every
 *  consent:* handler below goes through (LAR-01/03…05). */
function applyConsentEvent(event: ConsentEvent): ConsentRecord {
  const current = consentStore?.read() ?? initialConsent();
  const next = reduceConsent(current, event);
  consentStore?.write(next);
  emitEvent('consent:changed', next);
  accountRefresh?.onConsentChanged(next);
  return next;
}

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
    'account:get': (): AccountView => {
      // gameRunning always comes fresh from the game reader's current status — never from a
      // cached view, so a stale cached commit can never misreport whether the game is running.
      const gameRunning = gameReader?.getStatus().status === 'connected';
      // The game-API cycle (MP2 F2) is the freshest live producer when it has run at least
      // once; the fixture/memory game reader's own cache is the fallback (unchanged from F3).
      const cached = accountRefresh?.getLastView() ?? gameReader?.getAccountView();
      if (cached) {
        return { ...cached, gameRunning };
      }
      return (
        accountStore?.commit({}, { gameRunning }) ?? {
          payload: {},
          gameRunning,
          store: { status: 'unavailable', reason: 'no_sqlite_binding', binding: null },
        }
      );
    },
    'consent:get': (): ConsentRecord => consentStore?.read() ?? initialConsent(),
    'consent:accept': (): ConsentRecord => applyConsentEvent({ type: 'accept', now: new Date().toISOString() }),
    'consent:decline': (): ConsentRecord => applyConsentEvent({ type: 'decline' }),
    'consent:revoke': (): ConsentRecord => applyConsentEvent({ type: 'revoke' }),
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

  // A store that failed to open (degraded/unavailable) never throws into boot — the app
  // starts and account:get reports the reason (openAccountDatabase/createAccountStore are
  // both designed to never throw).
  const userDataDir = app.getPath('userData');
  const accountOpen = openAccountDatabase(path.join(userDataDir, 'account.db'));
  accountStore = createAccountStore(accountOpen, { userDataDir });
  const initialRestore = accountStore.restore();
  log.info({
    scope: 'main',
    event: 'account.restored',
    status: initialRestore.status,
    reason: initialRestore.reason,
    account: initialRestore.payload.fidelity.account.status,
    heroes: initialRestore.payload.fidelity.heroes.status,
    skills: initialRestore.payload.fidelity.skills.status,
    casa: initialRestore.payload.fidelity.casa.status,
    items: initialRestore.payload.fidelity.items.status,
  });

  gameReader = new GameReaderService(userDataDir);
  gameReader.setAccountStore(accountStore);

  // MP2 F2 — the consented game-API account reader. Independent of the game reader's own
  // memory/fixture ticking: consent gates every request structurally (LAR-01/AD-025/AD-028),
  // so this cycle issues nothing at all until the player has accepted the first-run modal (T9).
  // Constructed before registerIpcHandlers() so the consent:* handlers never see a null store.
  consentStore = createConsentStore(accountOpen.db);
  const gate = createPacingGate({
    now: () => Date.now(),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  });
  accountRefresh = createAccountRefresh({
    consentStore,
    transport: nodeHttpsTransport,
    gate,
    store: accountStore,
    log,
    now: () => new Date().toISOString(),
    onView: (view) => {
      emitEvent('account:changed', view);
    },
  });

  registerIpcHandlers();
  await createMainWindow();
  gameReader.start();
  log.info({
    scope: 'main',
    event: 'game-reader.started',
    mode: process.env.BFC_GAME_READER === 'fixture' ? 'fixture' : 'memory',
  });

  accountRefresh.start();
  log.info({ scope: 'main', event: 'account-refresh.started' });
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
    accountRefresh?.stop();
    accountRefresh = null;
    consentStore = null;
    storage?.close();
    storage = null;
    accountStore?.close();
    accountStore = null;
  });
}
