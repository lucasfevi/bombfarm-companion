/**
 * Dependency-injected — no Electron import anywhere in this file or in `ipc-handlers.ts` itself,
 * which is what makes the table reachable from a test at all. Every service arrives as a getter,
 * so the pre-boot `null` each one stands at is a state the tests can drive on purpose.
 */
import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_SETTINGS,
  EMPTY_FORGE_HISTORY,
  EMPTY_PVP_HISTORY,
  emptyMarketSnapshotView,
  getFlavorDescriptor,
  IPC_CHANNELS,
  liveGap,
  type AccountView,
  type AppLocale,
  type AccountSource,
  type AppSettings,
  type ApplyStartRequest,
  type ForgeHistoryResult,
  type ForgeStartRequest,
  type GameStatusInfo,
  type LiveView,
  type MarketQuoteCurrency,
  type MarketQuoteTarget,
  type MarketSnapshotView,
  type SettingsWriteResult,
  type UpdateStatus,
} from '@bombfarm/contracts';
import { grantedConsent } from '@bombfarm/game-api/test-fixtures';
import { initialConsent } from '@bombfarm/game-api';
import type { AppEnv } from './env.js';
import {
  createIpcDispatch,
  createIpcHandlers,
  defaultLiveView,
  MARKET_CHECK_FLOOR_MS,
  type ClipboardImageLike,
  type IpcHandlerDeps,
} from './ipc-handlers.js';

const NOW_MS = Date.parse('2026-09-29T12:00:00.000Z');
const NOW_ISO = '2026-09-29T12:00:00.000Z';
const STATUS_AT = '2026-09-29T11:59:00.000Z';

const BETA_ENV: AppEnv = {
  flavor: 'beta',
  descriptor: getFlavorDescriptor('beta'),
  isDev: false,
  isPackaged: true,
  appId: 'net.bombfarm.companion.beta',
  productName: 'Bomb Farm Companion (Beta)',
  userDataPath: '/user-data/beta',
  envConflict: null,
};

const DEV_ENV: AppEnv = {
  flavor: 'dev',
  descriptor: getFlavorDescriptor('dev'),
  isDev: true,
  isPackaged: false,
  appId: 'net.bombfarm.companion.dev',
  productName: 'Bomb Farm Companion (Dev)',
  userDataPath: '/user-data/dev',
  envConflict: null,
};

const ACCOUNT_VIEW: AccountView = {
  payload: {
    account: { phase: 42 },
    heroes: [{ id: 'h1', level: 20 }],
    skills: { totals: { dmg_static: 1 } },
    casa: { active_casa: 1 },
    items: [],
    fidelity: {
      account: { status: 'resolved', capturedAt: STATUS_AT },
      heroes: { status: 'resolved', capturedAt: STATUS_AT },
      skills: { status: 'resolved', capturedAt: STATUS_AT },
      casa: { status: 'resolved', capturedAt: STATUS_AT },
      items: { status: 'resolved', capturedAt: STATUS_AT },
    },
  },
  gameRunning: true,
  store: { status: 'ok', reason: null, binding: 'better-sqlite3' },
};

const LIVE_VIEW: LiveView = defaultLiveView('2026-09-01T00:00:00.000Z');

const POPULATED_FORGE_HISTORY: ForgeHistoryResult = {
  rows: [],
  totals: { runs: 3, spent: 900, rolls: 12, fails: 4 },
};

const ADOPTED_SNAPSHOT: MarketSnapshotView = {
  ...emptyMarketSnapshotView(),
  source: 'network',
  adoptedUtc: NOW_ISO,
};

const VALID_LAYOUT_PATCH = {
  showEarnings: true,
  showMap: false,
  showHeroes: true,
  axis: 'vertical',
} as const;

function updateStatus(phase: UpdateStatus['phase']): UpdateStatus {
  return {
    phase,
    currentVersion: '9.9.9',
    channel: 'beta',
    availableVersion: null,
    percent: null,
    error: null,
    lastCheckedAt: null,
  };
}

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01]);

function written(settings: AppSettings): SettingsWriteResult {
  return { settings, persisted: true, reason: null };
}

function fakeImage(width: number, height: number, empty = false): ClipboardImageLike {
  return { isEmpty: () => empty, getSize: () => ({ width, height }) };
}

