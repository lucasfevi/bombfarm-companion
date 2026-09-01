import type { BrowserWindowConstructorOptions } from 'electron';
import type { WindowLayoutStore } from './game-api/window-layout-store.js';
import { RENDERER_HOST, RENDERER_SCHEME } from './renderer-protocol.js';
import {
  clampMiniToWorkArea,
  fitMiniGrowthAxis,
  type MiniLiveLayoutStored,
  type WorkArea,
  type WindowLayoutDocument,
} from './shell/window-layout.js';

export const MIN_MINI_WIDTH = 320;
export const MIN_MINI_HEIGHT = 88;
export const DEFAULT_MINI_WIDTH = 320;
export const DEFAULT_MINI_HEIGHT = 200;
export const MINI_LIVE_PACKAGED_URL = `${RENDERER_SCHEME}://${RENDERER_HOST}/mini-live/index.html`;

export function resolveMiniLiveLoadUrl(input: { isDev: boolean; devBaseUrl: string }): string {
  return input.isDev ? `${input.devBaseUrl}/mini-live/` : MINI_LIVE_PACKAGED_URL;
}

export function buildMiniLiveWindowOptions(input: {
  preloadPath: string;
  iconPath: string;
  x: number;
  y: number;
  width: number;
  height: number;
}): BrowserWindowConstructorOptions {
  return {
    x: input.x,
    y: input.y,
    width: input.width,
    height: input.height,
    minWidth: MIN_MINI_WIDTH,
    minHeight: MIN_MINI_HEIGHT,
    frame: false,
    transparent: false,
    resizable: true,
    skipTaskbar: false,
    show: false,
    backgroundColor: '#17100c',
    icon: input.iconPath,
    webPreferences: {
      preload: input.preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  };
}

export interface MiniLiveWebContents {
  loadURL(url: string): Promise<void>;
  on(event: string, listener: (...args: unknown[]) => void): void;
}

export interface MiniLiveWindowLike {
  show(): void;
  focus(): void;
  destroy(): void;
  isDestroyed(): boolean;
  setAlwaysOnTop(on: boolean, level?: string): void;
  setBounds(bounds: { x: number; y: number; width: number; height: number }): void;
  getBounds(): { x: number; y: number; width: number; height: number };
  on(event: string, listener: (...args: unknown[]) => void): void;
  webContents: MiniLiveWebContents;
}

export function createMiniLiveBrowserWindow(
  BrowserWindowCtor: new (options: BrowserWindowConstructorOptions) => MiniLiveWindowLike,
  input: {
    preloadPath: string;
    iconPath: string;
    x: number;
    y: number;
    width: number;
    height: number;
    loadUrl: string;
    applyExternalNavigation?: (webContents: MiniLiveWebContents) => void;
    log?: { info: (rec: Record<string, unknown>) => void; error: (rec: Record<string, unknown>) => void };
  },
): MiniLiveWindowLike {
  const win = new BrowserWindowCtor(
    buildMiniLiveWindowOptions({
      preloadPath: input.preloadPath,
      iconPath: input.iconPath,
      x: input.x,
      y: input.y,
      width: input.width,
      height: input.height,
    }),
  );

  input.applyExternalNavigation?.(win.webContents);

  const reveal = (): void => {
    if (win.isDestroyed()) {
      return;
    }
    win.show();
    win.focus();
  };

  win.on('ready-to-show', reveal);
  win.webContents.on('did-finish-load', () => {
    input.log?.info({ scope: 'main', event: 'mini.renderer.loaded' });
    reveal();
  });
  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    input.log?.error({
      scope: 'main',
      event: 'mini.renderer.load_failed',
      errorCode,
      errorDescription,
      validatedURL,
    });
    reveal();
  });

  input.log?.info({ scope: 'main', event: 'mini.renderer.load_url', url: input.loadUrl });
  void win.webContents.loadURL(input.loadUrl);

  return win;
}

export interface DisplayInfo {
  readonly id: number;
  readonly workArea: WorkArea;
}

export function applyMiniAlwaysOnTop(win: MiniLiveWindowLike, enabled: boolean): void {
  if (win.isDestroyed()) {
    return;
  }
  win.setAlwaysOnTop(enabled, 'screen-saver');
}

function defaultMiniStored(mainDisplayId: number): MiniLiveLayoutStored {
  return {
    bounds: {
      displayId: mainDisplayId,
      x: 0,
      y: 0,
      width: DEFAULT_MINI_WIDTH,
      height: DEFAULT_MINI_HEIGHT,
    },
    showEarnings: true,
    showMap: true,
    showHeroes: false,
    axis: 'vertical',
    wasOpen: false,
  };
}

function resolveMiniOpenBounds(
  doc: WindowLayoutDocument | null,
  displays: readonly DisplayInfo[],
  primaryWorkArea: WorkArea,
): { x: number; y: number; width: number; height: number } {
  const storedBounds = doc?.mini?.bounds ?? null;
  const clamped = clampMiniToWorkArea({
    stored: storedBounds,
    displays,
    primaryWorkArea,
    minWidth: MIN_MINI_WIDTH,
    minHeight: MIN_MINI_HEIGHT,
    defaultWidth: DEFAULT_MINI_WIDTH,
    defaultHeight: DEFAULT_MINI_HEIGHT,
  });
  return clamped.bounds;
}

