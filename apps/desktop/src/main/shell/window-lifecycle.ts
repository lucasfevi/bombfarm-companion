import type { TrayLabels } from '@bombfarm/game-api';

export interface WindowPort {
  hide(): void;
  show(): void;
  focus(): void;
  restore(): void;
  isVisible(): boolean;
  isMinimized(): boolean;
  isDestroyed(): boolean;
}

export interface TrayMenuItem {
  readonly id: 'show' | 'mini' | 'quit';
  readonly label: string;
  readonly click: () => void;
}

export interface TrayPort {
  setToolTip(text: string): void;
  setContextMenu(items: readonly TrayMenuItem[]): void;
  destroy(): void;
}

export type CloseDecision = 'hide' | 'let-close';

export function shouldQuitOnAllWindowsClosed(input: {
  platform: NodeJS.Platform;
  trayPresent: boolean;
}): boolean {
  if (input.trayPresent) {
    return false;
  }
  if (input.platform === 'darwin') {
    return false;
  }
  return true;
}

export function decideOnClose(state: {
  trayPresent: boolean;
  quitting: boolean;
  platform: 'win32' | 'other';
}): CloseDecision {
  if (state.platform === 'win32' && state.trayPresent && !state.quitting) {
    return 'hide';
  }
  return 'let-close';
}

export interface ShellLifecycle {
  onWindowClose(): CloseDecision;
  show(): void;
  requestQuit(): void;
  markQuitting(): void;
  destroyTray(): void;
  setTrayLabels(labels: TrayLabels): void;
  setMiniAvailable(available: boolean): void;
  readonly trayPresent: boolean;
}

export function createShellLifecycle(deps: {
  window: WindowPort;
  tray: TrayPort | null;
  quit: () => void;
  openMini: () => void;
  log: {
    info: (rec: Record<string, unknown>) => void;
    error: (rec: Record<string, unknown>) => void;
  };
  labels: TrayLabels;
  tooltip: string;
  miniAvailable: boolean;
}): ShellLifecycle {
  let quitting = false;
  let labels = deps.labels;
  let miniAvailable = deps.miniAvailable;
  let focusedWhileVisible = false;

  const show = (): void => {
    if (deps.window.isDestroyed()) {
      return;
    }
    if (deps.window.isMinimized()) {
      deps.window.restore();
      focusedWhileVisible = false;
    }
    if (!deps.window.isVisible()) {
      deps.window.show();
      focusedWhileVisible = false;
    }
    if (!deps.window.isVisible() || deps.window.isMinimized()) {
      deps.window.focus();
      return;
    }
    if (!focusedWhileVisible) {
      deps.window.focus();
      focusedWhileVisible = true;
    }
  };

  // The compact window shows account data, so the tray drops the entry entirely until access is
  // granted — the same move the shell makes with its nav items, rather than offering a control
  // that would open a window with nothing in it.
  const buildMenu = (): TrayMenuItem[] => [
    { id: 'show', label: labels.show, click: show },
    ...(miniAvailable ? [{ id: 'mini' as const, label: labels.mini, click: deps.openMini }] : []),
    { id: 'quit', label: labels.quit, click: () => {
      deps.quit();
    } },
  ];

  const setTrayLabels = (next: TrayLabels): void => {
    labels = next;
    deps.tray?.setContextMenu(buildMenu());
  };

  const setMiniAvailable = (available: boolean): void => {
    miniAvailable = available;
    deps.tray?.setContextMenu(buildMenu());
  };

  if (deps.tray) {
    deps.tray.setToolTip(deps.tooltip);
    deps.tray.setContextMenu(buildMenu());
  }

  return {
    get trayPresent() {
      return deps.tray !== null;
    },
    onWindowClose() {
      return decideOnClose({
        trayPresent: deps.tray !== null,
        quitting,
        platform: deps.tray !== null ? 'win32' : 'other',
      });
    },
    show,
    requestQuit() {
      deps.quit();
    },
    markQuitting() {
      quitting = true;
    },
    destroyTray() {
      deps.tray?.destroy();
    },
    setTrayLabels,
    setMiniAvailable,
  };
}