function fakes() {
  let cleared = false;
  return {
    clock: { ms: NOW_MS },
    storage: { healthCheck: vi.fn(() => ({ binding: 'node:sqlite', ok: true })) },
    gameReader: {
      getStatus: vi.fn((): GameStatusInfo => ({ status: 'connected', updatedAt: STATUS_AT })),
    },
    consentStore: { read: vi.fn(() => grantedConsent(STATUS_AT)) },
    liveSource: {
      getView: vi.fn(() => LIVE_VIEW),
      dumpDiagnostics: vi.fn(() => ({ written: true as const, path: '/dumps/live.json' })),
      resetEarnings: vi.fn(),
    },
    updateService: {
      getStatus: vi.fn(() => updateStatus('idle')),
      check: vi.fn(() => Promise.resolve(updateStatus('checking'))),
      download: vi.fn(() => Promise.resolve(updateStatus('downloading'))),
      installOnRestart: vi.fn(() => updateStatus('ready')),
    },
    marketService: {
      getView: vi.fn(() => ADOPTED_SNAPSHOT),
      refreshSnapshot: vi.fn(() => Promise.resolve(ADOPTED_SNAPSHOT)),
      refreshItem: vi.fn((target: MarketQuoteTarget) =>
        Promise.resolve({
          ok: true as const,
          key: target.kind === 'key' ? target.key : null,
          hashName: 'Ember Blade',
          currency: 'USD' as const,
          amount: 1234,
          quotedUtc: NOW_ISO,
        }),
      ),
    },
    forgeService: {
      start: vi.fn(() => ({ ok: true as const, runId: 'run-7' })),
      cancel: vi.fn(() => true),
    },
    forgeHistory: {
      list: vi.fn(() => (cleared ? EMPTY_FORGE_HISTORY : POPULATED_FORGE_HISTORY)),
      clear: vi.fn(() => {
        cleared = true;
      }),
    },
    forgeInjector: { inject: vi.fn(() => ({ ok: true })) },
    applyService: {
      start: vi.fn(() => ({ ok: true as const, runId: 'apply-3' })),
      stop: vi.fn(() => true),
    },
    applyInjector: { arm: vi.fn(() => ({ ok: true })) },
    pvpHistory: {
      list: vi.fn(() => EMPTY_PVP_HISTORY),
      readFilm: vi.fn((): string | null => null),
    },
    pvpReader: { refresh: vi.fn(() => ({ ok: true as const })) },
    mainWindow: {
      isDestroyed: vi.fn(() => false),
      isMaximized: vi.fn(() => false),
      maximize: vi.fn(),
      unmaximize: vi.fn(),
      minimize: vi.fn(),
      close: vi.fn(),
      destroy: vi.fn(),
    },
    miniLiveController: { open: vi.fn(), close: vi.fn(), fitGrowthAxis: vi.fn() },
    windowLayoutStore: {
      getLayout: vi.fn(() => ({ showEarnings: false, showMap: false, showHeroes: true, axis: 'horizontal' as const })),
      setLayout: vi.fn(() => ({ showEarnings: true, showMap: false, showHeroes: true, axis: 'vertical' as const })),
    },
    imageClipboard: {
      decodePng: vi.fn(() => fakeImage(320, 180)),
      writeImage: vi.fn(),
    },
    spies: {
      warn: vi.fn(),
      accountSource: vi.fn((): AccountSource => 'server'),
      isMiniAvailable: vi.fn(() => true),
      getAccountView: vi.fn(() => ACCOUNT_VIEW),
      requestAccountReadNow: vi.fn(() => ({ ok: true as const })),
      applyConsentEvent: vi.fn(() => Promise.resolve(grantedConsent(NOW_ISO))),
      emitMarketChanged: vi.fn(),
      applyLocale: vi.fn((next: AppLocale) => written({ ...DEFAULT_SETTINGS, locale: next })),
      applyAlwaysOnTopMain: vi.fn(() => written(DEFAULT_SETTINGS)),
      applyAlwaysOnTopMini: vi.fn(() => written(DEFAULT_SETTINGS)),
      applyForgeWritesEnabled: vi.fn(() => written(DEFAULT_SETTINGS)),
      applyRestartGameOnExit: vi.fn(() => written(DEFAULT_SETTINGS)),
      applyUsagePingEnabled: vi.fn(() => written(DEFAULT_SETTINGS)),
      applyMarketQuoteCurrency: vi.fn(() => written(DEFAULT_SETTINGS)),
      appVersion: vi.fn(() => '1.2.3'),
      getSettings: vi.fn(() => DEFAULT_SETTINGS),
    },
  };
}

type Fakes = ReturnType<typeof fakes>;

