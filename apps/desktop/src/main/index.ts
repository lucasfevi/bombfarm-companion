import path from 'node:path';
import fs from 'node:fs';
import { app, BrowserWindow, clipboard, ipcMain, Menu, nativeImage, screen, shell, type WebContents } from 'electron';
import {
  DEFAULT_SETTINGS,
  resolveStartupLocale,
  type AccountReadResult,
  type AccountSource,
  type AccountView,
  type AppLocale,
  type AppSettings,
  type SettingsWriteResult,
} from '@bombfarm/contracts';
import { createPacingGate, initialConsent, isGranted, trayTextFor } from '@bombfarm/game-api';
import { createAccountNotifier, resolveAccountView, resolveCachedAccountView } from './account-view.js';
import { createApplyInjector, type ApplyInjector } from './apply/apply-inject.js';
import { createApplyService, type ApplyService } from './apply/apply-service.js';
import { createWriterLock, type WriterLock } from './apply/writer-lock.js';
import { patchAccountAfterForge } from './forge/forge-account-patch.js';
import { createForgeHistory, type ForgeHistory } from './forge/forge-history.js';
import { createForgeInjector, shouldHonourForgeInject, type ForgeInjector } from './forge/forge-inject.js';
import { createForgeService, type ForgeService } from './forge/forge-service.js';
import { createCollectionsReader, type CollectionsReader } from './collections/collections-reader.js';
import { createCollectionsRecorder, type CollectionsRecorder } from './collections/collections-recorder.js';
import { createCollectionsStore, type CollectionsStore } from './collections/collections-store.js';
import { createPvpHistory, type PvpHistory } from './pvp/pvp-history.js';
import { createPvpReader, type PvpReader } from './pvp/pvp-reader.js';
import { createPvpRecorder, type PvpRecorder } from './pvp/pvp-recorder.js';
import { createIpcDispatch, createIpcHandlers, defaultLiveView } from './ipc-handlers.js';
import { createEventEmitter } from './event-emitter.js';
import { createRedactingTokenReader } from './redacting-token-reader.js';
import { shutdownInOrder } from './shutdown.js';
import { applyAppIdentity } from './app-identity.js';
import { createBootRecord } from './boot-record.js';
import { fuseSecondsForCdr } from './domain-edge.js';
import { InvalidFlavorError, resolveAppEnv, RENDERER_DEV_URL, type AppEnv } from './env.js';
import { applyExternalNavigationPolicy } from './external-navigation.js';
import { GameReaderService } from './game-reader/game-reader-service.js';
import {
  registerRendererProtocol,
  registerRendererSchemeAsPrivileged,
  RENDERER_ENTRY_URL,
} from './renderer-protocol.js';
import { requestAccountRead } from './game-api/account-read-request.js';
import { createAccountRefresh, type AccountRefreshDeps, type AccountRefreshHandle } from './game-api/account-refresh.js';
import { createConsentApplier } from './game-api/consent-applier.js';
import { createConsentStore, type ConsentStore } from './game-api/consent-store.js';
import { createLiveConsentGate } from './game-api/live-consent-gate.js';
import { createSettingsStore, type SettingsStore } from './game-api/settings-store.js';
import { createWindowLayoutStore, type WindowLayoutStore } from './game-api/window-layout-store.js';
import { companionUserAgent, createNodeHttpsTransport } from './game-api/https-transport.js';
import { readSessionToken, sessionCfgPath } from './game-api/session-token-file.js';
import { createTriggeredRefresh, type TriggeredRefresh } from './game-api/triggered-refresh.js';
import { createLiveFastPublisher, type LiveFastPublisher } from './live-source/live-fast-publisher.js';
import {
  LiveSource,
  nodeObservationAppendPort,
  observationCaptureFilePath,
} from './live-source/live-source.js';
import {
  createObservationCapture,
  isObservationCaptureEnabled,
  type ObservationCapture,
} from './live-source/observation-capture.js';
import { createMarkWatch, type MarkWatch } from './live-source/observation-mark-watch.js';
import {
  createReplayTapFactory,
  isReplayLiveSourceEnabled,
  resolveReplayCapturePath,
  resolveReplayCollectionsFixturePath,
  resolveReplayPvpFixturePath,
} from './live-source/replay-tap.js';
import { configureLogging, log } from './logging.js';
import {
  createElectronUpdateService,
  unavailableUpdateService,
  type UpdateService,
} from './updates/index.js';
import { marketCachePath } from './market/market-cache.js';
import { createMarketService, type MarketService } from './market/market-service.js';
import { marketHttpGet } from './market/market-transport.js';
import { offlineOnlinePlayersGet } from './online-players/online-players-offline.js';
import { createOnlinePlayersService, type OnlinePlayersService } from './online-players/online-players-service.js';
import { onlinePlayersHttpGet } from './online-players/online-players-transport.js';
import { createAccountStore, type AccountStore } from './storage/account-store.js';
import { createStorage, openAccountDatabase, type Storage } from './storage/index.js';
import {
  applyAlwaysOnTopMain as applyAlwaysOnTopMainSettings,
  applyAlwaysOnTopMini as applyAlwaysOnTopMiniSettings,
  applyForgeWritesEnabled as applyForgeWritesEnabledSettings,
  applyLocale as applyLocaleSettings,
  applyMarketQuoteCurrency as applyMarketQuoteCurrencySettings,
  applyRestartGameOnExit as applyRestartGameOnExitSettings,
  applyUsagePingEnabled as applyUsagePingEnabledSettings,
} from './shell/settings-apply.js';
import { accountIdentityOf, createElectronUsagePing, type UsagePing } from './usage-ping/index.js';
import { createElectronTray } from './shell/electron-tray.js';
import { resolveAppIconPath } from './shell/app-icon-path.js';
import {
  clampToWorkArea,
  DEFAULT_MAIN_HEIGHT,
  DEFAULT_MAIN_WIDTH,
  MIN_MAIN_HEIGHT,
  MIN_MAIN_WIDTH,
} from './shell/window-layout.js';
import {
  clearShellSmokeBridge,
  installShellSmokeBridge,
  shouldInstallShellSmokeBridge,
} from './shell/shell-smoke-bridge.js';
import {
  createShellLifecycle,
  shouldQuitOnAllWindowsClosed,
  type ShellLifecycle,
  type WindowPort,
} from './shell/window-lifecycle.js';
import { isWindowRevealSuppressed } from './shell/window-reveal.js';
import {
  createMiniLiveController,
  resolveMiniLiveLoadUrl,
  type MiniLiveController,
} from './mini-live-window.js';
import {
  createGameKeepAlive,
  createProcessPresencePort,
  type GameKeepAlive,
} from './game-keep-alive/keep-alive-runtime.js';
import { askSteam, createSteamLaunchDeps } from './game-keep-alive/steam-launch.js';

