import { describe, expect, it, vi } from 'vitest';
import {
  MINI_LIVE_PACKAGED_URL,
  buildMiniLiveWindowOptions,
  createMiniLiveBrowserWindow,
  resolveMiniLiveLoadUrl,
} from './mini-live-window.js';

const PRELOAD = 'C:\\app\\preload\\index.cjs';
const ICON = 'C:\\app\\assets\\icon.ico';

describe('resolveMiniLiveLoadUrl', () => {
  it('uses the dev server path in development', () => {
    expect(resolveMiniLiveLoadUrl({ isDev: true, devBaseUrl: 'http://127.0.0.1:3000' })).toBe(
      'http://127.0.0.1:3000/mini-live/',
    );
  });

  it('uses the packaged app protocol URL in production', () => {
    expect(resolveMiniLiveLoadUrl({ isDev: false, devBaseUrl: 'http://127.0.0.1:3000' })).toBe(
      MINI_LIVE_PACKAGED_URL,
    );
  });

  it('keeps dev and packaged URLs distinct', () => {
    const dev = resolveMiniLiveLoadUrl({ isDev: true, devBaseUrl: 'http://127.0.0.1:3000' });
    const packaged = resolveMiniLiveLoadUrl({ isDev: false, devBaseUrl: 'http://127.0.0.1:3000' });
    expect(dev).not.toBe(packaged);
  });
});

describe('buildMiniLiveWindowOptions', () => {
  it('builds a frameless opaque resizable window with matching preload and icon', () => {
    const options = buildMiniLiveWindowOptions({
      preloadPath: PRELOAD,
      iconPath: ICON,
      x: 100,
      y: 80,
      width: 360,
      height: 240,
    });

    expect(options.frame).toBe(false);
    expect(options.transparent).not.toBe(true);
    expect(options.resizable).toBe(true);
    expect(options.webPreferences?.preload).toBe(PRELOAD);
    expect(options.webPreferences?.contextIsolation).toBe(true);
    expect(options.webPreferences?.nodeIntegration).toBe(false);
    expect(options.icon).toBe(ICON);
    expect(options.backgroundColor).toBe('#17100c');
    expect(options.minWidth).toBe(320);
    expect(options.minHeight).toBe(88);
  });
});

describe('createMiniLiveBrowserWindow', () => {
  it('does not call setIgnoreMouseEvents on the factory path', () => {
    const setIgnoreMouseEvents = vi.fn();
    const instances: Array<Record<string, unknown>> = [];

    class FakeBrowserWindow {
      webContents = {
        loadURL: vi.fn(() => Promise.resolve()),
        on: vi.fn(),
      };

      constructor(public options: unknown) {
        instances.push(this);
      }

      show = vi.fn();
      focus = vi.fn();
      destroy = vi.fn();
      isDestroyed = vi.fn(() => false);
      setAlwaysOnTop = vi.fn();
      setBounds = vi.fn();
      getBounds = vi.fn(() => ({ x: 0, y: 0, width: 320, height: 200 }));
      on = vi.fn();
      setIgnoreMouseEvents = setIgnoreMouseEvents;
    }

    createMiniLiveBrowserWindow(FakeBrowserWindow as never, {
      preloadPath: PRELOAD,
      iconPath: ICON,
      x: 0,
      y: 0,
      width: 320,
      height: 200,
      loadUrl: 'http://127.0.0.1:3000/mini-live/',
    });

    expect(setIgnoreMouseEvents).not.toHaveBeenCalled();
    expect(instances).toHaveLength(1);
    expect((instances[0] as { options: { frame: boolean } }).options.frame).toBe(false);
  });
});
