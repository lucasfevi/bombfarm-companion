import type {
  AccountPayload,
  AppFlavor,
  UsagePingAccount,
  UsagePingBody,
  UsagePingKind,
} from '@bombfarm/contracts';
import type { InstallIdStore } from './install-id-store.js';

export type { UsagePingBody, UsagePingKind } from '@bombfarm/contracts';
export type AccountIdentity = UsagePingAccount;

export const USAGE_PING_INTERVAL_MS = 60 * 60 * 1000;
/** Long enough for the first account read to land, so the startup ping usually names the
 *  account; short enough that a brief session is still counted. */
export const USAGE_PING_FIRST_DELAY_MS = 60 * 1000;

export function buildUsagePing(input: {
  readonly kind: UsagePingKind;
  readonly flavor: AppFlavor;
  readonly version: string;
  readonly enabled: boolean;
  readonly installId: string | null;
  readonly account: AccountIdentity | null;
}): UsagePingBody {
  const base = { v: 1, kind: input.kind, flavor: input.flavor, version: input.version } as const;
  if (!input.enabled || input.installId === null) {
    return { ...base, install: null, account: null };
  }
  return { ...base, install: input.installId, account: input.account };
}

/** The game's own `account_id` and `player_name`, as the account section carries them. */
export function accountIdentityOf(payload: AccountPayload | null): AccountIdentity | null {
  const account = payload?.account;
  if (!account) return null;

  const rawId = account.account_id;
  let id: string | null = null;
  if (typeof rawId === 'number' && Number.isSafeInteger(rawId)) id = String(rawId);
  else if (typeof rawId === 'string' && rawId.trim() !== '') id = rawId.trim();
  if (id === null) return null;

  const rawName = account.player_name;
  const name = typeof rawName === 'string' && rawName.trim() !== '' ? rawName.trim() : null;
  return { id, name };
}

export interface UsagePingScheduler {
  readonly scheduleOnce: (callback: () => void, delayMs: number) => () => void;
  readonly scheduleEvery: (callback: () => void, intervalMs: number) => () => void;
}

export interface UsagePingDeps {
  readonly flavor: AppFlavor;
  readonly version: string;
  readonly isEnabled: () => boolean;
  readonly installIds: InstallIdStore;
  readonly readAccount: () => AccountIdentity | null;
  readonly send: (body: UsagePingBody) => Promise<void>;
  readonly scheduler: UsagePingScheduler;
  readonly log: (event: string, detail: Record<string, unknown>) => void;
}

export interface UsagePing {
  start(): void;
  stop(): void;
  setEnabled(enabled: boolean): void;
}

export function createUsagePing(deps: UsagePingDeps): UsagePing {
  let cancels: Array<() => void> = [];

  const fire = (kind: UsagePingKind): void => {
    const enabled = deps.isEnabled();
    const body = buildUsagePing({
      kind,
      flavor: deps.flavor,
      version: deps.version,
      enabled,
      installId: enabled ? deps.installIds.ensure() : null,
      account: enabled ? deps.readAccount() : null,
    });
    deps.send(body).catch((error: unknown) => {
      deps.log('usage-ping.failed', { kind, reason: error instanceof Error ? error.message : String(error) });
    });
  };

  return {
    start() {
      if (cancels.length > 0) return;
      cancels = [
        deps.scheduler.scheduleOnce(() => {
          fire('startup');
        }, USAGE_PING_FIRST_DELAY_MS),
        deps.scheduler.scheduleEvery(() => {
          fire('hourly');
        }, USAGE_PING_INTERVAL_MS),
      ];
    },
    stop() {
      for (const cancel of cancels) cancel();
      cancels = [];
    },
    setEnabled(enabled) {
      if (!enabled) deps.installIds.clear();
    },
  };
}
