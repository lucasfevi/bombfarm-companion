import type { ShellLifecycle } from './window-lifecycle.js';

export interface ShellSmokeBridge {
  show(): void;
  quitFromTray(): void;
  simulateSecondInstance(): void;
  readonly trayPresent: boolean;
}

const GLOBAL_KEY = '__bfcShellSmoke';

/**
 * The bridge is a test seam: it hands anything running in the main process the power to show the
 * window and quit the app, under a fixed global name. A distributed build must not carry it, and
 * `isPackaged` is the only line that separates a shipped build from a local or smoke-test run.
 */
export function shouldInstallShellSmokeBridge(input: { isPackaged: boolean }): boolean {
  return !input.isPackaged;
}

type GlobalWithBridge = typeof globalThis & {
  [GLOBAL_KEY]?: ShellSmokeBridge;
};

export function installShellSmokeBridge(
  lifecycle: ShellLifecycle,
  simulateSecondInstance: () => void,
): void {
  (globalThis as GlobalWithBridge)[GLOBAL_KEY] = {
    show: () => {
      lifecycle.show();
    },
    quitFromTray: () => {
      lifecycle.requestQuit();
    },
    simulateSecondInstance,
    get trayPresent() {
      return lifecycle.trayPresent;
    },
  };
}

export function clearShellSmokeBridge(): void {
  Reflect.deleteProperty(globalThis, GLOBAL_KEY);
}
