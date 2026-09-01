import type { BrowserWindowConstructorOptions } from 'electron';
import { RENDERER_HOST, RENDERER_SCHEME } from './renderer-protocol.js';

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
