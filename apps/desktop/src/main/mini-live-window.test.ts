import { describe, expect, it, vi } from 'vitest';
import type { WindowLayoutStore } from './game-api/window-layout-store.js';
import type { WindowLayoutDocument } from './shell/window-layout.js';
import {
  MINI_LIVE_PACKAGED_URL,
  buildMiniLiveWindowOptions,
  createMiniLiveBrowserWindow,
  createMiniLiveController,
  applyMiniAlwaysOnTop,
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
    const instances: Array<{ options: unknown }> = [];

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

    createMiniLiveBrowserWindow(FakeBrowserWindow, {
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

function createLayoutStore(doc: WindowLayoutDocument | null): WindowLayoutStore {
  let current = doc;
  return {
    read: () => current,
    write: (next) => {
      current = next;
      return { persisted: true };
    },
    writeMain: (main) => {
      current = current?.mini ? { schemaVersion: 1, main, mini: current.mini } : { schemaVersion: 1, main };
      return { persisted: true };
    },
    getLayout: () => ({
      showEarnings: true,
      showMap: true,
      showHeroes: false,
      axis: 'vertical' as const,
    }),
    setLayout: (patch) => patch,
  };
}

function createFakeBrowserWindowCtor() {
  let constructCount = 0;
  const instances: FakeBrowserWindow[] = [];

  class FakeBrowserWindow {
    webContents = {
      loadURL: vi.fn(() => Promise.resolve()),
      on: vi.fn(),
    };

    focus = vi.fn();
    destroy = vi.fn();
    isDestroyed = vi.fn(() => false);
    show = vi.fn();
    setAlwaysOnTop = vi.fn();
    setBounds = vi.fn();
    getBounds = vi.fn(() => ({ x: 0, y: 0, width: 320, height: 200 }));
    on = vi.fn();

    constructor(public options: unknown) {
      constructCount += 1;
      instances.push(this);
    }
  }

  return {
    Ctor: FakeBrowserWindow as never,
    get constructCount() {
      return constructCount;
    },
    get lastInstance() {
      return instances.at(-1);
    },
  };
}

const PRIMARY_WORK_AREA = { x: 0, y: 0, width: 1920, height: 1080 };
const DEFAULT_DISPLAY = { id: 1, workArea: PRIMARY_WORK_AREA };

const MAIN_ONLY_DOC: WindowLayoutDocument = {
  schemaVersion: 1,
  main: {
    displayId: 1,
    x: 100,
    y: 80,
    width: 1280,
    height: 800,
    isMaximized: false,
  },
};

function controllerDeps(overrides: Partial<Parameters<typeof createMiniLiveController>[0]> = {}) {
  return {
    BrowserWindowCtor: createFakeBrowserWindowCtor().Ctor,
    layoutStore: createLayoutStore(MAIN_ONLY_DOC),
    resolveLoadUrl: () => 'http://127.0.0.1:3000/mini-live/',
    preloadPath: PRELOAD,
    iconPath: ICON,
    applyExternalNavigation: vi.fn(),
    getDisplays: () => [DEFAULT_DISPLAY],
    getPrimaryWorkArea: () => PRIMARY_WORK_AREA,
    getDisplayForBounds: () => DEFAULT_DISPLAY,
    getAlwaysOnTopMini: () => false,
    ...overrides,
  };
}

describe('createMiniLiveController', () => {
  it('focuses an existing window on the second open instead of constructing twice', () => {
    const fake = createFakeBrowserWindowCtor();
    const controller = createMiniLiveController({
      ...controllerDeps({ BrowserWindowCtor: fake.Ctor }),
    });

    controller.open();
    expect(fake.constructCount).toBe(1);
    const instance = fake.lastInstance;
    if (!instance) throw new Error('expected a BrowserWindow instance');
    instance.focus.mockClear();

    controller.open();

    expect(fake.constructCount).toBe(1);
    expect(instance.focus).toHaveBeenCalledOnce();
  });

  it('does not call app.quit when closing', () => {
    const quit = vi.fn();
    const fake = createFakeBrowserWindowCtor();
    const controller = createMiniLiveController({
      ...controllerDeps({ BrowserWindowCtor: fake.Ctor }),
    });

    controller.open();
    controller.close();

    expect(fake.lastInstance?.destroy).toHaveBeenCalledOnce();
    expect(quit).not.toHaveBeenCalled();
  });

  it('sets persisted wasOpen false when closed', () => {
    const store = createLayoutStore({
      ...MAIN_ONLY_DOC,
      mini: {
        bounds: { displayId: 1, x: 0, y: 0, width: 320, height: 200 },
        showEarnings: true,
        showMap: true,
        showHeroes: false,
        axis: 'vertical',
        wasOpen: true,
      },
    });
    const fake = createFakeBrowserWindowCtor();
    const controller = createMiniLiveController({
      ...controllerDeps({ BrowserWindowCtor: fake.Ctor, layoutStore: store }),
    });

    controller.open();
    controller.close();

    expect(store.read()?.mini?.wasOpen).toBe(false);
  });

  it('restoreIfWasOpen opens the mini without hiding or minimizing main', () => {
    const hide = vi.fn();
    const minimize = vi.fn();
    const fake = createFakeBrowserWindowCtor();
    const controller = createMiniLiveController({
      ...controllerDeps({
        BrowserWindowCtor: fake.Ctor,
        layoutStore: createLayoutStore({
          ...MAIN_ONLY_DOC,
          mini: {
            bounds: { displayId: 1, x: 0, y: 0, width: 320, height: 200 },
            showEarnings: true,
            showMap: true,
            showHeroes: false,
            axis: 'vertical',
            wasOpen: true,
          },
        }),
      }),
    });

    controller.restoreIfWasOpen();

    expect(fake.constructCount).toBe(1);
    expect(hide).not.toHaveBeenCalled();
    expect(minimize).not.toHaveBeenCalled();
  });

  it('applies stored always-on-top at screen-saver when the mini is created', () => {
    const fake = createFakeBrowserWindowCtor();
    const controller = createMiniLiveController({
      ...controllerDeps({ BrowserWindowCtor: fake.Ctor, getAlwaysOnTopMini: () => true }),
    });

    controller.open();

    expect(fake.lastInstance?.setAlwaysOnTop).toHaveBeenCalledWith(true, 'screen-saver');
  });

  it('fits the growth axis from measured content and persists bounds', () => {
    const store = createLayoutStore({
      ...MAIN_ONLY_DOC,
      mini: {
        bounds: { displayId: 1, x: 0, y: 0, width: 400, height: 200 },
        showEarnings: true,
        showMap: true,
        showHeroes: false,
        axis: 'vertical',
        wasOpen: true,
      },
    });
    const fake = createFakeBrowserWindowCtor();
    const controller = createMiniLiveController({
      ...controllerDeps({ BrowserWindowCtor: fake.Ctor, layoutStore: store }),
    });

    controller.open();
    controller.fitGrowthAxis({ width: 999, height: 320 });

    expect(fake.lastInstance?.setBounds).toHaveBeenCalledWith(
      expect.objectContaining({ width: 320, height: 320 }),
    );
    expect(store.read()?.mini?.bounds.height).toBe(320);
    expect(store.read()?.mini?.bounds.width).toBe(320);
  });
});

describe('applyMiniAlwaysOnTop', () => {
  it('uses the screen-saver level on the mini window stub', () => {
    const setAlwaysOnTop = vi.fn();
    const win = {
      isDestroyed: () => false,
      setAlwaysOnTop,
    };

    applyMiniAlwaysOnTop(win as never, true);

    expect(setAlwaysOnTop).toHaveBeenCalledWith(true, 'screen-saver');
  });
});

describe('createMiniLiveController — shutdown versus the player closing it', () => {
  const OPEN_DOC: WindowLayoutDocument = {
    ...MAIN_ONLY_DOC,
    mini: {
      bounds: { displayId: 1, x: 0, y: 0, width: 320, height: 200 },
      showEarnings: true,
      showMap: true,
      showHeroes: false,
      axis: 'vertical',
      wasOpen: true,
    },
  };

  function closedListenerOf(instance: { on: { mock: { calls: unknown[][] } } } | undefined): (() => void) | undefined {
    const call = instance?.on.mock.calls.find(([event]) => event === 'closed');
    return typeof call?.[1] === 'function' ? (call[1] as () => void) : undefined;
  }

  it('dispose tears the window down but keeps wasOpen so the next launch restores the mini', () => {
    const store = createLayoutStore(OPEN_DOC);
    const fake = createFakeBrowserWindowCtor();
    const controller = createMiniLiveController({
      ...controllerDeps({ BrowserWindowCtor: fake.Ctor, layoutStore: store }),
    });

    controller.open();
    controller.dispose();

    expect(fake.lastInstance?.destroy).toHaveBeenCalledOnce();
    expect(store.read()?.mini?.wasOpen).toBe(true);
    expect(controller.getWindow()).toBeNull();
  });

  it('a window the OS closed is forgotten: wasOpen false and the next open constructs afresh', () => {
    const store = createLayoutStore(OPEN_DOC);
    const fake = createFakeBrowserWindowCtor();
    const controller = createMiniLiveController({
      ...controllerDeps({ BrowserWindowCtor: fake.Ctor, layoutStore: store }),
    });

    controller.open();
    const onClosed = closedListenerOf(fake.lastInstance);
    if (!onClosed) throw new Error('expected the controller to listen for closed');
    onClosed();

    expect(store.read()?.mini?.wasOpen).toBe(false);
    expect(controller.getWindow()).toBeNull();

    controller.open();

    expect(fake.constructCount).toBe(2);
  });

  it('the closed event that destroy() itself fires during dispose does not flip wasOpen', () => {
    const store = createLayoutStore(OPEN_DOC);
    const fake = createFakeBrowserWindowCtor();
    const controller = createMiniLiveController({
      ...controllerDeps({ BrowserWindowCtor: fake.Ctor, layoutStore: store }),
    });

    controller.open();
    const onClosed = closedListenerOf(fake.lastInstance);
    if (!onClosed) throw new Error('expected the controller to listen for closed');
    controller.dispose();
    onClosed();

    expect(store.read()?.mini?.wasOpen).toBe(true);
  });
});

describe('createMiniLiveBrowserWindow — revealed at construction, exactly once', () => {
  function windowWithCapturedListeners(suppressReveal?: boolean) {
    const show = vi.fn();
    const focus = vi.fn();
    const loadURL = vi.fn(() => Promise.resolve());
    const contentsListeners = new Map<string, (...args: unknown[]) => void>();

    class FakeBrowserWindow {
      webContents = {
        loadURL,
        on: (event: string, listener: (...args: unknown[]) => void) => {
          contentsListeners.set(event, listener);
        },
      };

      show = show;
      focus = focus;
      destroy = vi.fn();
      isDestroyed = vi.fn(() => false);
      setAlwaysOnTop = vi.fn();
      setBounds = vi.fn();
      getBounds = vi.fn(() => ({ x: 0, y: 0, width: 320, height: 200 }));
      on = vi.fn();

      constructor(public options: unknown) {}
    }

    createMiniLiveBrowserWindow(FakeBrowserWindow, {
      preloadPath: PRELOAD,
      iconPath: ICON,
      x: 0,
      y: 0,
      width: 320,
      height: 200,
      loadUrl: 'http://127.0.0.1:3000/mini-live/',
      suppressReveal,
    });

    return { show, focus, loadURL, contentsListeners };
  }

  it('shows and focuses without waiting for the renderer to paint', () => {
    const { show, focus } = windowWithCapturedListeners();

    expect(show).toHaveBeenCalledOnce();
    expect(focus).toHaveBeenCalledOnce();
  });

  it('never waits on ready-to-show, which is what used to delay the reveal', () => {
    const { show } = windowWithCapturedListeners();

    expect(show).toHaveBeenCalledOnce();
  });

  it('does not take focus again once the renderer finishes loading', () => {
    const { show, focus, contentsListeners } = windowWithCapturedListeners();

    contentsListeners.get('did-finish-load')?.();

    expect(show).toHaveBeenCalledOnce();
    expect(focus).toHaveBeenCalledOnce();
  });

  it('does not take focus again when the renderer fails to load', () => {
    const { show, focus, contentsListeners } = windowWithCapturedListeners();

    contentsListeners.get('did-fail-load')?.({}, -6, 'ERR_FILE_NOT_FOUND', 'app://x');

    expect(show).toHaveBeenCalledOnce();
    expect(focus).toHaveBeenCalledOnce();
  });

  it('neither shows nor focuses when the reveal is suppressed', () => {
    const { show, focus } = windowWithCapturedListeners(true);

    expect(show).not.toHaveBeenCalled();
    expect(focus).not.toHaveBeenCalled();
  });

  it('still loads its renderer when the reveal is suppressed — hidden, not skipped', () => {
    const { loadURL } = windowWithCapturedListeners(true);

    expect(loadURL).toHaveBeenCalledWith('http://127.0.0.1:3000/mini-live/');
  });
});