/** Every service wired: the state the app is in once `bootstrap()` has run. */
function wired(env: AppEnv = BETA_ENV) {
  const f = fakes();
  const deps: IpcHandlerDeps = {
    now: () => f.clock.ms,
    warn: f.spies.warn,
    resolveEnv: () => env,
    appVersion: f.spies.appVersion,
    appIsPackaged: () => env.isPackaged,
    getStorage: () => f.storage,
    getGameReader: () => f.gameReader,
    getConsentStore: () => f.consentStore,
    getLiveSource: () => f.liveSource,
    getUpdateService: () => f.updateService,
    getMarketService: () => f.marketService,
    getForgeService: () => f.forgeService,
    getForgeHistory: () => f.forgeHistory,
    getForgeInjector: () => f.forgeInjector,
    getApplyService: () => f.applyService,
    getApplyInjector: () => f.applyInjector,
    getPvpHistory: () => f.pvpHistory,
    getPvpReader: () => f.pvpReader,
    getMainWindow: () => f.mainWindow,
    getMiniLiveController: () => f.miniLiveController,
    getWindowLayoutStore: () => f.windowLayoutStore,
    getSettings: f.spies.getSettings,
    accountSource: f.spies.accountSource,
    isMiniAvailable: f.spies.isMiniAvailable,
    getAccountView: f.spies.getAccountView,
    requestAccountReadNow: f.spies.requestAccountReadNow,
    applyConsentEvent: f.spies.applyConsentEvent,
    emitMarketChanged: f.spies.emitMarketChanged,
    applyLocale: f.spies.applyLocale,
    applyAlwaysOnTopMain: f.spies.applyAlwaysOnTopMain,
    applyAlwaysOnTopMini: f.spies.applyAlwaysOnTopMini,
    applyForgeWritesEnabled: f.spies.applyForgeWritesEnabled,
    applyRestartGameOnExit: f.spies.applyRestartGameOnExit,
    applyUsagePingEnabled: f.spies.applyUsagePingEnabled,
    applyMarketQuoteCurrency: f.spies.applyMarketQuoteCurrency,
    imageClipboard: f.imageClipboard,
  };
  const handlers = createIpcHandlers(deps);
  return { f, deps, handlers, dispatch: createIpcDispatch(handlers) };
}

/** Nothing wired: the state the table is built in, before `bootstrap()` assigns anything. */
function bare(env: AppEnv = BETA_ENV) {
  const w = wired(env);
  const deps: IpcHandlerDeps = {
    ...w.deps,
    getStorage: () => null,
    getGameReader: () => null,
    getConsentStore: () => null,
    getLiveSource: () => null,
    getUpdateService: () => null,
    getMarketService: () => null,
    getForgeService: () => null,
    getForgeHistory: () => null,
    getForgeInjector: () => null,
    getApplyService: () => null,
    getApplyInjector: () => null,
    getPvpHistory: () => null,
    getPvpReader: () => null,
    getMainWindow: () => null,
    getMiniLiveController: () => null,
    getWindowLayoutStore: () => null,
  };
  const handlers = createIpcHandlers(deps);
  return { f: w.f, deps, handlers, dispatch: createIpcDispatch(handlers) };
}

describe('the environment a renderer is told about', () => {
  it('names the flavor the resolved environment carries', () => {
    expect(wired().handlers['app:getFlavor']()).toBe('beta');
  });

  it('composes the badge, channel, packaging, version and account source from the env, the app and the reader', () => {
    const { handlers, f } = wired();
    expect(handlers['app:getEnvironment']()).toEqual({
      flavor: 'beta',
      productName: 'Bomb Farm Companion (Beta)',
      badgeLabel: getFlavorDescriptor('beta').badgeLabel,
      updateChannel: getFlavorDescriptor('beta').updateChannel,
      isPackaged: true,
      version: '1.2.3',
      accountSource: 'server',
    });
    expect(f.spies.appVersion).toHaveBeenCalledTimes(1);
    expect(f.spies.accountSource).toHaveBeenCalledTimes(1);
  });

  it('answers a ping from main itself, so the bridge can be proved end to end', () => {
    expect(wired().handlers['app:ping']()).toEqual({ ok: true, from: 'main' });
  });

  it('says the account is read from a fixture when the reader is in fixture mode', async () => {
    const { handlers, f } = wired();
    f.spies.accountSource.mockReturnValue('fixture');
    expect((await handlers['app:getEnvironment']()).accountSource).toBe('fixture');
  });
});