let mainWindow: BrowserWindow | null = null;
let storage: Storage | null = null;
let gameReader: GameReaderService | null = null;
let accountStore: AccountStore | null = null;
let accountRefresh: AccountRefreshHandle | null = null;
let consentStore: ConsentStore | null = null;
let settingsStore: SettingsStore | null = null;
let liveSource: LiveSource | null = null;
let observationCapture: ObservationCapture | null = null;
let observationMarkWatch: MarkWatch | null = null;
let liveFastPublisher: LiveFastPublisher | null = null;
let triggeredRefresh: TriggeredRefresh | null = null;
let marketService: MarketService | null = null;
let onlinePlayersService: OnlinePlayersService | null = null;
let forgeService: ForgeService | null = null;
let forgeHistory: ForgeHistory | null = null;
let applyService: ApplyService | null = null;
let applyInjector: ApplyInjector | null = null;
let pvpHistory: PvpHistory | null = null;
let pvpRecorder: PvpRecorder | null = null;
let pvpReader: PvpReader | null = null;
let collectionsStore: CollectionsStore | null = null;
let collectionsRecorder: CollectionsRecorder | null = null;
let collectionsReader: CollectionsReader | null = null;
let forgeInjector: ForgeInjector | null = null;
/** Fixture mode only — see `gameReader.onAccountCommitted` for why a re-ingest of an unchanged
 *  rotation is not free. */
let lastIngestedRotationBody: string | null = null;
// The resolved language, held in a module-level `let` exactly as
// `consentStore`'s own value is. Defaults to `DEFAULT_SETTINGS` until `bootstrap()` resolves it
// (inside `whenReady()`, where `app.getLocale()` is documented valid) so `settings:get` never
// races a caller that arrives before boot finishes.
let currentSettings: AppSettings = DEFAULT_SETTINGS;
let updateService: UpdateService | null = null;
let shellLifecycle: ShellLifecycle | null = null;
let windowLayoutStore: WindowLayoutStore | null = null;
let layoutPersistTimer: ReturnType<typeof setTimeout> | null = null;
let miniLiveController: MiniLiveController | null = null;
let miniLayoutPersistTimer: ReturnType<typeof setTimeout> | null = null;
let gameKeepAlive: GameKeepAlive | null = null;
let usagePing: UsagePing | null = null;

const emitEvent = createEventEmitter({ getWindows: () => BrowserWindow.getAllWindows() });

/** Reads, transitions, persists, and announces one consent event — the single path every
 *  consent:* handler below goes through. Every dep below reads the module-level
 *  `let` bindings lazily, through its own closure, because they are still null at this point in
 *  the module and are only assigned once `bootstrap()` runs. */
const applyConsentEvent = createConsentApplier({
  read: () => consentStore?.read() ?? initialConsent(),
  write: (next) => {
    consentStore?.write(next);
  },
  beforeLosingConsent: [
    async () => {
      await liveSource?.forceDetach();
    },
  ],
  afterApplied: [
    (next) => {
      emitEvent('consent:changed', next);
    },
    (next) => {
      shellLifecycle?.setMiniAvailable(isGranted(next));
      if (!isGranted(next)) {
        miniLiveController?.close();
      }
    },
    (next) => {
      accountRefresh?.onConsentChanged(next);
    },
    () => {
      liveSource?.pollNow();
    },
    () => {
      gameReader?.pollNow();
    },
  ],
  onError: (error) => {
    log.error({ scope: 'main', event: 'consent.pre_persist_hook_failed', error: String(error) });
  },
});

/** The compact window shows account data, so every route to it — the header button, the tray
 *  entry, the IPC channel and the restore-on-launch — sits behind the same grant the Live tab
 *  itself is behind. */
function isMiniAvailable(): boolean {
  return isGranted(consentStore?.read() ?? initialConsent());
}

function persistSettings(settings: AppSettings): SettingsWriteResult {
  currentSettings = settings;
  const result = settingsStore?.write(settings) ?? { settings, persisted: false, reason: 'no_store' };
  emitEvent('settings:changed', settings);
  return result;
}

function applyLocale(next: AppLocale): SettingsWriteResult {
  const result = applyLocaleSettings({ current: currentSettings, next, persist: persistSettings });
  shellLifecycle?.setTrayLabels(trayTextFor(next));
  return result;
}

function applyAlwaysOnTopMain(enabled: unknown): SettingsWriteResult {
  return applyAlwaysOnTopMainSettings({
    current: currentSettings,
    enabled,
    setAlwaysOnTop: (on, level) => {
      mainWindow?.setAlwaysOnTop(on, level);
    },
    persist: persistSettings,
  });
}

function applyAlwaysOnTopMini(enabled: unknown): SettingsWriteResult {
  return applyAlwaysOnTopMiniSettings({
    current: currentSettings,
    enabled,
    setAlwaysOnTop: (on, level) => {
      miniLiveController?.applyAlwaysOnTop(on, level);
    },
    persist: persistSettings,
  });
}

function applyForgeWritesEnabled(enabled: unknown): SettingsWriteResult {
  return applyForgeWritesEnabledSettings({ current: currentSettings, enabled, persist: persistSettings });
}

