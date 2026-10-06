import {
  DEFAULT_MINI_LAYOUT_VIEW,
  parseMiniLiveLayoutPatch,
  type WindowLayoutStore,
} from './game-api/window-layout-store.js';
import { writeClipboardImage, type ImageClipboard } from './shell/clipboard-image.js';
import type { AppEnv } from './env.js';
import {
  EMPTY_COLLECTIONS_VIEW,
  EMPTY_FORGE_HISTORY,
  EMPTY_PVP_HISTORY,
  emptyMarketSnapshotView,
  emptyOnlinePlayersView,
  initialUpdateStatus,
  isIpcChannel,
  isMarketQuoteTarget,
  liveGap,
  type AccountReadResult,
  type AccountSource,
  type AccountView,
  type AppLocale,
  type AppSettings,
  type ApplyStartRequest,
  type ApplyStartResult,
  type CollectionsView,
  type ConsentRecord,
  type DeconstructStartRequest,
  type DeconstructStartResult,
  type ForgeHistoryResult,
  type ForgeStartRequest,
  type ForgeStartResult,
  type GameStatusInfo,
  type IpcInvokeArgs,
  type IpcInvokeChannel,
  type IpcInvokeResult,
  type LiveDiagnosticsDumpOutcome,
  type LiveView,
  type MarketCheckResult,
  type MarketQuoteResult,
  type MarketQuoteTarget,
  type MarketSnapshotView,
  type OnlinePlayersView,
  type MiniLiveLayoutView,
  type PvpFilmView,
  type PvpHistoryResult,
  type SettingsWriteResult,
  type UpdateStatus,
  type WindowStateView,
} from '@bombfarm/contracts';
import { initialConsent, summarizePvpFilm, type ConsentEvent } from '@bombfarm/game-api';

export type IpcHandlers = {
  [C in IpcInvokeChannel]: (...args: IpcInvokeArgs<C>) => IpcInvokeResult<C> | Promise<IpcInvokeResult<C>>;
};

export interface StoragePort {
  healthCheck(): { binding: string; ok: boolean };
}

export interface GameReaderPort {
  getStatus(): GameStatusInfo;
}

export interface ConsentStorePort {
  read(): ConsentRecord;
}

export interface LiveSourcePort {
  getView(): LiveView;
  dumpDiagnostics(): LiveDiagnosticsDumpOutcome;
  resetEarnings(): void;
}

export interface UpdateServicePort {
  getStatus(): UpdateStatus;
  check(): Promise<UpdateStatus>;
  download(): Promise<UpdateStatus>;
  installOnRestart(): UpdateStatus;
}

export interface OnlinePlayersServicePort {
  getView(): OnlinePlayersView;
}

export interface MarketServicePort {
  getView(): MarketSnapshotView;
  refreshSnapshot(): Promise<MarketSnapshotView>;
  refreshItem(target: MarketQuoteTarget): Promise<MarketQuoteResult>;
}

export interface ForgeServicePort {
  start(request: ForgeStartRequest): ForgeStartResult;
  cancel(runId: string): boolean;
}

export interface ForgeHistoryPort {
  list(opts: { limit: number }): ForgeHistoryResult;
  clear(): void;
}

export interface InjectorPort {
  inject(events: unknown): { ok: boolean };
}

export interface ApplyServicePort {
  start(request: ApplyStartRequest): ApplyStartResult;
  stop(runId: string): boolean;
}

export interface ApplyInjectorPort {
  arm(payload: unknown): { ok: boolean };
}

export interface DeconstructServicePort {
  start(request: DeconstructStartRequest): DeconstructStartResult;
}

export interface PvpHistoryPort {
  list(): PvpHistoryResult;
  readFilm(filmId: number): string | null;
}

export interface PvpReaderPort {
  refresh(): AccountReadResult;
}

export interface CollectionsStorePort {
  view(): CollectionsView;
}

export interface CollectionsReaderPort {
  refresh(): AccountReadResult;
}

/** The caption buttons' view of the main window: `BrowserWindow` satisfies it structurally, and
 *  nothing here needs the rest of it. */
export interface MainWindowPort {
  isDestroyed(): boolean;
  isMaximized(): boolean;
  maximize(): void;
  unmaximize(): void;
  minimize(): void;
  close(): void;
}

export interface MiniLiveControllerPort {
  open(): void;
  close(): void;
  fitGrowthAxis(content: { width: number; height: number }): void;
}

export type WindowLayoutStorePort = Pick<WindowLayoutStore, 'getLayout' | 'setLayout'>;

export type ClipboardImageLike = {
  isEmpty(): boolean;
  getSize(): { width: number; height: number };
};

