/**
 * Holds the last login-item reconcile outcome, so a failure at boot or on a consent change (which
 * has no setter call to carry it) can still be read by Settings. Pure of Electron.
 */

import {
  desiredLoginItemState,
  reconcileLoginItem,
  type LoginItemBlock,
  type LoginItemOutcome,
  type LoginItemPort,
} from './login-item.js';

export interface LoginItemStatus {
  readonly registered: boolean;
  readonly block: LoginItemBlock | null;
}

/**
 * Holds the last reconcile outcome in memory, so a failure at boot or on a consent change (no
 * setter call to carry it) can still be read by Settings. Reads settings and consent; writes
 * neither, so a revoke removes the entry and leaves the stored setting as the player left it.
 */
export function createLoginItemReconciler(deps: {
  getStartWithWindows: () => boolean;
  isConsentGranted: () => boolean;
  isPackaged: boolean;
  platform: NodeJS.Platform;
  port: LoginItemPort;
}) {
  let lastOutcome: LoginItemOutcome | null = null;
  return {
    /** `startWithWindows` overrides the stored value for a write not yet persisted. */
    reconcile(startWithWindows?: boolean): LoginItemOutcome {
      lastOutcome = reconcileLoginItem({
        desired: desiredLoginItemState({
          startWithWindows: startWithWindows ?? deps.getStartWithWindows(),
          consentGranted: deps.isConsentGranted(),
        }),
        isPackaged: deps.isPackaged,
        platform: deps.platform,
        port: deps.port,
      });
      return lastOutcome;
    },
    status(): LoginItemStatus {
      if (lastOutcome === null) return { registered: false, block: null };
      return lastOutcome.applied
        ? { registered: lastOutcome.registered, block: null }
        : { registered: false, block: lastOutcome.block };
    },
  };
}
