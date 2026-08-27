import path from 'node:path';
import { app, BrowserWindow, ipcMain, Menu } from 'electron';
import {
  DEFAULT_SETTINGS,
  isIpcChannel,
  liveGap,
  resolveStartupLocale,
  type AccountView,
  type AppLocale,
  type AppSettings,
  type ConsentRecord,
  type IpcEventChannel,
  type IpcEvents,
  type IpcInvokeChannel,
  type LiveDiagnosticsDumpOutcome,
  type LiveView,
  type SettingsWriteResult,
} from '@bombfarm/contracts';
import { createPacingGate, initialConsent } from '@bombfarm/game-api';
import { createAccountNotifier, resolveAccountView } from './account-view.js';
import { applyAppIdentity } from './app-identity.js';
import { createBootRecord } from './boot-record.js';
import { fuseSecondsForCdr } from './domain-edge.js';
import { InvalidFlavorError, resolveAppEnv, RENDERER_DEV_URL, type AppEnv } from './env.js';
import { GameReaderService } from './game-reader/game-reader-service.js';
import {
  registerRendererProtocol,
  registerRendererSchemeAsPrivileged,
  RENDERER_ENTRY_URL,
} from './renderer-protocol.js';
import { createAccountRefresh, type AccountRefreshHandle } from './game-api/account-refresh.js';
import { createConsentApplier } from './game-api/consent-applier.js';
import { createConsentStore, type ConsentStore } from './game-api/consent-store.js';
import { createLiveConsentGate } from './game-api/live-consent-gate.js';
import { createSettingsStore, type SettingsStore } from './game-api/settings-store.js';
import { nodeHttpsTransport } from './game-api/https-transport.js';
import { readSessionToken, sessionCfgPath } from './game-api/session-token-file.js';
import { createTriggeredRefresh, type TriggeredRefresh } from './game-api/triggered-refresh.js';
import { createLiveFastPublisher, type LiveFastPublisher } from './live-source/live-fast-publisher.js';
import { LiveSource } from './live-source/live-source.js';
import {
  createReplayTapFactory,
  isReplayLiveSourceEnabled,
  resolveReplayCapturePath,
} from './live-source/replay-tap.js';
import { configureLogging, log } from './logging.js';
import { createAccountStore, type AccountStore } from './storage/account-store.js';
import { createStorage, openAccountDatabase, type Storage } from './storage/index.js';

let mainWindow: BrowserWindow | null = null;
let storage: Storage | null = null;
let gameReader: GameReaderService | null = null;
let accountStore: AccountStore | null = null;
let accountRefresh: AccountRefreshHandle | null = null;
let consentStore: ConsentStore | null = null;
let settingsStore: SettingsStore | null = null;
let liveSource: LiveSource | null = null;
let liveFastPublisher: LiveFastPublisher | null = null;
let triggeredRefresh: TriggeredRefresh | null = null;
/** Fixture mode only — see `gameReader.onAccountCommitted` for why a re-ingest of an unchanged
 *  rotation is not free. */
let lastIngestedRotationBody: string | null = null;
// MP3 F4 (AD-053) — the resolved language, held in a module-level `let` exactly as
// `consentStore`'s own value is. Defaults to `DEFAULT_SETTINGS` until `bootstrap()` resolves it
// (inside `whenReady()`, where `app.getLocale()` is documented valid) so `settings:get` never
// races a caller that arrives before boot finishes.
let currentSettings: AppSettings = DEFAULT_SETTINGS;

function emitEvent<C extends IpcEventChannel>(channel: C, payload: IpcEvents[C]): void {
  mainWindow?.webContents.send(`bfc:event:${channel}`, payload);
}

/** Reads, transitions, persists, and announces one consent event — the single path every
 *  consent:* handler below goes through (LAR-01/03…05). Every dep below reads the module-level
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

/**
 * MP3 F4 (`AD-051`/`AD-052`, design.md §4.1) — the one path both `settings:useEnglish` and
 * `settings:usePortuguese` go through (the `applyConsentEvent` shape, `index.ts:40-47`, applied
 * to a payload with two possible values instead of an enum event). APPLIES first, always, THEN
 * persists — `currentSettings` is reassigned before the store is ever touched, so the returned
 * `settings` is the applied value on every branch (MIN-11's "the language still applies for the
 * session" is then structural, not a branch someone has to remember to write).
 */
