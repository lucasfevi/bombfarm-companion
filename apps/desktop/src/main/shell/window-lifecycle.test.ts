import { TRAY_TEXT } from '@bombfarm/game-api';
import { describe, expect, it, vi } from 'vitest';
import {
  createShellLifecycle,
  decideOnClose,
  shouldQuitOnAllWindowsClosed,
  type TrayMenuItem,
  type TrayPort,
  type WindowPort,
} from './window-lifecycle.js';

describe('shouldQuitOnAllWindowsClosed', () => {
  it('does not quit when a tray is present', () => {
    expect(shouldQuitOnAllWindowsClosed({ platform: 'win32', trayPresent: true })).toBe(false);
  });

  it('still quits on Windows when the tray is absent', () => {
    expect(shouldQuitOnAllWindowsClosed({ platform: 'win32', trayPresent: false })).toBe(true);
  });

  it('does not quit on darwin without a tray', () => {
    expect(shouldQuitOnAllWindowsClosed({ platform: 'darwin', trayPresent: false })).toBe(false);
  });
});

describe('decideOnClose', () => {
  it('returns hide when the tray is present on win32 and the app is not quitting', () => {
    expect(decideOnClose({ trayPresent: true, quitting: false, platform: 'win32' })).toBe('hide');
  });

  it('returns let-close when the tray is absent', () => {
    expect(decideOnClose({ trayPresent: false, quitting: false, platform: 'win32' })).toBe('let-close');
  });

  it('returns let-close when the app is quitting', () => {
    expect(decideOnClose({ trayPresent: true, quitting: true, platform: 'win32' })).toBe('let-close');
  });

  it('returns let-close on non-win32 platforms', () => {
    expect(decideOnClose({ trayPresent: true, quitting: false, platform: 'other' })).toBe('let-close');
  });
});

function createWindowPort(
  overrides: Partial<Pick<WindowPort, 'isVisible' | 'isMinimized' | 'isDestroyed'>> = {},
) {
  const hide = vi.fn<WindowPort['hide']>();
  const show = vi.fn<WindowPort['show']>();
  const focus = vi.fn<WindowPort['focus']>();
  const restore = vi.fn<WindowPort['restore']>();
  const isVisible = overrides.isVisible ?? vi.fn<WindowPort['isVisible']>(() => true);
  const isMinimized = overrides.isMinimized ?? vi.fn<WindowPort['isMinimized']>(() => false);
  const isDestroyed = overrides.isDestroyed ?? vi.fn<WindowPort['isDestroyed']>(() => false);
  return {
    hide,
    show,
    focus,
    restore,
    isVisible,
    isMinimized,
    isDestroyed,
  };
}

function createTrayPort() {
  const setToolTip = vi.fn<TrayPort['setToolTip']>();
  const destroy = vi.fn<TrayPort['destroy']>();
  const port: TrayPort & { items: TrayMenuItem[]; destroy: typeof destroy } = {
    items: [],
    setToolTip,
    setContextMenu(items) {
      port.items = [...items];
    },
    destroy,
  };
  return port;
}

describe('createShellLifecycle', () => {
  it('restores, shows, and focuses on the first show call', () => {
    const window = createWindowPort({
      isVisible: vi.fn<WindowPort['isVisible']>(() => false),
      isMinimized: vi.fn<WindowPort['isMinimized']>(() => true),
    });
    const lifecycle = createShellLifecycle({
      window,
      tray: null,
      quit: vi.fn(),
      openMini: vi.fn(),
      log: { info: vi.fn(), error: vi.fn() },
      labels: TRAY_TEXT.en,
      tooltip: 'Bomb Farm Companion',
    });

    lifecycle.show();

    expect(window.restore.mock.calls).toHaveLength(1);
    expect(window.show.mock.calls).toHaveLength(1);
    expect(window.focus.mock.calls).toHaveLength(1);
  });

  it('does not call show, restore, or focus again when already visible and restored', () => {
    const window = createWindowPort();
    const lifecycle = createShellLifecycle({
      window,
      tray: null,
      quit: vi.fn(),
      openMini: vi.fn(),
      log: { info: vi.fn(), error: vi.fn() },
      labels: TRAY_TEXT.en,
      tooltip: 'Bomb Farm Companion',
    });

    lifecycle.show();
    lifecycle.show();

    expect(window.restore.mock.calls).toHaveLength(0);
    expect(window.show.mock.calls).toHaveLength(0);
    expect(window.focus.mock.calls).toHaveLength(1);
  });

  it('returns let-close after markQuitting even when the tray is present', () => {
    const lifecycle = createShellLifecycle({
      window: createWindowPort(),
      tray: createTrayPort(),
      quit: vi.fn(),
      openMini: vi.fn(),
      log: { info: vi.fn(), error: vi.fn() },
      labels: TRAY_TEXT.en,
      tooltip: 'Bomb Farm Companion',
    });

    expect(lifecycle.onWindowClose()).toBe('hide');
    lifecycle.markQuitting();
    expect(lifecycle.onWindowClose()).toBe('let-close');
  });

  it('installs show, mini, and quit tray menu items in order', () => {
    const openMini = vi.fn();
    const tray = createTrayPort();
    const lifecycle = createShellLifecycle({
      window: createWindowPort(),
      tray,
      quit: vi.fn(),
      openMini,
      log: { info: vi.fn(), error: vi.fn() },
      labels: TRAY_TEXT.en,
      tooltip: 'Bomb Farm Companion',
    });

    lifecycle.setTrayLabels(TRAY_TEXT['pt-BR']);

    expect(tray.items).toHaveLength(3);
    expect(tray.items.map((item) => item.id)).toEqual(['show', 'mini', 'quit']);
    expect(tray.items[0]?.label).toBe('Mostrar');
    expect(tray.items[1]?.label).toBe('Mini');
    expect(tray.items[2]?.label).toBe('Sair');

    tray.items[1]?.click();
    expect(openMini).toHaveBeenCalledOnce();
  });

  it('calls quit through requestQuit', () => {
    const quit = vi.fn();
    const lifecycle = createShellLifecycle({
      window: createWindowPort(),
      tray: null,
      quit,
      openMini: vi.fn(),
      log: { info: vi.fn(), error: vi.fn() },
      labels: TRAY_TEXT.en,
      tooltip: 'Bomb Farm Companion',
    });

    lifecycle.requestQuit();

    expect(quit).toHaveBeenCalledOnce();
  });

  it('destroys the tray when present', () => {
    const tray = createTrayPort();
    const lifecycle = createShellLifecycle({
      window: createWindowPort(),
      tray,
      quit: vi.fn(),
      openMini: vi.fn(),
      log: { info: vi.fn(), error: vi.fn() },
      labels: TRAY_TEXT.en,
      tooltip: 'Bomb Farm Companion',
    });

    lifecycle.destroyTray();

    expect(tray.destroy.mock.calls).toHaveLength(1);
  });
});
