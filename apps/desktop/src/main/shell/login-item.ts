/**
 * Whether the app registers itself to start with Windows, and how that is reconciled with what
 * Windows actually holds. Pure of Electron: the registry sits behind an injected port, so no test
 * and no unpackaged run can write the real one.
 */

/**
 * The one argument list both `set` and `get` use. Electron reads `openAtLogin` back correctly only
 * when both sides pass the same arguments. Empty today; adding an argument later makes every
 * existing install rewrite its entry on the next reconcile.
 */
export const LOGIN_ITEM_ARGS: readonly string[] = [];

export interface LoginItemReadback {
  readonly openAtLogin: boolean;
  /** Windows' own switch (Settings, Apps, Startup / Task Manager, Startup). */
  readonly disabledByWindows: boolean;
}

export interface LoginItemPort {
  set(openAtLogin: boolean): void;
  get(): LoginItemReadback;
}

export type LoginItemBlock = 'unpackaged' | 'not_supported' | 'disabled_by_windows' | 'failed';

export type LoginItemOutcome =
  | { readonly applied: true; readonly registered: boolean }
  | { readonly applied: false; readonly block: LoginItemBlock };

/** Consent permits registration; it never requests it. */
export function desiredLoginItemState(input: {
  startWithWindows: boolean;
  consentGranted: boolean;
}): boolean {
  return input.startWithWindows && input.consentGranted;
}

export function reconcileLoginItem(input: {
  desired: boolean;
  isPackaged: boolean;
  platform: NodeJS.Platform;
  port: LoginItemPort;
}): LoginItemOutcome {
  const { desired, isPackaged, platform, port } = input;
  if (platform !== 'win32') return { applied: false, block: 'not_supported' };
  if (!isPackaged) return { applied: false, block: 'unpackaged' };

  let current: LoginItemReadback;
  try {
    current = port.get();
  } catch {
    return { applied: false, block: 'failed' };
  }

  // The player switched the entry off in Windows; do not undo that on every boot.
  if (desired && current.disabledByWindows) {
    return { applied: false, block: 'disabled_by_windows' };
  }
  if (current.openAtLogin === desired) return { applied: true, registered: desired };

  try {
    port.set(desired);
    if (port.get().openAtLogin !== desired) return { applied: false, block: 'failed' };
  } catch {
    return { applied: false, block: 'failed' };
  }
  return { applied: true, registered: desired };
}