/**
 * Every service arrives as a getter, never as a captured value: the table is built once and the
 * services it reaches are assigned later, so a value captured here would freeze the `null` that
 * stands in before boot finishes.
 */
export interface IpcHandlerDeps<Image extends ClipboardImageLike = ClipboardImageLike> {
  now: () => number;
  warn: (record: Record<string, unknown>) => void;

  resolveEnv: () => AppEnv;
  appVersion: () => string;
  appIsPackaged: () => boolean;

  getStorage: () => StoragePort | null;
  getGameReader: () => GameReaderPort | null;
  getConsentStore: () => ConsentStorePort | null;
  getLiveSource: () => LiveSourcePort | null;
  getUpdateService: () => UpdateServicePort | null;
  getMarketService: () => MarketServicePort | null;
  getOnlinePlayersService: () => OnlinePlayersServicePort | null;
  getForgeService: () => ForgeServicePort | null;
  getForgeHistory: () => ForgeHistoryPort | null;
  getForgeInjector: () => InjectorPort | null;
  getApplyService: () => ApplyServicePort | null;
  getApplyInjector: () => ApplyInjectorPort | null;
  getDeconstructService: () => DeconstructServicePort | null;
  getDeconstructInjector: () => InjectorPort | null;
  getPvpHistory: () => PvpHistoryPort | null;
  getPvpReader: () => PvpReaderPort | null;
  getCollectionsStore: () => CollectionsStorePort | null;
  getCollectionsReader: () => CollectionsReaderPort | null;
  getMainWindow: () => MainWindowPort | null;
  getMiniLiveController: () => MiniLiveControllerPort | null;
  getWindowLayoutStore: () => WindowLayoutStorePort | null;

  getSettings: () => AppSettings;
  accountSource: () => AccountSource;
  isMiniAvailable: () => boolean;
  getAccountView: () => AccountView;
  requestAccountReadNow: () => AccountReadResult;
  applyConsentEvent: (event: ConsentEvent) => Promise<ConsentRecord>;
  emitMarketChanged: (view: MarketSnapshotView) => void;

  applyLocale: (next: AppLocale) => SettingsWriteResult;
  applyAlwaysOnTopMain: (enabled: unknown) => SettingsWriteResult;
  applyAlwaysOnTopMini: (enabled: unknown) => SettingsWriteResult;
  applyForgeWritesEnabled: (enabled: unknown) => SettingsWriteResult;
  applyRestartGameOnExit: (enabled: unknown) => SettingsWriteResult;
  applyUsagePingEnabled: (enabled: unknown) => SettingsWriteResult;
  applyMarketQuoteCurrency: (next: unknown) => SettingsWriteResult;

  imageClipboard: ImageClipboard<Image>;
}

export function defaultLiveView(nowIso: string): LiveView {
  return {
    currency: liveGap('neverAttached', nowIso),
    field: [],
    recovery: [],
    energies: [],
    rotation: null,
    onFieldHeroIds: [],
    earnings: null,
    map: null,
    updatedAt: nowIso,
  };
}

/** A manual check is the clock's own conditional request, taken early. The floor keeps a held
 *  button from becoming a stream of them: below the five-minute `max-age` the published file is
 *  served with, a second check could not see anything newer anyway. */
export const MARKET_CHECK_FLOOR_MS = 30_000;