function applyRestartGameOnExit(enabled: unknown): SettingsWriteResult {
  return applyRestartGameOnExitSettings({
    current: currentSettings,
    enabled,
    setEnabled: (on) => {
      gameKeepAlive?.setEnabled(on);
    },
    persist: persistSettings,
  });
}

function applyUsagePingEnabled(enabled: unknown): SettingsWriteResult {
  return applyUsagePingEnabledSettings({
    current: currentSettings,
    enabled,
    setEnabled: (on) => {
      usagePing?.setEnabled(on);
    },
    persist: persistSettings,
  });
}

function applyMarketQuoteCurrency(next: unknown): SettingsWriteResult {
  return applyMarketQuoteCurrencySettings({ current: currentSettings, next, persist: persistSettings });
}

// Threads Electron's real `app.isPackaged` (via `resolveAppEnv()`) so `sessionCfgPath`'s
// `BFC_TOKEN_PATH_OVERRIDE` escape hatch can ever apply unpackaged — and, symmetrically, cannot
// apply in a packaged build no matter what is set in its environment. Shared by the account cycle,
// the forge run and the on-demand read, so all three read the same file and all three redact the
// same token.
const readToken: NonNullable<AccountRefreshDeps['readToken']> = createRedactingTokenReader({
  readToken: (consent) =>
    readSessionToken(consent, undefined, sessionCfgPath({ isPackaged: resolveAppEnv().isPackaged })),
  logSink: log,
  getLiveSource: () => liveSource,
});

function currentAccountSource(): AccountSource {
  return gameReader?.getMode() === 'fixture' ? 'fixture' : 'server';
}

/** The account the session token names, when consent lets it be read — the tap sees only
 *  response bodies, so an observed duel is stamped with the account the app is bound to. */
function boundAccountId(): string | null {
  const consent = consentStore?.read() ?? initialConsent();
  if (!isGranted(consent)) return null;
  const result = readToken(consent);
  return result.ok ? result.accountId : null;
}

function requestAccountReadNow(): AccountReadResult {
  return requestAccountRead({
    consentStore: { read: () => consentStore?.read() ?? initialConsent() },
    accountSource: currentAccountSource,
    isGameRunning: () => gameReader?.isGameProcessRunning() ?? false,
    readToken,
    triggeredRefresh: () => triggeredRefresh,
  });
}

function registerIpcHandlers(): void {
  const dispatch = createIpcDispatch(
    createIpcHandlers({
      now: () => Date.now(),
      warn: (record) => {
        log.warn(record);
      },
      resolveEnv: resolveAppEnv,
      appVersion: () => app.getVersion(),
      appIsPackaged: () => app.isPackaged,
      getStorage: () => storage,
      getGameReader: () => gameReader,
      getConsentStore: () => consentStore,
      getLiveSource: () => liveSource,
      getUpdateService: () => updateService,
      getMarketService: () => marketService,
      getOnlinePlayersService: () => onlinePlayersService,
      getForgeService: () => forgeService,
      getForgeHistory: () => forgeHistory,
      getForgeInjector: () => forgeInjector,
      getApplyService: () => applyService,
      getApplyInjector: () => applyInjector,
      getPvpHistory: () => pvpHistory,
      getPvpReader: () => pvpReader,
      getCollectionsStore: () => collectionsStore,
      getCollectionsReader: () => collectionsReader,
      getMainWindow: () => mainWindow,
      getMiniLiveController: () => miniLiveController,
      getWindowLayoutStore: () => windowLayoutStore,
      getSettings: () => currentSettings,
      accountSource: currentAccountSource,
      isMiniAvailable,
      getAccountView: () => resolveAccountView({ gameReader, consentStore, accountRefresh, accountStore }),
      requestAccountReadNow,
      applyConsentEvent,
      emitMarketChanged: (view) => {
        emitEvent('market:changed', view);
      },
      applyLocale,
      applyAlwaysOnTopMain,
      applyAlwaysOnTopMini,
      applyForgeWritesEnabled,
      applyRestartGameOnExit,
      applyUsagePingEnabled,
      applyMarketQuoteCurrency,
      imageClipboard: {
        decodePng: (buffer) => nativeImage.createFromBuffer(buffer),
        writeImage: (image) => {
          clipboard.writeImage(image);
        },
      },
    }),
  );

  ipcMain.handle('bfc:invoke', (_event, channel: string, ...args: unknown[]) => dispatch(channel, ...args));
}

