import type { AppFlavor } from '@bombfarm/contracts';
import type { SqliteDb } from '../storage/index.js';
import { createInstallIdStore } from './install-id-store.js';
import { sendUsagePing } from './usage-ping-transport.js';
import { createUsagePing, type AccountIdentity, type UsagePing, type UsagePingScheduler } from './usage-ping.js';

export { accountIdentityOf } from './usage-ping.js';
export type { UsagePing } from './usage-ping.js';

const timerScheduler: UsagePingScheduler = {
  scheduleOnce: (callback, delayMs) => {
    const handle = setTimeout(callback, delayMs);
    return () => {
      clearTimeout(handle);
    };
  },
  scheduleEvery: (callback, intervalMs) => {
    const handle = setInterval(callback, intervalMs);
    return () => {
      clearInterval(handle);
    };
  },
};

/** `null` for an unpackaged build: a dev run, the smoke suite and offline mode never ping. */
export function createElectronUsagePing(deps: {
  readonly isPackaged: boolean;
  readonly db: SqliteDb | null;
  readonly flavor: AppFlavor;
  readonly version: string;
  readonly isEnabled: () => boolean;
  readonly readAccount: () => AccountIdentity | null;
  readonly log: (event: string, detail: Record<string, unknown>) => void;
}): UsagePing | null {
  if (!deps.isPackaged) return null;
  return createUsagePing({
    flavor: deps.flavor,
    version: deps.version,
    isEnabled: deps.isEnabled,
    installIds: createInstallIdStore(deps.db),
    readAccount: deps.readAccount,
    send: sendUsagePing,
    scheduler: timerScheduler,
    log: deps.log,
  });
}
