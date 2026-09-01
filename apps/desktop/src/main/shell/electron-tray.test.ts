import { describe, expect, it, vi } from 'vitest';
import { createElectronTray } from './electron-tray.js';

const ICON_PATH = 'C:\\app\\assets\\icon.ico';
const TOOLTIP = 'Bomb Farm Companion';

describe('createElectronTray', () => {
  it('returns not-win32 without constructing on other platforms', () => {
    const createTray = vi.fn();

    const result = createElectronTray({
      iconPath: ICON_PATH,
      tooltip: TOOLTIP,
      platform: 'darwin',
      fileExists: () => true,
      createNativeImage: () => ({ isEmpty: () => false }),
      createTray,
    });

    expect(result).toEqual({ ok: false, reason: 'not-win32' });
    expect(createTray).not.toHaveBeenCalled();
  });

  it('returns icon-missing when the icon file is absent', () => {
    const createTray = vi.fn();

    const result = createElectronTray({
      iconPath: ICON_PATH,
      tooltip: TOOLTIP,
      platform: 'win32',
      fileExists: () => false,
      createNativeImage: () => ({ isEmpty: () => false }),
      createTray,
    });

    expect(result).toEqual({ ok: false, reason: 'icon-missing' });
    expect(createTray).not.toHaveBeenCalled();
  });

  it('returns icon-empty when the native image is empty', () => {
    const createTray = vi.fn();

    const result = createElectronTray({
      iconPath: ICON_PATH,
      tooltip: TOOLTIP,
      platform: 'win32',
      fileExists: () => true,
      createNativeImage: () => ({ isEmpty: () => true }),
      createTray,
    });

    expect(result).toEqual({ ok: false, reason: 'icon-empty' });
    expect(createTray).not.toHaveBeenCalled();
  });

  it('returns construction-failed when tray construction throws', () => {
    const result = createElectronTray({
      iconPath: ICON_PATH,
      tooltip: TOOLTIP,
      platform: 'win32',
      fileExists: () => true,
      createNativeImage: () => ({ isEmpty: () => false }),
      createTray: () => {
        throw new Error('tray failed');
      },
    });

    expect(result).toEqual({ ok: false, reason: 'construction-failed' });
  });

  it('returns ok true and sets the tooltip on the happy path', () => {
    const setToolTip = vi.fn();
    const native = {
      setToolTip,
      setContextMenu: vi.fn(),
      destroy: vi.fn(),
    };

    const result = createElectronTray({
      iconPath: ICON_PATH,
      tooltip: TOOLTIP,
      platform: 'win32',
      fileExists: () => true,
      createNativeImage: () => ({ isEmpty: () => false }),
      createTray: () => native as never,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('expected tray creation to succeed');
    }
    expect(setToolTip).toHaveBeenCalledWith(TOOLTIP);
    expect(typeof result.tray.setToolTip).toBe('function');
    expect(typeof result.tray.setContextMenu).toBe('function');
    expect(typeof result.tray.destroy).toBe('function');
  });
});