describe('settings', () => {
  it('serves the settings main currently holds rather than the compiled defaults', () => {
    const { handlers, f } = wired();
    const stored: AppSettings = { ...DEFAULT_SETTINGS, locale: 'en' };
    f.spies.getSettings.mockReturnValue(stored);
    expect(handlers['settings:get']()).toBe(stored);
  });

  it('routes each of the two language verbs to the locale applier and returns its write result', async () => {
    const { handlers, f } = wired();
    expect((await handlers['settings:useEnglish']()).settings.locale).toBe('en');
    expect((await handlers['settings:usePortuguese']()).settings.locale).toBe('pt-BR');
    expect(f.spies.applyLocale.mock.calls).toEqual([['en'], ['pt-BR']]);
  });

  it('hands each toggle straight to its own applier, with the value the renderer sent', async () => {
    const { handlers, f } = wired();
    await handlers['settings:setAlwaysOnTopMain'](true);
    await handlers['settings:setAlwaysOnTopMini'](false);
    await handlers['settings:setForgeWritesEnabled'](true);
    await handlers['settings:setRestartGameOnExit'](false);
    await handlers['settings:setUsagePingEnabled'](true);
    expect(f.spies.applyAlwaysOnTopMain).toHaveBeenCalledWith(true);
    expect(f.spies.applyAlwaysOnTopMini).toHaveBeenCalledWith(false);
    expect(f.spies.applyForgeWritesEnabled).toHaveBeenCalledWith(true);
    expect(f.spies.applyRestartGameOnExit).toHaveBeenCalledWith(false);
    expect(f.spies.applyUsagePingEnabled).toHaveBeenCalledWith(true);
  });

  it('passes the chosen quote currency through and returns what the write reported', async () => {
    const { handlers, f } = wired();
    const currency: MarketQuoteCurrency = 'BRL';
    expect((await handlers['settings:setMarketQuoteCurrency'](currency)).persisted).toBe(true);
    expect(f.spies.applyMarketQuoteCurrency).toHaveBeenCalledWith('BRL');
  });
});

describe('the caption buttons', () => {
  it('asks the window to minimize and answers nothing', () => {
    const { handlers, f } = wired();
    expect(handlers['window:minimize']()).toBeNull();
    expect(f.mainWindow.minimize).toHaveBeenCalledTimes(1);
  });

  it('maximizes a restored window and reports the state it left behind', () => {
    const { handlers, f } = wired();
    f.mainWindow.isMaximized.mockReturnValueOnce(false).mockReturnValueOnce(true);
    expect(handlers['window:toggleMaximize']()).toEqual({ maximized: true });
    expect(f.mainWindow.maximize).toHaveBeenCalledTimes(1);
    expect(f.mainWindow.unmaximize).not.toHaveBeenCalled();
  });

  it('unmaximizes a maximized window and reports the state it left behind', () => {
    const { handlers, f } = wired();
    f.mainWindow.isMaximized.mockReturnValueOnce(true).mockReturnValueOnce(false);
    expect(handlers['window:toggleMaximize']()).toEqual({ maximized: false });
    expect(f.mainWindow.unmaximize).toHaveBeenCalledTimes(1);
    expect(f.mainWindow.maximize).not.toHaveBeenCalled();
  });

  it('touches a destroyed window for nothing and answers not maximized', () => {
    const { handlers, f } = wired();
    f.mainWindow.isDestroyed.mockReturnValue(true);
    expect(handlers['window:toggleMaximize']()).toEqual({ maximized: false });
    expect(f.mainWindow.maximize).not.toHaveBeenCalled();
    expect(f.mainWindow.unmaximize).not.toHaveBeenCalled();
  });

  it('asks the window to close and never destroys it or quits the app, so the tray can still answer', () => {
    const { handlers, f } = wired();
    expect(handlers['window:close']()).toBeNull();
    expect(f.mainWindow.close).toHaveBeenCalledTimes(1);
    expect(f.mainWindow.destroy).not.toHaveBeenCalled();
  });

  it('reports the window as restored when there is no window to ask', () => {
    expect(bare().handlers['window:getState']()).toEqual({ maximized: false });
  });

  it('reports the maximized state the window itself reports', () => {
    const { handlers, f } = wired();
    f.mainWindow.isMaximized.mockReturnValue(true);
    expect(handlers['window:getState']()).toEqual({ maximized: true });
  });
});

