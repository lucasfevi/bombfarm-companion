import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearShellSmokeBridge,
  installShellSmokeBridge,
  shouldInstallShellSmokeBridge,
  type ShellSmokeBridge,
} from './shell-smoke-bridge.js';
import type { ShellLifecycle } from './window-lifecycle.js';

function readBridge(): ShellSmokeBridge | undefined {
  return (globalThis as typeof globalThis & { __bfcShellSmoke?: ShellSmokeBridge }).__bfcShellSmoke;
}

function fakeLifecycle(overrides: Partial<ShellLifecycle> = {}): ShellLifecycle {
  return {
    onWindowClose: () => 'let-close',
    show: vi.fn(),
    requestQuit: vi.fn(),
    markQuitting: vi.fn(),
    destroyTray: vi.fn(),
    setTrayLabels: vi.fn(),
    setMiniAvailable: vi.fn(),
    trayPresent: false,
    ...overrides,
  };
}

afterEach(() => {
  clearShellSmokeBridge();
});

describe('shouldInstallShellSmokeBridge', () => {
  it('installs for an unpackaged run, which is what the smoke suite launches', () => {
    expect(shouldInstallShellSmokeBridge({ isPackaged: false })).toBe(true);
  });

  it('never installs into a packaged build', () => {
    expect(shouldInstallShellSmokeBridge({ isPackaged: true })).toBe(false);
  });
});

describe('installShellSmokeBridge', () => {
  it('routes show and quitFromTray to the lifecycle, and reports its tray presence live', () => {
    const show = vi.fn();
    const requestQuit = vi.fn();
    const lifecycle = fakeLifecycle({ show, requestQuit, trayPresent: true });

    installShellSmokeBridge(lifecycle, vi.fn());
    const bridge = readBridge();

    expect(bridge?.trayPresent).toBe(true);
    bridge?.show();
    bridge?.quitFromTray();
    expect(show).toHaveBeenCalledOnce();
    expect(requestQuit).toHaveBeenCalledOnce();
  });

  it('calls the supplied second-instance simulation, not the lifecycle directly', () => {
    const simulate = vi.fn();
    const show = vi.fn();

    installShellSmokeBridge(fakeLifecycle({ show }), simulate);
    readBridge()?.simulateSecondInstance();

    expect(simulate).toHaveBeenCalledOnce();
    expect(show).not.toHaveBeenCalled();
  });

  it('clearShellSmokeBridge removes the global rather than leaving an inert object behind', () => {
    installShellSmokeBridge(fakeLifecycle(), vi.fn());
    expect(readBridge()).toBeDefined();

    clearShellSmokeBridge();

    expect(readBridge()).toBeUndefined();
    expect('__bfcShellSmoke' in globalThis).toBe(false);
  });
});