function applyLocale(next: AppLocale): SettingsWriteResult {
  currentSettings = { schemaVersion: 1, locale: next };
  return settingsStore?.write(currentSettings) ?? { settings: currentSettings, persisted: false, reason: 'no_store' };
}

function defaultLiveView(): LiveView {
  const now = new Date().toISOString();
  return {
    currency: liveGap('neverAttached', now),
    field: [],
    recovery: [],
    rotation: null,
    onFieldHeroIds: [],
    updatedAt: now,
  };
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
    // MP3 F4 (AD-053) — the resolved settings (stored override, else OS detection, else
    // DEFAULT_SETTINGS.locale), not the constant this has returned since MP1.
    'settings:get': (): AppSettings => currentSettings,
    'settings:useEnglish': (): SettingsWriteResult => applyLocale('en'),
    'settings:usePortuguese': (): SettingsWriteResult => applyLocale('pt-BR'),
    'storage:health': () => storage?.healthCheck() ?? { binding: 'unknown', ok: false },
    'game:getStatus': () => gameReader?.getStatus() ?? {
      status: 'not_running' as const,
      updatedAt: new Date().toISOString(),
    },
    // MP3 F3 (AD-043) — the handler's pre-F3 body now lives, verbatim, in account-view.ts's
    // resolveAccountView(); this is a one-line call to it. See that file for the T-fix-6
    // precedence comment this used to carry inline.
    'account:get': (): AccountView => resolveAccountView({ gameReader, consentStore, accountRefresh, accountStore }),
    'consent:get': (): ConsentRecord => consentStore?.read() ?? initialConsent(),
    'consent:accept': (): Promise<ConsentRecord> =>
      applyConsentEvent({ type: 'accept', now: new Date().toISOString(), locale: currentSettings.locale }),
    'consent:decline': (): Promise<ConsentRecord> =>
      applyConsentEvent({ type: 'decline', locale: currentSettings.locale }),
    'consent:revoke': (): Promise<ConsentRecord> => applyConsentEvent({ type: 'revoke' }),
    'live:get': (): LiveView => liveSource?.getView() ?? defaultLiveView(),
    'live:dumpDiagnostics': (): LiveDiagnosticsDumpOutcome =>
      liveSource?.dumpDiagnostics() ?? { written: false, reason: 'no-source' },
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
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#17100c',
    show: false,
    title: env.productName,
    icon: path.join(__dirname, '../../assets/icon.ico'),
    titleBarStyle: 'hidden',
    // `--surface`/`--ink` (packages/ui/src/styles.css) as sRGB hex — Electron's titleBarOverlay
    // can't take `oklch()`. Height matches AppShell's own header token (`--spacing-top`, 58px),
    // not the OS caption default, so the overlay's Minimize/Maximize/Close buttons sit centred
    // against it.
    titleBarOverlay: { color: '#261d19', symbolColor: '#efe6e1', height: 58 },
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

  // MP2 F2 — the consented game-API account reader. Independent of the game reader's own
  // memory/fixture ticking: consent gates every request structurally (LAR-01/AD-025/AD-028),
  // so this cycle issues nothing at all until the player has accepted the first-run modal (T9).
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

  // MP3 F4 (AD-052/AD-053) — same db handle consentStore takes. Resolved ONCE, here, inside
  // whenReady() (bootstrap()'s own calling context), where app.getLocale() is documented to be
  // valid. A stored override always wins over the OS (MIN-09); source is logged so "why did it
  // open in English?" is answerable from a log line rather than a guess (MIN-06/MIN-07).
  settingsStore = createSettingsStore(accountOpen.db);

  // Replay mode swaps the whole attach mechanism for a reader over a committed byte capture, so
  // an unpackaged dev build never lists processes and never loads the instrumentation runtime —
  // which is what lets it run beside a packaged build that is tapping the real game.
  const liveConsent = createLiveConsentGate(consentStore);
  const replayLive = isReplayLiveSourceEnabled(process.env, resolveAppEnv().isPackaged);
  if (replayLive) {
    log.info({
      scope: 'main',
      event: 'live.replay_mode',
      capture: resolveReplayCapturePath(process.env, __dirname),
    });
  }

  liveSource = new LiveSource({
    consent: liveConsent,
    userDataDir,
    flavor: resolveAppEnv().flavor,
    log,
    ...(replayLive
      ? {
          createTap: createReplayTapFactory({
            capturePath: resolveReplayCapturePath(process.env, __dirname),
            consent: liveConsent,
            log,
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
  liveFastPublisher = createLiveFastPublisher({
    getView: () => liveSource?.getView() ?? defaultLiveView(),
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
  currentSettings = { schemaVersion: 1, locale };
  log.info({ scope: 'main', event: 'locale.resolved', locale, source, systemLocale });

  const gate = createPacingGate({
    now: () => Date.now(),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  });

  // MP3 F3 (AD-043) — declared before accountRefresh so its onView callback can close over it;
  // assigned once every producer it reads (gameReader, consentStore, accountRefresh) exists.
  // Both producers below "ping" the notifier and ignore their own payload argument for that call
  // — the notifier always re-resolves the CURRENT cached view itself (resolveCachedAccountView),
  // so the push and the pull are provably the same function (design.md §2.3). accountRefresh's
  // callback additionally forwards its argument to liveSource — a separate consumer with its own
  // reason to want the freshly committed view.
  let notifier: ReturnType<typeof createAccountNotifier> | null = null;

  accountRefresh = createAccountRefresh({
    consentStore,
    transport: nodeHttpsTransport,
    gate,
    store: accountStore,
    log,
    now: () => new Date().toISOString(),
    // Threads Electron's real `app.isPackaged` (via `resolveAppEnv()`) so `sessionCfgPath`'s
    // `BFC_TOKEN_PATH_OVERRIDE` escape hatch (T-fix-4) can ever apply — and, symmetrically,
    // cannot apply in a packaged build no matter what is set in its environment. See
    // `session-token-file.ts`'s `SessionCfgPathDeps` doc comment.
    readToken: (consent) => {
      const result = readSessionToken(consent, undefined, sessionCfgPath({ isPackaged: resolveAppEnv().isPackaged }));
      if (result.ok) {
        const redact = (text: string): string => result.token.redactFrom(text);
        log.setCredentialRedactor(redact);
        liveSource?.setCredentialRedactor(redact);
      }
      return result;
    },
    // account-refresh.ts itself is unmodified (TD-10, MP2 owns that file's commit semantics) —
    // only what the listener does changed: it used to emit unconditionally on every commit
    // (AD-031 fact 2); it now asks the notifier, which emits only on a real change.
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

  // MP3 F3 (AD-043 point 3) — fixture mode's ~20×/s ticker is the second producer that can
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

  registerIpcHandlers();
  registerRendererProtocol(path.join(__dirname, '../../renderer/out'));
  await createMainWindow();
  gameReader.start();
  log.info({
    scope: 'main',
    event: 'game-reader.started',
    mode: gameReader.getMode(),
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

// MP3 F1 (AD-032) — proves the main process can compute with @bombfarm/domain: a value
// import from the built package, called once at boot. No behaviour depends on this; F2/F3
// are what actually use the edge. See src/main/domain-edge.ts.
log.info({ scope: 'main', event: 'domain.edge_ready', fuseSecondsAtZeroCdr: fuseSecondsForCdr(0) });

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

  // `before-quit` is the single shutdown path in this app (reached identically whether it fires
  // directly or via `window-all-closed`'s `app.quit()` above; there is no separate `will-quit`
  // handler and none is needed). The ordering below is load-bearing, not incidental: every
  // producer that can call `accountStore.commit()` — the game reader's fixture-mode ticker and
  // the game-API account-refresh cycle — must be told to stop *before* the SQLite handles are
  // closed. `GameReaderService.stop()` clears its own timer and latches a `stopped` flag so a
  // tick already in flight can never reach the store afterward; `AccountStore.close()` is
  // additionally defensive (a closed-store guard) in case a producer's shutdown ever races it
  // anyway. See fix/fixture-tick-after-db-close — closing storage before stopping the fixture
  // ticker produced an uncaught "database is not open" exception on quit.
  app.on('before-quit', () => {
    gameReader?.stop();
    gameReader = null;
    accountRefresh?.stop();
    accountRefresh = null;
    liveFastPublisher?.stop();
    liveFastPublisher = null;
    triggeredRefresh = null;
    void liveSource?.teardown();
    liveSource = null;
    lastIngestedRotationBody = null;
    consentStore = null;
    // MP3 F4 — settingsStore borrows accountOpen.db, which accountStore.close() already owns
    // below; it holds no timer and opens no handle of its own, so it must not gain a close().
    settingsStore = null;
    storage?.close();
    storage = null;
    accountStore?.close();
    accountStore = null;
    log.flush();
  });
}