describe('the compact window', () => {
  it('opens only while the grant the Live tab sits behind is held', () => {
    const { handlers, f } = wired();
    expect(handlers['miniLive:open']()).toBeNull();
    expect(f.miniLiveController.open).toHaveBeenCalledTimes(1);
  });

  it('refuses to open once the grant is gone, without asking the controller', () => {
    const { handlers, f } = wired();
    f.spies.isMiniAvailable.mockReturnValue(false);
    expect(handlers['miniLive:open']()).toBeNull();
    expect(f.miniLiveController.open).not.toHaveBeenCalled();
  });

  it('closes on request with no grant check, because closing is always allowed', () => {
    const { handlers, f } = wired();
    f.spies.isMiniAvailable.mockReturnValue(false);
    expect(handlers['miniLive:close']()).toBeNull();
    expect(f.miniLiveController.close).toHaveBeenCalledTimes(1);
  });

  it('forwards the measured content to the growth-axis fit', () => {
    const { handlers, f } = wired();
    expect(handlers['miniLive:fitGrowthAxis']({ width: 320, height: 240 })).toBeNull();
    expect(f.miniLiveController.fitGrowthAxis).toHaveBeenCalledWith({ width: 320, height: 240 });
  });

  it('serves the stored layout when there is a store to read', () => {
    const { handlers } = wired();
    expect(handlers['miniLive:getLayout']()).toEqual({
      showEarnings: false,
      showMap: false,
      showHeroes: true,
      axis: 'horizontal',
    });
  });

  it('falls back to the default layout with no store behind it', () => {
    expect(bare().handlers['miniLive:getLayout']()).toEqual({
      showEarnings: true,
      showMap: true,
      showHeroes: false,
      axis: 'vertical',
    });
  });

  it('writes a well-formed layout patch and answers the layout the write left behind', () => {
    const { handlers, f } = wired();
    expect(handlers['miniLive:setLayout'](VALID_LAYOUT_PATCH)).toEqual({
      showEarnings: true,
      showMap: false,
      showHeroes: true,
      axis: 'vertical',
    });
    expect(f.windowLayoutStore.setLayout).toHaveBeenCalledWith(VALID_LAYOUT_PATCH);
  });

  it('answers an unreadable patch with the layout as it stands, and writes nothing', () => {
    const { dispatch, f } = wired();
    expect(dispatch('miniLive:setLayout', { axis: 'sideways' })).toEqual({
      showEarnings: false,
      showMap: false,
      showHeroes: true,
      axis: 'horizontal',
    });
    expect(f.windowLayoutStore.setLayout).not.toHaveBeenCalled();
  });
});

describe('the account and the game reader', () => {
  it('serves whatever the account resolver decided, unchanged', () => {
    const { handlers } = wired();
    expect(handlers['account:get']()).toBe(ACCOUNT_VIEW);
  });

  it('forwards a read-now press to the same triggered read the app uses elsewhere', () => {
    const { handlers, f } = wired();
    expect(handlers['account:readNow']()).toEqual({ ok: true });
    expect(f.spies.requestAccountReadNow).toHaveBeenCalledTimes(1);
  });

  it('serves the reader status when the reader exists', () => {
    const { handlers } = wired();
    expect(handlers['game:getStatus']()).toEqual({ status: 'connected', updatedAt: STATUS_AT });
  });

  it('answers not running, stamped with the clock, before the reader is built', () => {
    expect(bare().handlers['game:getStatus']()).toEqual({ status: 'not_running', updatedAt: NOW_ISO });
  });
});

describe('consent', () => {
  it('serves the stored record when a store is behind it', () => {
    const { handlers } = wired();
    expect(handlers['consent:get']()).toEqual(grantedConsent(STATUS_AT));
  });

  it('answers the untouched initial record before the store is built', () => {
    expect(bare().handlers['consent:get']()).toEqual(initialConsent());
  });

  it('stamps an acceptance with the clock and the language the player is reading', async () => {
    const { handlers, f } = wired();
    f.spies.getSettings.mockReturnValue({ ...DEFAULT_SETTINGS, locale: 'en' });
    await handlers['consent:accept']();
    expect(f.spies.applyConsentEvent).toHaveBeenCalledWith({ type: 'accept', now: NOW_ISO, locale: 'en' });
  });

  it('carries the language into a decline, which has no moment to record', async () => {
    const { handlers, f } = wired();
    await handlers['consent:decline']();
    expect(f.spies.applyConsentEvent).toHaveBeenCalledWith({ type: 'decline', locale: DEFAULT_SETTINGS.locale });
  });

  it('revokes without a language, because a revocation says nothing to translate', async () => {
    const { handlers, f } = wired();
    await handlers['consent:revoke']();
    expect(f.spies.applyConsentEvent).toHaveBeenCalledWith({ type: 'revoke' });
  });
});

describe('the live view', () => {
  it('serves the tap view when a source is attached', () => {
    expect(wired().handlers['live:get']()).toBe(LIVE_VIEW);
  });

  it('answers a never-attached gap, stamped with the clock, before the source exists', () => {
    expect(bare().handlers['live:get']()).toEqual({
      currency: liveGap('neverAttached', NOW_ISO),
      field: [],
      recovery: [],
      energies: [],
      rotation: null,
      onFieldHeroIds: [],
      earnings: null,
      map: null,
      updatedAt: NOW_ISO,
    });
  });

  it('writes a diagnostics dump through the source and reports where it landed', () => {
    const { handlers, f } = wired();
    expect(handlers['live:dumpDiagnostics']()).toEqual({ written: true, path: '/dumps/live.json' });
    expect(f.liveSource.dumpDiagnostics).toHaveBeenCalledTimes(1);
  });

  it('refuses a dump with no source rather than writing an empty one', () => {
    expect(bare().handlers['live:dumpDiagnostics']()).toEqual({ written: false, reason: 'no-source' });
  });

  it('zeroes the session earnings on the source and answers nothing', () => {
    const { handlers, f } = wired();
    expect(handlers['live:resetEarnings']()).toBeNull();
    expect(f.liveSource.resetEarnings).toHaveBeenCalledTimes(1);
  });

  it('swallows a reset with no source attached', () => {
    expect(bare().handlers['live:resetEarnings']()).toBeNull();
  });
});

