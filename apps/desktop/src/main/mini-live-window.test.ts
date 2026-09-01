import { describe, expect, it, vi } from 'vitest';
import type { WindowLayoutStore } from './game-api/window-layout-store.js';
import type { WindowLayoutDocument } from './shell/window-layout.js';
import {
  MINI_LIVE_PACKAGED_URL,
  buildMiniLiveWindowOptions,
  createMiniLiveBrowserWindow,
  createMiniLiveController,
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

function createLayoutStore(doc: WindowLayoutDocument | null): WindowLayoutStore {
  let current = doc;
  return {
    read: () => current,
    write: (next) => {
      current = next;
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
  const instances: Array<{
    focus: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
    isDestroyed: ReturnType<typeof vi.fn>;
  }> = [];

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

describe('createMiniLiveController', () => {
  it('focuses an existing window on the second open instead of constructing twice', () => {
    const fake = createFakeBrowserWindowCtor();
    const controller = createMiniLiveController({
      BrowserWindowCtor: fake.Ctor,
      layoutStore: createLayoutStore(MAIN_ONLY_DOC),
      resolveLoadUrl: () => 'http://127.0.0.1:3000/mini-live/',
      preloadPath: PRELOAD,
      iconPath: ICON,
      applyExternalNavigation: vi.fn(),
      getDisplays: () => [{ id: 1, workArea: PRIMARY_WORK_AREA }],
      getPrimaryWorkArea: () => PRIMARY_WORK_AREA,
    });

    controller.open();
    expect(fake.constructCount).toBe(1);
    const instance = fake.lastInstance!;
    instance.focus.mockClear();

    controller.open();

    expect(fake.constructCount).toBe(1);
    expect(instance.focus).toHaveBeenCalledOnce();
  });

  it('does not call app.quit when closing', () => {
    const quit = vi.fn();
    const fake = createFakeBrowserWindowCtor();
    const controller = createMiniLiveController({
      BrowserWindowCtor: fake.Ctor,
      layoutStore: createLayoutStore(MAIN_ONLY_DOC),
      resolveLoadUrl: () => 'http://127.0.0.1:3000/mini-live/',
      preloadPath: PRELOAD,
      iconPath: ICON,
      applyExternalNavigation: vi.fn(),
      getDisplays: () => [{ id: 1, workArea: PRIMARY_WORK_AREA }],
      getPrimaryWorkArea: () => PRIMARY_WORK_AREA,
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
      BrowserWindowCtor: fake.Ctor,
      layoutStore: store,
      resolveLoadUrl: () => 'http://127.0.0.1:3000/mini-live/',
      preloadPath: PRELOAD,
      iconPath: ICON,
      applyExternalNavigation: vi.fn(),
      getDisplays: () => [{ id: 1, workArea: PRIMARY_WORK_AREA }],
      getPrimaryWorkArea: () => PRIMARY_WORK_AREA,
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
      resolveLoadUrl: () => 'http://127.0.0.1:3000/mini-live/',
      preloadPath: PRELOAD,
      iconPath: ICON,
      applyExternalNavigation: vi.fn(),
      getDisplays: () => [{ id: 1, workArea: PRIMARY_WORK_AREA }],
      getPrimaryWorkArea: () => PRIMARY_WORK_AREA,
    });

    controller.restoreIfWasOpen();

    expect(fake.constructCount).toBe(1);
    expect(hide).not.toHaveBeenCalled();
    expect(minimize).not.toHaveBeenCalled();
  });
});