async function createMainWindow(): Promise<void> {
  const env = resolveAppEnv();
  const revealSuppressed = isWindowRevealSuppressed(process.env, env.isPackaged);

  const storedLayout = windowLayoutStore?.read()?.main ?? null;
  const primaryDisplay = screen.getPrimaryDisplay();
  const displays = screen.getAllDisplays().map((display) => ({
    id: display.id,
    workArea: display.workArea,
  }));
  const clamped = clampToWorkArea({
    stored: storedLayout,
    displays,
    primaryWorkArea: primaryDisplay.workArea,
    minWidth: MIN_MAIN_WIDTH,
    minHeight: MIN_MAIN_HEIGHT,
    defaultWidth: DEFAULT_MAIN_WIDTH,
    defaultHeight: DEFAULT_MAIN_HEIGHT,
  });

  if (storedLayout) {
    log.info({
      scope: 'main',
      event: 'window.layout_restore',
      displayMissing: clamped.displayMissing,
    });
  }

  mainWindow = new BrowserWindow({
    width: clamped.bounds.width,
    height: clamped.bounds.height,
    x: clamped.bounds.x,
    y: clamped.bounds.y,
    minWidth: MIN_MAIN_WIDTH,
    minHeight: MIN_MAIN_HEIGHT,
    backgroundColor: '#17100c',
    show: false,
    title: env.productName,
    icon: resolveAppIconPath(__dirname),
    // Hidden title bar with no `titleBarOverlay`: the header draws its own caption buttons
    // (`WindowControls`), which the OS overlay cannot be asked to do — Windows fixes those
    // buttons at 47px wide and only their height and colours are configurable.
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // `maximize()` shows a window that is not being displayed yet, so restoring a maximized layout
  // is a second way onto the screen and has to answer to the same gate as `reveal`.
  if (clamped.isMaximized && !revealSuppressed) {
    mainWindow.maximize();
  }

  applyExternalNavigationPolicy(mainWindow.webContents, {
    openExternal: (url) => shell.openExternal(url),
    log,
    internalUrls: env.isDev ? [RENDERER_DEV_URL] : [],
  });

  gameReader?.setWindowProvider(() => mainWindow);

  const reveal = (): void => {
    if (revealSuppressed) return;
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
    mainWindow.webContents.on('before-input-event', (_event, input) => {
      if (input.type !== 'keyDown' || input.isAutoRepeat) return;
      if (input.control && !input.shift && input.key.toLowerCase() === 'r') {
        mainWindow?.webContents.reload();
      } else if (input.control && input.shift && input.key.toLowerCase() === 'i') {
        mainWindow?.webContents.toggleDevTools();
      }
    });

    log.info({ scope: 'main', event: 'renderer.load_url', url: RENDERER_DEV_URL });
    await mainWindow.loadURL(RENDERER_DEV_URL);
    if (process.env.BFC_OPEN_DEVTOOLS === '1') {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
  } else {
    log.info({ scope: 'main', event: 'renderer.load_url', url: RENDERER_ENTRY_URL });
    await mainWindow.loadURL(RENDERER_ENTRY_URL);
  }

  setupShellLifecycle(env);
  attachWindowLayoutPersistence();
  // Seed the layout row now: the mini window's own layout writes hang off the main entry, and
  // without this a mini opened before the first move or resize would have nowhere to persist.
  persistMainWindowLayout(true);
  miniLiveController = createMiniLiveControllerInstance(env);
  if (isMiniAvailable()) {
    miniLiveController.restoreIfWasOpen();
  }
}

function scheduleMiniLayoutPersist(callback: () => void, immediate: boolean): void {
  if (immediate) {
    if (miniLayoutPersistTimer) {
      clearTimeout(miniLayoutPersistTimer);
      miniLayoutPersistTimer = null;
    }
    callback();
    return;
  }

  if (miniLayoutPersistTimer) {
    clearTimeout(miniLayoutPersistTimer);
  }
  miniLayoutPersistTimer = setTimeout(() => {
    miniLayoutPersistTimer = null;
    callback();
  }, 300);
}

function createMiniLiveControllerInstance(env: ReturnType<typeof resolveAppEnv>): MiniLiveController {
  if (!windowLayoutStore) {
    throw new Error('window layout store is not ready');
  }

  return createMiniLiveController({
    BrowserWindowCtor: BrowserWindow,
    layoutStore: windowLayoutStore,
    resolveLoadUrl: () => resolveMiniLiveLoadUrl({ isDev: env.isDev, devBaseUrl: RENDERER_DEV_URL }),
    preloadPath: path.join(__dirname, '../preload/index.cjs'),
    iconPath: resolveAppIconPath(__dirname),
    suppressReveal: isWindowRevealSuppressed(process.env, env.isPackaged),
    applyExternalNavigation: (webContents) => {
      applyExternalNavigationPolicy(webContents as WebContents, {
        openExternal: (url) => shell.openExternal(url),
        log,
        internalUrls: env.isDev ? [RENDERER_DEV_URL] : [],
      });
    },
    getDisplays: () =>
      screen.getAllDisplays().map((display) => ({
        id: display.id,
        workArea: display.workArea,
      })),
    getPrimaryWorkArea: () => screen.getPrimaryDisplay().workArea,
    getDisplayForBounds: (bounds) => {
      const display = screen.getDisplayMatching(bounds);
      return { id: display.id, workArea: display.workArea };
    },
    getAlwaysOnTopMini: () => currentSettings.alwaysOnTopMini,
    schedulePersist: scheduleMiniLayoutPersist,
    log,
  });
}

function persistMainWindowLayout(immediate: boolean): void {
  if (!mainWindow || mainWindow.isDestroyed() || !windowLayoutStore) {
    return;
  }
  if (mainWindow.isMinimized()) {
    return;
  }

  const write = (): void => {
    if (!mainWindow || mainWindow.isDestroyed() || mainWindow.isMinimized() || !windowLayoutStore) {
      return;
    }

    const bounds = mainWindow.isMaximized() ? mainWindow.getNormalBounds() : mainWindow.getBounds();
    const display = screen.getDisplayMatching(bounds);
    const workArea = display.workArea;
    const result = windowLayoutStore.writeMain({
      displayId: display.id,
      x: bounds.x - workArea.x,
      y: bounds.y - workArea.y,
      width: bounds.width,
      height: bounds.height,
      isMaximized: mainWindow.isMaximized(),
    });
    if (!result.persisted) {
      log.error({ scope: 'main', event: 'window.layout_write_failed' });
    }
  };

  if (immediate) {
    if (layoutPersistTimer) {
      clearTimeout(layoutPersistTimer);
      layoutPersistTimer = null;
    }
    write();
    return;
  }

  if (layoutPersistTimer) {
    clearTimeout(layoutPersistTimer);
  }
  layoutPersistTimer = setTimeout(() => {
    layoutPersistTimer = null;
    write();
  }, 300);
}

function attachWindowLayoutPersistence(): void {
  if (!mainWindow) {
    return;
  }

  const skipTransient = (): boolean => mainWindow?.isMaximized() === true || mainWindow?.isMinimized() === true;

  mainWindow.on('move', () => {
    if (skipTransient()) {
      return;
    }
    persistMainWindowLayout(false);
  });
  mainWindow.on('resize', () => {
    if (skipTransient()) {
      return;
    }
    persistMainWindowLayout(false);
  });
  mainWindow.on('maximize', () => {
    persistMainWindowLayout(true);
    emitEvent('window:changed', { maximized: true });
  });
  mainWindow.on('unmaximize', () => {
    persistMainWindowLayout(true);
    emitEvent('window:changed', { maximized: false });
  });
  mainWindow.on('hide', () => {
    persistMainWindowLayout(true);
  });
}

function setupShellLifecycle(env: ReturnType<typeof resolveAppEnv>): void {
  if (!mainWindow) {
    return;
  }

  const windowPort: WindowPort = {
    hide: () => mainWindow?.hide(),
    show: () => mainWindow?.show(),
    focus: () => mainWindow?.focus(),
    restore: () => mainWindow?.restore(),
    isVisible: () => mainWindow?.isVisible() ?? false,
    isMinimized: () => mainWindow?.isMinimized() ?? false,
    isDestroyed: () => mainWindow?.isDestroyed() ?? true,
  };

  const trayResult = createElectronTray({
    iconPath: resolveAppIconPath(__dirname),
    tooltip: env.productName,
    platform: process.platform,
    fileExists: (filePath) => fs.existsSync(filePath),
    createNativeImage: (filePath) => nativeImage.createFromPath(filePath),
  });

  const trayPort = trayResult.ok ? trayResult.tray : null;
  if (!trayResult.ok && trayResult.reason !== 'not-win32') {
    log.error({ scope: 'main', event: 'tray.create_failed', reason: trayResult.reason });
  }

  shellLifecycle = createShellLifecycle({
    window: windowPort,
    tray: trayPort,
    quit: () => {
      app.quit();
    },
    openMini: () => miniLiveController?.open(),
    log,
    labels: trayTextFor(currentSettings.locale),
    tooltip: env.productName,
    miniAvailable: isMiniAvailable(),
  });

  if (shouldInstallShellSmokeBridge({ isPackaged: env.isPackaged })) {
    installShellSmokeBridge(shellLifecycle, () => {
      shellLifecycle?.show();
    });
  }

  if (trayResult.ok) {
    const showFromTray = (): void => {
      shellLifecycle?.show();
    };
    trayResult.native.on('click', showFromTray);
    trayResult.native.on('double-click', showFromTray);
  }

  mainWindow.on('close', (event) => {
    if (shellLifecycle?.onWindowClose() === 'hide') {
      event.preventDefault();
      mainWindow?.hide();
      log.info({ scope: 'main', event: 'window.hidden' });
    }
  });
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

  // The consented game-API account reader. Independent of the game reader's own
  // memory/fixture ticking: consent gates every request structurally,
  // so this cycle issues nothing at all until the player has accepted the first-run modal.
  // Constructed before registerIpcHandlers() so the consent:* handlers never see a null store,
  // and before the game reader so its own live-mode process lookups can be gated by the same
  // predicate the live tap already checks.
  consentStore = createConsentStore(accountOpen.db);

  gameReader = new GameReaderService(
    userDataDir,
    {},
    { isPackaged: resolveAppEnv().isPackaged, consent: createLiveConsentGate(consentStore) },
  );
  gameReader.setAccountStore(accountStore);

  // Same db handle consentStore takes. Resolved ONCE, here, inside
  // whenReady() (bootstrap()'s own calling context), where app.getLocale() is documented to be
  // valid. A stored override always wins over the OS; source is logged so "why did it
  // open in English?" is answerable from a log line rather than a guess.
  settingsStore = createSettingsStore(accountOpen.db);
  windowLayoutStore = createWindowLayoutStore(accountOpen.db);

  // Replay mode swaps the whole attach mechanism for a reader over a committed byte capture, so
  // an unpackaged dev build never lists processes and never loads the instrumentation runtime —
  // which is what lets it run beside a packaged build that is tapping the real game.
  const liveConsent = createLiveConsentGate(consentStore);

  // A developer recording of everything the tap observes, including the bodies the app refuses to
  // identify and discards. Both the gate here and the recorder's own constructor are handed
  // Electron's real packaged answer, so no environment can talk an installed build into writing
  // live account traffic to disk.
  const observationCaptureEnabled = isObservationCaptureEnabled(process.env, resolveAppEnv().isPackaged);
  const observationCaptureStartedAt = Date.now();
  const observationCaptureDestination = observationCaptureFilePath(userDataDir, observationCaptureStartedAt);
  observationCapture = createObservationCapture({
    enabled: observationCaptureEnabled,
    isPackaged: resolveAppEnv().isPackaged,
    destination: observationCaptureDestination,
    appendPort: nodeObservationAppendPort(observationCaptureDestination),
    log,
  });

  // Only polled when the mode is actually on: a shipped build must not read a file every half
  // second for a recorder it does not have.
  if (observationCaptureEnabled) {
    observationMarkWatch = createMarkWatch({
      path: path.join(path.dirname(observationCaptureDestination), 'mark.txt'),
      readFile: (markPath) => (fs.existsSync(markPath) ? fs.readFileSync(markPath, 'utf8') : null),
      onMark: (label) => {
        observationCapture?.mark(label, Date.now());
      },
    });
    observationMarkWatch.start();
  }

  const replayLive = isReplayLiveSourceEnabled(process.env, resolveAppEnv().isPackaged);
  if (replayLive) {
    log.info({
      scope: 'main',
      event: 'live.replay_mode',
      capture: resolveReplayCapturePath(process.env, __dirname),
    });
  }

  // The duel history borrows accountOpen.db the way the forge ledger does. Built before the live
  // source so the seam it feeds exists from the first observed body: a duel that settles while
  // the app is open must never be dropped for having arrived early.
  pvpHistory = createPvpHistory(accountOpen.db, log);
  pvpRecorder = createPvpRecorder({
    history: pvpHistory,
    accountId: boundAccountId,
    emit: (history) => {
      emitEvent('pvp:changed', history);
    },
    log,
  });

  collectionsStore = createCollectionsStore({ db: accountOpen.db, accountId: boundAccountId, accountSource: currentAccountSource, log });
  collectionsRecorder = createCollectionsRecorder({
    store: collectionsStore,
    emit: (view) => {
      emitEvent('collections:changed', view);
    },
    log,
  });

  liveSource = new LiveSource({
    consent: liveConsent,
    userDataDir,
    flavor: resolveAppEnv().flavor,
    isPackaged: resolveAppEnv().isPackaged,
    observer: observationCapture,
    onObservedPvpBody: (observation) => {
      pvpRecorder?.observe(observation);
    },
    onObservedCollectionsBody: (observation) => {
      collectionsRecorder?.observe(observation);
    },
    log,
    ...(replayLive
      ? {
          createTap: createReplayTapFactory({
            capturePath: resolveReplayCapturePath(process.env, __dirname),
            pvpFixturePath: resolveReplayPvpFixturePath(process.env, __dirname),
            collectionsFixturePath: resolveReplayCollectionsFixturePath(process.env, __dirname),
            consent: liveConsent,
            log,
            onObservedFrame: (wire, atMs) => {
              observationCapture?.frame(wire, atMs);
            },
          }),
        }
      : {}),
  });
  // The raw per-frame stream stays internal to main (the game reader still needs every tick);
  // only `currency` crosses IPC immediately here. Field/recovery/on-field membership cross via
  // `liveFastPublisher` below instead, paced to LIVE_DISPLAY_REFRESH_MS rather than the tap's own
  // ~10Hz — publishing raw frames across IPC for the renderer to throttle is work in the wrong
  // process.
  // liveSource itself only ever raises 'frame' or 'currency' — 'fastUpdate' is constructed
  // downstream, by liveFastPublisher, from a separate emit callback, never by LiveSource.
  liveSource.subscribe((event) => {
    if (event.type === 'frame') {
      gameReader?.ingestLiveTick(event.frame);
    } else if (event.type === 'currency') {
      gameReader?.ingestLiveCurrency(event.currency);
      emitEvent('live:event', event);
    }
  });
  liveSource.start();

  // `refreshNow` is read lazily so construction order doesn't matter — `accountRefresh` itself is
  // assigned later in this function.
  triggeredRefresh = createTriggeredRefresh({
    refreshNow: () => accountRefresh?.refreshNow() ?? Promise.resolve(null),
    now: () => Date.now(),
  });
  // The scheduled cadence can otherwise leave the first read waiting out a full cycle after the
  // game becomes detected as running, which arrives too late to catch at boot.
  gameReader.onConnected = () => triggeredRefresh?.notify();
  liveFastPublisher = createLiveFastPublisher({
    getView: () => liveSource?.getView() ?? defaultLiveView(new Date().toISOString()),
    emit: (event) => {
      emitEvent('live:event', event);
    },
    scheduler: {
      schedule: (callback, intervalMs) => {
        const timer = setInterval(callback, intervalMs);
        return () => {
          clearInterval(timer);
        };
      },
    },
    onFieldMembershipDiverged: () => triggeredRefresh?.notify(),
  });
  liveFastPublisher.start();

  const storedSettings = settingsStore.read();
  const systemLocale = app.getLocale();
  const { locale, source } = resolveStartupLocale({ stored: storedSettings?.locale ?? null, systemLocale });
  currentSettings = storedSettings ? { ...storedSettings, locale } : { ...DEFAULT_SETTINGS, locale };
  log.info({ scope: 'main', event: 'locale.resolved', locale, source, systemLocale });

  gameKeepAlive = createGameKeepAlive({
    clock: { now: () => Date.now(), setTimeout, clearTimeout },
    processPresent: createProcessPresencePort({ isPackaged: resolveAppEnv().isPackaged }),
    askSteam: () => askSteam(createSteamLaunchDeps()),
    log: (event, detail) => {
      log.info({ scope: 'main', event, ...detail });
    },
  });
  gameKeepAlive.setEnabled(currentSettings.restartGameOnExit);
  gameKeepAlive.start();

  usagePing = createElectronUsagePing({
    isPackaged: resolveAppEnv().isPackaged,
    db: accountOpen.db,
    flavor: resolveAppEnv().flavor,
    version: app.getVersion(),
    isEnabled: () => currentSettings.usagePingEnabled,
    readAccount: () =>
      accountIdentityOf(resolveCachedAccountView({ gameReader, consentStore, accountRefresh })?.payload ?? null),
    log: (event, detail) => {
      log.info({ scope: 'main', event, ...detail });
    },
  });
  usagePing?.setEnabled(currentSettings.usagePingEnabled);
  usagePing?.start();

  const gate = createPacingGate({
    now: () => Date.now(),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  });

  // One writer, ever: the forge run and an apply run share this so neither can start while the
  // other holds it.
  const writerLock: WriterLock = createWriterLock();

  // One transport for both the read cycle and the forge run, so they identify themselves
  // identically. `app.getVersion()` is the packaged app's own version.
  const gameApiTransport = createNodeHttpsTransport(companionUserAgent(app.getVersion()));

  // Declared before accountRefresh so its onView callback can close over it;
  // assigned once every producer it reads (gameReader, consentStore, accountRefresh) exists.
  // Both producers below "ping" the notifier and ignore their own payload argument for that call
  // — the notifier always re-resolves the CURRENT cached view itself (resolveCachedAccountView),
  // so the push and the pull are provably the same function. accountRefresh's
  // callback additionally forwards its argument to liveSource — a separate consumer with its own
  // reason to want the freshly committed view.
  let notifier: ReturnType<typeof createAccountNotifier> | null = null;

  accountRefresh = createAccountRefresh({
    consentStore,
    transport: gameApiTransport,
    gate,
    store: accountStore,
    log,
    now: () => new Date().toISOString(),
    isGameRunning: () => gameReader?.isGameProcessRunning() ?? false,
    readToken,
    // account-refresh.ts itself is unmodified (its commit semantics are its own) —
    // only what the listener does changed: it used to emit unconditionally on every commit;
    // it now asks the notifier, which emits only on a real change.
    onView: (view) => {
      notifier?.notifyIfChanged();
      liveSource?.ingestRotation(view);
    },
  });

  notifier = createAccountNotifier({
    gameReader,
    consentStore,
    accountRefresh,
    emit: (view) => {
      emitEvent('account:changed', view);
    },
  });

  // The forge run reads the account the renderer is looking at, spends through the same gate
  // and transport as the cycle above, and lands its result through the cycle's own commit seam
  // so the notifier is what announces the patched bag and wallet.
  const cachedAccount = (): AccountView | null => resolveCachedAccountView({ gameReader, consentStore, accountRefresh });
  const currentItems = (): readonly unknown[] | null => cachedAccount()?.payload.items ?? null;
  const currentGold = (): number | null => {
    const gold = cachedAccount()?.payload.account?.gold;
    const parsed = typeof gold === 'string' ? Number(gold) : gold;
    return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : null;
  };
  pvpReader = createPvpReader({
    consentStore: { read: () => consentStore?.read() ?? initialConsent() },
    accountSource: currentAccountSource,
    isGameRunning: () => gameReader?.isGameProcessRunning() ?? false,
    readToken,
    transport: gameApiTransport,
    gate,
    recorder: pvpRecorder,
    log,
  });
  collectionsReader = createCollectionsReader({
    consentStore: { read: () => consentStore?.read() ?? initialConsent() },
    accountSource: currentAccountSource,
    isGameRunning: () => gameReader?.isGameProcessRunning() ?? false,
    readToken,
    transport: gameApiTransport,
    gate,
    recorder: collectionsRecorder,
    log,
  });

  forgeHistory = createForgeHistory(accountOpen.db, log);
  forgeService = createForgeService({
    consentStore,
    readToken,
    settings: () => currentSettings,
    transport: gameApiTransport,
    gate,
    accountSource: currentAccountSource,
    isGameRunning: () => gameReader?.isGameProcessRunning() ?? false,
    currentItems,
    currentGold,
    applyResult: (patch) => {
      accountRefresh?.applyPatch((payload) => patchAccountAfterForge(payload, patch, new Date().toISOString()));
    },
    history: forgeHistory,
    writerLock,
    emit: (event) => {
      emitEvent('forge:event', event);
    },
    log,
    now: () => Date.now(),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  });
  forgeInjector = createForgeInjector({
    honoured: () => shouldHonourForgeInject(process.env, resolveAppEnv().isPackaged),
    emit: (event) => {
      emitEvent('forge:event', event);
    },
  });

  // Constructed before the service so it can be passed in as the service's `scripted` dep.
  applyInjector = createApplyInjector({
    honoured: () => shouldHonourForgeInject(process.env, resolveAppEnv().isPackaged),
  });
  applyService = createApplyService({
    consentStore,
    readToken,
    settings: () => currentSettings,
    transport: gameApiTransport,
    gate,
    accountSource: currentAccountSource,
    isGameRunning: () => gameReader?.isGameProcessRunning() ?? false,
    currentItems,
    currentHeroes: () => cachedAccount()?.payload.heroes ?? null,
    currentGold,
    writerLock,
    requestReadNow: requestAccountReadNow,
    emit: (event) => {
      emitEvent('apply:event', event);
    },
    scripted: applyInjector,
    log,
    now: () => Date.now(),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  });

  // Fixture mode's ~20×/s ticker is the second producer that can
  // commit an account; wired the same way, ignoring its own payload argument for the same
  // reason. Production's live-tap-backed reader never commits (GameReaderService.tickLive() has
  // no commit site), so this callback never fires outside fixture-mode test builds.
  gameReader.onAccountCommitted = () => {
    notifier.notifyIfChanged();
    // Fixture mode has no `accountRefresh` behind it, and that is the only other caller of
    // `ingestRotation` — so without this the Live screen folds frames onto an empty roster and
    // shows nothing at all while ticks are arriving. Safe by the same reasoning as the comment
    // above: this callback provably never fires outside fixture mode.
    //
    // Only on a CHANGED rotation, though. The fixture ticker re-commits the same body several
    // times a minute, and every `ingestRotation` whose staleness guard does not hold replaces the
    // frame-measured field with a REST tick built from the rotation's own on-field set. Against a
    // replayed capture that disagrees about who is fighting, that lands as a visible flicker:
    // the next frame restores the measured countdowns, the tick after that drops them again.
    const committed = gameReader?.getAccountView();
    if (!committed) return;
    const rotationBody = JSON.stringify(committed.payload.casa ?? null);
    if (rotationBody === lastIngestedRotationBody) return;
    lastIngestedRotationBody = rotationBody;
    liveSource?.ingestRotation(committed);
  };

  // Public, unauthenticated, and player-data-free: it reads a published price file and Steam's
  // own per-item quote, carries no session token, and sends nothing about the account. That is
  // why it is not behind the game-API consent gate the account cycle sits behind.
  marketService = createMarketService({
    httpGet: marketHttpGet,
    cachePath: marketCachePath(userDataDir),
    log,
    now: () => Date.now(),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    quoteCurrency: () => currentSettings.marketQuoteCurrency,
    onChanged: (view) => {
      emitEvent('market:changed', view);
    },
  });

  // Public and player-free like the price list: it asks the project's own relay for one number
  // and sends nothing about the account. Offline mode reads a fixed count instead of the network.
  onlinePlayersService = createOnlinePlayersService({
    httpGet: currentAccountSource() === 'fixture' ? offlineOnlinePlayersGet(() => Date.now()) : onlinePlayersHttpGet,
    log,
    now: () => Date.now(),
    onChanged: (view) => {
      emitEvent('onlinePlayers:changed', view);
    },
  });

  registerIpcHandlers();
  registerRendererProtocol(path.join(__dirname, '../../renderer/out'));
  await createMainWindow();
  mainWindow?.setAlwaysOnTop(currentSettings.alwaysOnTopMain, 'normal');
  gameReader.start();
  log.info({
    scope: 'main',
    event: 'game-reader.started',
    mode: gameReader.getMode(),
  });

  accountRefresh.start();
  log.info({ scope: 'main', event: 'account-refresh.started' });

  // The updater is the one subsystem boot can lose and still hand over a working app, so its
  // failure stops at the Updates section instead of reaching `boot.failed`, which quits. The
  // stand-in reports the failure where a player can see it.
  //
  // Either way the settled status is pushed, not merely held: the renderer reads `updates:get`
  // once on mount and that read has usually already happened by now, against a service that did
  // not exist yet.
  try {
    updateService = await createElectronUpdateService((status) => {
      emitEvent('updates:changed', status);
    });
    updateService.start();
  } catch (error: unknown) {
    log.error({ scope: 'main', event: 'updates.unavailable', error: String(error) });
    updateService = unavailableUpdateService(app.getVersion(), env.descriptor.updateChannel);
  }
  emitEvent('updates:changed', updateService.getStatus());

  // Outside that guard on purpose: prices have nothing to do with the updater, and an updater
  // that could not start is no reason to open the app without them.
  marketService.start();
  log.info({ scope: 'main', event: 'market.started' });
  onlinePlayersService.start();
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
registerRendererSchemeAsPrivileged();
const { gotLock } = applyAppIdentity(app, {
  productName: env.productName,
  appId: env.appId,
  userDataPath: env.userDataPath,
});

// Windows-only app: Chromium supplies cut/copy/paste/select-all/undo natively inside editable
// fields with no menu present, so this costs no accelerators. Only macOS needs the Edit menu's
// roles for them.
Menu.setApplicationMenu(null);

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

// Proves the main process can compute with @bombfarm/domain: a value
// import from the built package, called once at boot. No behaviour depends on this; F2/F3
// are what actually use the edge. See src/main/domain-edge.ts.
log.info({ scope: 'main', event: 'domain.edge_ready', fuseSecondsAtZeroCdr: fuseSecondsForCdr(0) });

if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    log.info({ scope: 'main', event: 'app.second_instance' });
    shellLifecycle?.show();
  });

  app.whenReady().then(bootstrap).catch((error: unknown) => {
    log.error({ scope: 'main', event: 'boot.failed', error: String(error) });
    app.quit();
  });

  app.on('window-all-closed', () => {
    if (
      !shouldQuitOnAllWindowsClosed({
        platform: process.platform,
        trayPresent: shellLifecycle?.trayPresent ?? false,
      })
    ) {
      return;
    }
    app.quit();
  });

  app.on('before-quit', () => {
    shutdownInOrder({
      onStepFailed: (step, error) => {
        log.error({ scope: 'main', event: 'shutdown.step_failed', step, error: String(error) });
      },
      steps: {
        markQuitting: () => {
          shellLifecycle?.markQuitting();
        },
        stopUpdateService: () => {
          updateService?.stop();
          updateService = null;
        },
        stopGameReader: () => {
          gameReader?.stop();
          gameReader = null;
        },
        stopGameKeepAlive: () => {
          gameKeepAlive?.stop();
          gameKeepAlive = null;
        },
        stopUsagePing: () => {
          usagePing?.stop();
          usagePing = null;
        },
        stopAccountRefresh: () => {
          accountRefresh?.stop();
          accountRefresh = null;
        },
        stopLiveFastPublisher: () => {
          liveFastPublisher?.stop();
          liveFastPublisher = null;
        },
        stopMarketService: () => {
          marketService?.stop();
          marketService = null;
        },
        stopOnlinePlayersService: () => {
          onlinePlayersService?.stop();
          onlinePlayersService = null;
        },
        releaseForgeService: () => {
          forgeService = null;
        },
        releaseForgeInjector: () => {
          forgeInjector = null;
        },
        releaseApplyService: () => {
          applyService = null;
        },
        releaseApplyInjector: () => {
          applyInjector = null;
        },
        // forgeHistory borrows accountOpen.db the way settingsStore does; accountStore.close()
        // below owns the handle, so it gains no close() of its own.
        releaseForgeHistory: () => {
          forgeHistory = null;
        },
        releasePvpReader: () => {
          pvpReader = null;
        },
        releasePvpRecorder: () => {
          pvpRecorder = null;
        },
        releasePvpHistory: () => {
          pvpHistory = null;
        },
        releaseCollectionsReader: () => {
          collectionsReader = null;
        },
        releaseCollectionsRecorder: () => {
          collectionsRecorder = null;
        },
        releaseCollectionsStore: () => {
          collectionsStore = null;
        },
        releaseTriggeredRefresh: () => {
          triggeredRefresh = null;
        },
        teardownLiveSource: () => {
          void liveSource?.teardown();
          liveSource = null;
        },
        stopObservationMarkWatch: () => {
          observationMarkWatch?.stop();
          observationMarkWatch = null;
        },
        closeObservationCapture: () => {
          observationCapture?.close();
          observationCapture = null;
        },
        releaseRotationIngestMemo: () => {
          lastIngestedRotationBody = null;
        },
        releaseConsentStore: () => {
          consentStore = null;
        },
        persistMainWindowLayout: () => {
          persistMainWindowLayout(true);
        },
        clearLayoutPersistTimer: () => {
          if (layoutPersistTimer) {
            clearTimeout(layoutPersistTimer);
            layoutPersistTimer = null;
          }
        },
        clearMiniLayoutPersistTimer: () => {
          if (miniLayoutPersistTimer) {
            clearTimeout(miniLayoutPersistTimer);
            miniLayoutPersistTimer = null;
          }
        },
        destroyTray: () => {
          shellLifecycle?.destroyTray();
        },
        clearShellSmokeBridge: () => {
          clearShellSmokeBridge();
        },
        releaseShellLifecycle: () => {
          shellLifecycle = null;
        },
        disposeMiniLiveController: () => {
          miniLiveController?.dispose();
          miniLiveController = null;
        },
        // settingsStore borrows accountOpen.db, which accountStore.close() already owns
        // below; it holds no timer and opens no handle of its own, so it must not gain a close().
        releaseSettingsStore: () => {
          settingsStore = null;
        },
        releaseWindowLayoutStore: () => {
          windowLayoutStore = null;
        },
        closeStorage: () => {
          storage?.close();
          storage = null;
        },
        closeAccountStore: () => {
          accountStore?.close();
          accountStore = null;
        },
        flushLog: () => {
          log.flush();
        },
      },
    });
  });
}