describe('updates', () => {
  it('serves the service status for each of the four verbs once the service exists', async () => {
    const { handlers, f } = wired();
    expect(handlers['updates:get']()).toEqual(updateStatus('idle'));
    expect(await handlers['updates:check']()).toEqual(updateStatus('checking'));
    expect(await handlers['updates:download']()).toEqual(updateStatus('downloading'));
    expect(handlers['updates:installOnRestart']()).toEqual(updateStatus('ready'));
    expect(f.updateService.check).toHaveBeenCalledTimes(1);
    expect(f.updateService.download).toHaveBeenCalledTimes(1);
    expect(f.updateService.installOnRestart).toHaveBeenCalledTimes(1);
  });

  it('never tells an installed build on a channel that its updater is off, before the service exists', async () => {
    const { handlers } = bare(BETA_ENV);
    const answers: UpdateStatus[] = [
      await handlers['updates:get'](),
      await handlers['updates:check'](),
      await handlers['updates:download'](),
      await handlers['updates:installOnRestart'](),
    ];
    for (const answer of answers) {
      expect(answer.phase).not.toBe('disabled');
      expect(answer.currentVersion).toBe('1.2.3');
    }
  });

  it('does say the updater is off for an unpackaged run with no channel, where it truly is', async () => {
    expect((await bare(DEV_ENV).handlers['updates:get']()).phase).toBe('disabled');
  });
});

describe('the market', () => {
  it('serves the snapshot main holds', () => {
    expect(wired().handlers['market:getSnapshot']()).toBe(ADOPTED_SNAPSHOT);
  });

  it('serves an empty snapshot before the market service is built', () => {
    expect(bare().handlers['market:getSnapshot']()).toEqual(emptyMarketSnapshotView());
  });

  it('announces the view a manual check left behind, even when the check found nothing new', async () => {
    const { handlers, f } = wired();
    expect(await handlers['market:check']()).toEqual({ ok: true, view: ADOPTED_SNAPSHOT });
    expect(f.marketService.refreshSnapshot).toHaveBeenCalledTimes(1);
    expect(f.spies.emitMarketChanged).toHaveBeenCalledWith(ADOPTED_SNAPSHOT);
  });

  it('refuses a second check inside thirty seconds without going to the network or announcing', async () => {
    const { handlers, f } = wired();
    await handlers['market:check']();
    f.clock.ms += MARKET_CHECK_FLOOR_MS - 1;
    expect(await handlers['market:check']()).toEqual({ ok: false, reason: 'rate_limited' });
    expect(f.marketService.refreshSnapshot).toHaveBeenCalledTimes(1);
    expect(f.spies.emitMarketChanged).toHaveBeenCalledTimes(1);
  });

  it('lets a check through again once thirty seconds have passed', async () => {
    const { handlers, f } = wired();
    await handlers['market:check']();
    f.clock.ms += MARKET_CHECK_FLOOR_MS;
    expect(await handlers['market:check']()).toEqual({ ok: true, view: ADOPTED_SNAPSHOT });
    expect(f.marketService.refreshSnapshot).toHaveBeenCalledTimes(2);
  });

  it('refuses a check before the market service is built', async () => {
    expect(await bare().handlers['market:check']()).toEqual({ ok: false, reason: 'unavailable' });
  });

  it('re-quotes one item through the service, passing the target the renderer named', async () => {
    const { handlers, f } = wired();
    const result = await handlers['market:refreshItem']({ kind: 'key', key: 'ember-blade' });
    expect(result).toMatchObject({ ok: true, key: 'ember-blade' });
    expect(f.marketService.refreshItem).toHaveBeenCalledWith({ kind: 'key', key: 'ember-blade' });
  });

  it('refuses a malformed target as an unknown item without touching the service', async () => {
    const { dispatch, f } = wired();
    expect(await (dispatch('market:refreshItem', { kind: 'bogus' }) as Promise<unknown>)).toEqual({
      ok: false,
      key: null,
      hashName: null,
      reason: 'unknown-item',
      keptAmount: null,
      at: NOW_ISO,
    });
    expect(f.marketService.refreshItem).not.toHaveBeenCalled();
  });

  it('refuses a well-formed target before the market service is built', async () => {
    const result = await bare().handlers['market:refreshItem']({ kind: 'key', key: 'ember-blade' });
    expect(result).toMatchObject({ ok: false, reason: 'unknown-item' });
  });
});