function writeMiniWasOpen(store: WindowLayoutStore, wasOpen: boolean): void {
  const doc = store.read();
  if (!doc) {
    return;
  }
  const mainDisplayId = doc.main.displayId;
  const mini = doc.mini ?? defaultMiniStored(mainDisplayId);
  store.write({ schemaVersion: 1, main: doc.main, mini: { ...mini, wasOpen } });
}

function writeMiniBounds(
  store: WindowLayoutStore,
  absoluteBounds: { x: number; y: number; width: number; height: number },
  displayId: number,
  workArea: WorkArea,
): void {
  const doc = store.read();
  if (!doc) {
    return;
  }
  const mini = doc.mini ?? defaultMiniStored(doc.main.displayId);
  store.write({
    schemaVersion: 1,
    main: doc.main,
    mini: {
      ...mini,
      bounds: {
        displayId,
        x: absoluteBounds.x - workArea.x,
        y: absoluteBounds.y - workArea.y,
        width: absoluteBounds.width,
        height: absoluteBounds.height,
      },
    },
  });
}

export interface MiniLiveController {
  open(): void;
  close(): void;
  restoreIfWasOpen(): void;
  applyAlwaysOnTop(enabled: boolean, level: 'screen-saver'): void;
  fitGrowthAxis(content: { width: number; height: number }): void;
  getWindow(): MiniLiveWindowLike | null;
}

export function createMiniLiveController(deps: {
  BrowserWindowCtor: new (options: BrowserWindowConstructorOptions) => MiniLiveWindowLike;
  layoutStore: WindowLayoutStore;
  resolveLoadUrl: () => string;
  preloadPath: string;
  iconPath: string;
  applyExternalNavigation: (webContents: MiniLiveWebContents) => void;
  getDisplays: () => readonly DisplayInfo[];
  getPrimaryWorkArea: () => WorkArea;
  getDisplayForBounds: (bounds: { x: number; y: number; width: number; height: number }) => DisplayInfo;
  getAlwaysOnTopMini: () => boolean;
  schedulePersist?: (callback: () => void, immediate: boolean) => void;
  log?: { info: (rec: Record<string, unknown>) => void; error: (rec: Record<string, unknown>) => void };
}): MiniLiveController {
  let miniWindow: MiniLiveWindowLike | null = null;

  const persistBounds = (immediate: boolean): void => {
    const write = (): void => {
      if (!miniWindow || miniWindow.isDestroyed()) {
        return;
      }
      const bounds = miniWindow.getBounds();
      const display = deps.getDisplayForBounds(bounds);
      writeMiniBounds(deps.layoutStore, bounds, display.id, display.workArea);
    };

    if (deps.schedulePersist) {
      deps.schedulePersist(write, immediate);
      return;
    }
    write();
  };

  const attachLayoutPersistence = (win: MiniLiveWindowLike): void => {
    win.on('move', () => {
      persistBounds(false);
    });
    win.on('resize', () => {
      persistBounds(false);
    });
  };

  const focusOrCreate = (): void => {
    if (miniWindow && !miniWindow.isDestroyed()) {
      miniWindow.focus();
      return;
    }

    const displays = deps.getDisplays();
    const primaryWorkArea = deps.getPrimaryWorkArea();
    const doc = deps.layoutStore.read();
    const bounds = resolveMiniOpenBounds(doc, displays, primaryWorkArea);

    miniWindow = createMiniLiveBrowserWindow(deps.BrowserWindowCtor, {
      preloadPath: deps.preloadPath,
      iconPath: deps.iconPath,
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      loadUrl: deps.resolveLoadUrl(),
      applyExternalNavigation: deps.applyExternalNavigation,
      log: deps.log,
    });

    applyMiniAlwaysOnTop(miniWindow, deps.getAlwaysOnTopMini());
    attachLayoutPersistence(miniWindow);
    writeMiniWasOpen(deps.layoutStore, true);
    deps.log?.info({ scope: 'main', event: 'mini.opened' });
  };

  return {
    open() {
      focusOrCreate();
    },
    close() {
      if (!miniWindow || miniWindow.isDestroyed()) {
        writeMiniWasOpen(deps.layoutStore, false);
        return;
      }
      miniWindow.destroy();
      miniWindow = null;
      writeMiniWasOpen(deps.layoutStore, false);
      deps.log?.info({ scope: 'main', event: 'mini.closed' });
    },
    restoreIfWasOpen() {
      const doc = deps.layoutStore.read();
      if (doc?.mini?.wasOpen !== true) {
        return;
      }
      focusOrCreate();
    },
    applyAlwaysOnTop(enabled) {
      const win = miniWindow && !miniWindow.isDestroyed() ? miniWindow : null;
      if (!win) {
        return;
      }
      applyMiniAlwaysOnTop(win, enabled);
    },
    fitGrowthAxis(content) {
      const win = miniWindow && !miniWindow.isDestroyed() ? miniWindow : null;
      if (!win) {
        return;
      }
      const layout = deps.layoutStore.getLayout();
      const current = win.getBounds();
      const display = deps.getDisplayForBounds(current);
      const next = fitMiniGrowthAxis({
        currentBounds: { width: current.width, height: current.height },
        content,
        axis: layout.axis,
        workArea: display.workArea,
        minWidth: MIN_MINI_WIDTH,
        minHeight: MIN_MINI_HEIGHT,
        position: { x: current.x, y: current.y },
      });
      win.setBounds(next);
      writeMiniBounds(deps.layoutStore, next, display.id, display.workArea);
    },
    getWindow() {
      return miniWindow && !miniWindow.isDestroyed() ? miniWindow : null;
    },
  };
}