export function createIpcHandlers<Image extends ClipboardImageLike>(
  deps: IpcHandlerDeps<Image>,
): IpcHandlers {
  let lastMarketCheckAt = 0;

  function nowIso(): string {
    return new Date(deps.now()).toISOString();
  }

  function listForgeHistory(): ForgeHistoryResult {
    return deps.getForgeHistory()?.list({ limit: 50 }) ?? EMPTY_FORGE_HISTORY;
  }

  function readPvpFilm(filmId: number): PvpFilmView | null {
    const body = deps.getPvpHistory()?.readFilm(filmId) ?? null;
    if (body === null) return null;
    try {
      const view = summarizePvpFilm(JSON.parse(body));
      if (view === null) deps.warn({ scope: 'pvp', event: 'film.unreadable', filmId });
      return view;
    } catch (err) {
      deps.warn({ scope: 'pvp', event: 'film.unreadable', filmId, error: String(err) });
      return null;
    }
  }

  async function checkMarketNow(): Promise<MarketCheckResult> {
    const marketService = deps.getMarketService();
    if (marketService === null) return { ok: false, reason: 'unavailable' };
    const now = deps.now();
    if (now - lastMarketCheckAt < MARKET_CHECK_FLOOR_MS) return { ok: false, reason: 'rate_limited' };
    lastMarketCheckAt = now;
    const view = await marketService.refreshSnapshot();
    // A check that found nothing new adopts nothing and so announces nothing on its own; the press
    // still moved the checked-at clock, and every window showing it should see that.
    deps.emitMarketChanged(view);
    return { ok: true, view };
  }

  function refreshMarketItem(target: MarketQuoteTarget): Promise<MarketQuoteResult> {
    const marketService = deps.getMarketService();
    if (!isMarketQuoteTarget(target) || marketService === null) {
      return Promise.resolve({
        ok: false,
        key: null,
        hashName: null,
        reason: 'unknown-item',
        keptAmount: null,
        at: nowIso(),
      });
    }
    return marketService.refreshItem(target);
  }

  /**
   * The update service is built after the window opens, so the renderer's one `updates:get` on
   * mount regularly lands before it exists. What that gap answers has to be what the built service
   * will answer, because the Updates section greys out its own check button on `disabled` and
   * nothing re-reads until the first scheduled check half a minute later — a `disabled` here told
   * installed players their build never updates, for thirty seconds, with no control to correct it.
   */
  function preServiceUpdateStatus(): UpdateStatus {
    return initialUpdateStatus({
      currentVersion: deps.appVersion(),
      channel: deps.resolveEnv().descriptor.updateChannel,
      isPackaged: deps.appIsPackaged(),
    });
  }

  return {
    'app:getFlavor': () => deps.resolveEnv().flavor,
    'app:getEnvironment': () => {
      const env = deps.resolveEnv();
      return {
        flavor: env.flavor,
        productName: env.productName,
        badgeLabel: env.descriptor.badgeLabel,
        updateChannel: env.descriptor.updateChannel,
        isPackaged: env.isPackaged,
        version: deps.appVersion(),
        accountSource: deps.accountSource(),
      };
    },
    'app:ping': () => ({ ok: true as const, from: 'main' as const }),
    'settings:get': (): AppSettings => deps.getSettings(),
    'settings:useEnglish': (): SettingsWriteResult => deps.applyLocale('en'),
    'settings:usePortuguese': (): SettingsWriteResult => deps.applyLocale('pt-BR'),
    'settings:setAlwaysOnTopMain': (enabled: boolean): SettingsWriteResult => deps.applyAlwaysOnTopMain(enabled),
    'settings:setAlwaysOnTopMini': (enabled: boolean): SettingsWriteResult => deps.applyAlwaysOnTopMini(enabled),
    'settings:setForgeWritesEnabled': (enabled: boolean): SettingsWriteResult =>
      deps.applyForgeWritesEnabled(enabled),
    'settings:setRestartGameOnExit': (enabled: boolean): SettingsWriteResult =>
      deps.applyRestartGameOnExit(enabled),
    'settings:setMarketQuoteCurrency': (currency): SettingsWriteResult => deps.applyMarketQuoteCurrency(currency),
    'settings:setUsagePingEnabled': (enabled: boolean): SettingsWriteResult => deps.applyUsagePingEnabled(enabled),
    'storage:health': () => deps.getStorage()?.healthCheck() ?? { binding: 'unknown', ok: false },
    'game:getStatus': () =>
      deps.getGameReader()?.getStatus() ?? {
        status: 'not_running' as const,
        updatedAt: nowIso(),
      },
    'account:get': (): AccountView => deps.getAccountView(),
    'account:readNow': (): AccountReadResult => deps.requestAccountReadNow(),
    'consent:get': (): ConsentRecord => deps.getConsentStore()?.read() ?? initialConsent(),
    'consent:accept': (): Promise<ConsentRecord> =>
      deps.applyConsentEvent({ type: 'accept', now: nowIso(), locale: deps.getSettings().locale }),
    'consent:decline': (): Promise<ConsentRecord> =>
      deps.applyConsentEvent({ type: 'decline', locale: deps.getSettings().locale }),
    'consent:revoke': (): Promise<ConsentRecord> => deps.applyConsentEvent({ type: 'revoke' }),
    'live:get': (): LiveView => deps.getLiveSource()?.getView() ?? defaultLiveView(nowIso()),
    'live:dumpDiagnostics': (): LiveDiagnosticsDumpOutcome =>
      deps.getLiveSource()?.dumpDiagnostics() ?? { written: false, reason: 'no-source' },
    'live:resetEarnings': (): null => {
      deps.getLiveSource()?.resetEarnings();
      return null;
    },
    'updates:get': (): UpdateStatus => deps.getUpdateService()?.getStatus() ?? preServiceUpdateStatus(),
    'updates:check': (): Promise<UpdateStatus> | UpdateStatus =>
      deps.getUpdateService()?.check() ?? preServiceUpdateStatus(),
    'updates:download': (): Promise<UpdateStatus> | UpdateStatus =>
      deps.getUpdateService()?.download() ?? preServiceUpdateStatus(),
    'updates:installOnRestart': (): UpdateStatus =>
      deps.getUpdateService()?.installOnRestart() ?? preServiceUpdateStatus(),
    'market:getSnapshot': () => deps.getMarketService()?.getView() ?? emptyMarketSnapshotView(),
    'onlinePlayers:get': () => deps.getOnlinePlayersService()?.getView() ?? emptyOnlinePlayersView,
    'market:refreshItem': refreshMarketItem,
    'market:check': checkMarketNow,
    'forge:start': (request: ForgeStartRequest): ForgeStartResult =>
      deps.getForgeService()?.start(request) ?? { ok: false, reason: 'unavailable' },
    'forge:cancel': (runId: string) => deps.getForgeService()?.cancel(runId) ?? false,
    'forge:history': listForgeHistory,
    'forge:clearHistory': () => {
      deps.getForgeHistory()?.clear();
      return listForgeHistory();
    },
    'forge:inject': (events: unknown) => deps.getForgeInjector()?.inject(events) ?? { ok: false },
    'apply:start': (request: ApplyStartRequest): ApplyStartResult =>
      deps.getApplyService()?.start(request) ?? { ok: false, reason: 'unavailable' },
    'apply:stop': (runId: string): boolean => deps.getApplyService()?.stop(runId) ?? false,
    'apply:inject': (payload: unknown) => deps.getApplyInjector()?.arm(payload) ?? { ok: false },
    'deconstruct:start': (request: DeconstructStartRequest): DeconstructStartResult =>
      deps.getDeconstructService()?.start(request) ?? { ok: false, reason: 'unavailable' },
    'deconstruct:inject': (payload: unknown) => deps.getDeconstructInjector()?.inject(payload) ?? { ok: false },
    'pvp:history': (): PvpHistoryResult => deps.getPvpHistory()?.list() ?? EMPTY_PVP_HISTORY,
    'pvp:refresh': (): AccountReadResult => deps.getPvpReader()?.refresh() ?? { ok: false, reason: 'unavailable' },
    'pvp:film': readPvpFilm,
    'collections:get': (): CollectionsView => deps.getCollectionsStore()?.view() ?? EMPTY_COLLECTIONS_VIEW,
    'collections:refresh': (): AccountReadResult =>
      deps.getCollectionsReader()?.refresh() ?? { ok: false, reason: 'unavailable' },
    'window:minimize': () => {
      deps.getMainWindow()?.minimize();
      return null;
    },
    'window:toggleMaximize': (): WindowStateView => {
      const window = deps.getMainWindow();
      if (!window || window.isDestroyed()) {
        return { maximized: false };
      }
      if (window.isMaximized()) {
        window.unmaximize();
      } else {
        window.maximize();
      }
      return { maximized: window.isMaximized() };
    },
    // `close()`, never `destroy()` or `app.quit()`: what a close means is the shell lifecycle's
    // decision, and on Windows with a tray present it hides the window instead of ending the
    // process. A caption button that quit outright would be a second, contradictory answer.
    'window:close': () => {
      deps.getMainWindow()?.close();
      return null;
    },
    'window:getState': (): WindowStateView => ({
      maximized: deps.getMainWindow()?.isMaximized() ?? false,
    }),
    'miniLive:open': () => {
      if (deps.isMiniAvailable()) {
        deps.getMiniLiveController()?.open();
      }
      return null;
    },
    'miniLive:close': () => {
      deps.getMiniLiveController()?.close();
      return null;
    },
    'miniLive:getLayout': (): MiniLiveLayoutView =>
      deps.getWindowLayoutStore()?.getLayout() ?? DEFAULT_MINI_LAYOUT_VIEW,
    'miniLive:setLayout': (patch): MiniLiveLayoutView => {
      const store = deps.getWindowLayoutStore();
      const validPatch = parseMiniLiveLayoutPatch(patch);
      if (!validPatch || !store) {
        return store?.getLayout() ?? DEFAULT_MINI_LAYOUT_VIEW;
      }
      return store.setLayout(validPatch);
    },
    'miniLive:fitGrowthAxis': (content) => {
      deps.getMiniLiveController()?.fitGrowthAxis(content);
      return null;
    },
    'clipboard:writeImage': (bytes: unknown) => writeClipboardImage(bytes, deps.imageClipboard),
  };
}

export function createIpcDispatch(handlers: IpcHandlers): (channel: string, ...args: unknown[]) => unknown {
  return (channel: string, ...args: unknown[]): unknown => {
    if (!isIpcChannel(channel)) {
      throw new Error(`Unknown IPC channel: ${channel}`);
    }
    const handler = handlers[channel] as (...forwarded: unknown[]) => unknown;
    return handler(...args);
  };
}