describe('the forge', () => {
  it('starts a run through the service with the request as sent', () => {
    const { handlers, f } = wired();
    const request = { itemId: 'i1', targetRarity: 3 } as unknown as ForgeStartRequest;
    expect(handlers['forge:start'](request)).toEqual({ ok: true, runId: 'run-7' });
    expect(f.forgeService.start).toHaveBeenCalledWith(request);
  });

  it('refuses a start as unavailable before the forge service is built', () => {
    const request = {} as unknown as ForgeStartRequest;
    expect(bare().handlers['forge:start'](request)).toEqual({ ok: false, reason: 'unavailable' });
  });

  it('reports whether a run with that id was still there to cancel', () => {
    const { handlers, f } = wired();
    expect(handlers['forge:cancel']('run-7')).toBe(true);
    expect(f.forgeService.cancel).toHaveBeenCalledWith('run-7');
    expect(bare().handlers['forge:cancel']('run-7')).toBe(false);
  });

  it('serves the fifty most recent runs', () => {
    const { handlers, f } = wired();
    expect(handlers['forge:history']()).toBe(POPULATED_FORGE_HISTORY);
    expect(f.forgeHistory.list).toHaveBeenCalledWith({ limit: 50 });
  });

  it('serves an empty history before the store is built', () => {
    expect(bare().handlers['forge:history']()).toBe(EMPTY_FORGE_HISTORY);
  });

  it('clears the history and answers with the list as it stands afterwards, not as it was', () => {
    const { handlers, f } = wired();
    expect(handlers['forge:history']()).toBe(POPULATED_FORGE_HISTORY);
    expect(handlers['forge:clearHistory']()).toBe(EMPTY_FORGE_HISTORY);
    expect(f.forgeHistory.clear).toHaveBeenCalledTimes(1);
  });

  it('passes a scripted event sequence to the injector when one is armed', () => {
    const { handlers, f } = wired();
    expect(handlers['forge:inject']([{ type: 'done' }])).toEqual({ ok: true });
    expect(f.forgeInjector.inject).toHaveBeenCalledWith([{ type: 'done' }]);
  });

  it('refuses an injection wherever no injector was built, which is everywhere but a fixture run', () => {
    expect(bare().handlers['forge:inject']([])).toEqual({ ok: false });
  });
});

describe('applying a plan', () => {
  it('starts a run through the service with the request as sent', () => {
    const { handlers, f } = wired();
    const request = { kind: 'equip' } as unknown as ApplyStartRequest;
    expect(handlers['apply:start'](request)).toEqual({ ok: true, runId: 'apply-3' });
    expect(f.applyService.start).toHaveBeenCalledWith(request);
  });

  it('refuses a start as unavailable before the apply service is built', () => {
    expect(bare().handlers['apply:start']({} as unknown as ApplyStartRequest)).toEqual({
      ok: false,
      reason: 'unavailable',
    });
  });

  it('reports whether a run with that id was still active to stop', () => {
    const { handlers, f } = wired();
    expect(handlers['apply:stop']('apply-3')).toBe(true);
    expect(f.applyService.stop).toHaveBeenCalledWith('apply-3');
    expect(bare().handlers['apply:stop']('apply-3')).toBe(false);
  });

  it('arms a scripted run when an injector exists, and refuses when none does', () => {
    const { handlers, f } = wired();
    expect(handlers['apply:inject']({ steps: [] })).toEqual({ ok: true });
    expect(f.applyInjector.arm).toHaveBeenCalledWith({ steps: [] });
    expect(bare().handlers['apply:inject']({ steps: [] })).toEqual({ ok: false });
  });
});

describe('duels', () => {
  it('serves every duel the tap has seen settle', () => {
    const { handlers, f } = wired();
    expect(handlers['pvp:history']()).toBe(EMPTY_PVP_HISTORY);
    expect(f.pvpHistory.list).toHaveBeenCalledTimes(1);
  });

  it('serves an empty duel list before the store is built', () => {
    expect(bare().handlers['pvp:history']()).toBe(EMPTY_PVP_HISTORY);
  });

  it('starts the state and ranking reads through the reader', () => {
    const { handlers, f } = wired();
    expect(handlers['pvp:refresh']()).toEqual({ ok: true });
    expect(f.pvpReader.refresh).toHaveBeenCalledTimes(1);
  });

  it('refuses a refresh as unavailable before the reader is built', () => {
    expect(bare().handlers['pvp:refresh']()).toEqual({ ok: false, reason: 'unavailable' });
  });

  it('answers with nothing, and says nothing, when no film with that id is held', () => {
    const { handlers, f } = wired();
    expect(handlers['pvp:film'](47)).toBeNull();
    expect(f.pvpHistory.readFilm).toHaveBeenCalledWith(47);
    expect(f.spies.warn).not.toHaveBeenCalled();
  });

  it('answers with nothing and warns when a held film body will not parse, rather than throwing', () => {
    const { handlers, f } = wired();
    f.pvpHistory.readFilm.mockReturnValue('}{ not json');
    expect(handlers['pvp:film'](47)).toBeNull();
    expect(f.spies.warn).toHaveBeenCalledWith(
      expect.objectContaining({ scope: 'pvp', event: 'film.unreadable', filmId: 47 }),
    );
  });

  it('answers with nothing and warns when a parsed body is not a film the summary understands', () => {
    const { handlers, f } = wired();
    f.pvpHistory.readFilm.mockReturnValue('{"unexpected":1}');
    expect(handlers['pvp:film'](47)).toBeNull();
    expect(f.spies.warn).toHaveBeenCalledWith({ scope: 'pvp', event: 'film.unreadable', filmId: 47 });
  });

  it('answers with nothing before the store is built', () => {
    expect(bare().handlers['pvp:film'](47)).toBeNull();
  });
});

describe('storage health', () => {
  it('reports the binding the store actually opened', () => {
    expect(wired().handlers['storage:health']()).toEqual({ binding: 'node:sqlite', ok: true });
  });

  it('reports an unknown, unhealthy binding before the store is opened', () => {
    expect(bare().handlers['storage:health']()).toEqual({ binding: 'unknown', ok: false });
  });
});

describe('the clipboard', () => {
  it('decodes a PNG the renderer drew and writes it, reporting the size it wrote', () => {
    const { handlers, f } = wired();
    expect(handlers['clipboard:writeImage'](PNG_BYTES)).toEqual({ ok: true, width: 320, height: 180 });
    expect(f.imageClipboard.writeImage).toHaveBeenCalledTimes(1);
  });

  it('refuses bytes that are not a PNG without decoding or writing anything', () => {
    const { dispatch, f } = wired();
    expect(dispatch('clipboard:writeImage', new Uint8Array([1, 2, 3]))).toEqual({
      ok: false,
      reason: 'not-an-image',
    });
    expect(f.imageClipboard.decodePng).not.toHaveBeenCalled();
    expect(f.imageClipboard.writeImage).not.toHaveBeenCalled();
  });
});

describe('the dispatcher the bridge calls', () => {
  it('refuses a channel the contract does not publish, naming it', () => {
    const { dispatch } = wired();
    expect(() => dispatch('bfc:definitelyNot')).toThrow('Unknown IPC channel: bfc:definitelyNot');
  });

  it('forwards the arguments the renderer sent to the handler that owns the channel', () => {
    const { dispatch, f } = wired();
    dispatch('forge:cancel', 'run-7');
    expect(f.forgeService.cancel).toHaveBeenCalledWith('run-7');
  });

  it('returns what the handler returned, unwrapped', () => {
    const { dispatch } = wired();
    expect(dispatch('app:ping')).toEqual({ ok: true, from: 'main' });
  });
});

describe('the handler table against the published channel list', () => {
  it('holds exactly the channels the contract publishes, naming any that differ on either side', () => {
    const table = new Set(Object.keys(wired().handlers));
    const published = new Set<string>(IPC_CHANNELS);
    expect({
      publishedWithNoHandler: [...published].filter((channel) => !table.has(channel)).sort(),
      handledButNotPublished: [...table].filter((channel) => !published.has(channel)).sort(),
    }).toEqual({ publishedWithNoHandler: [], handledButNotPublished: [] });
  });

  it('still carries at least the fifty-one channels both sides carried when this floor was set', () => {
    expect(Object.keys(wired().handlers).length).toBeGreaterThanOrEqual(51);
    expect(IPC_CHANNELS.length).toBeGreaterThanOrEqual(51);
  });
});

describe('the pre-boot nulls', () => {
  it('reads every service through its getter, so a table built before boot still sees what boot assigned', () => {
    let storage: Fakes['storage'] | null = null;
    const base = bare().deps;
    const handlers = createIpcHandlers({ ...base, getStorage: () => storage });
    expect(handlers['storage:health']()).toEqual({ binding: 'unknown', ok: false });
    storage = fakes().storage;
    expect(handlers['storage:health']()).toEqual({ binding: 'node:sqlite', ok: true });
  });
});
