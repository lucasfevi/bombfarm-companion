import { PREMIUM_NOTIFICATIONS, type AppLocale } from '@bombfarm/contracts';
import type { LogPort } from '../../../storage/index.js';
import { CapabilityError, type CapabilityHandler } from '../capability-channel.js';

export const NOTIFY_MIN_GAP_MS = 30_000;
export const NOTIFY_DAY_MS = 24 * 60 * 60 * 1000;
export const NOTIFY_PER_DAY = 20;

export interface PremiumToast {
  readonly title: string;
  readonly body: string;
  readonly onClick: () => void;
}

export interface NotifyCapabilityDeps {
  locale(): AppLocale;
  /** Milliseconds from the wall clock; the day window is measured on it. */
  now(): number;
  /** Shows a toast, or says the system cannot (see `createPremiumNotifier`). */
  show(toast: PremiumToast): 'shown' | 'unavailable';
  /** Brings the main window forward on the Premium tab. */
  openPremiumTab(): void;
  readonly log: LogPort;
}

/**
 * `notify`: shows one of the notifications the app holds (`PREMIUM_NOTIFICATIONS`), named by id, in
 * the app's language. No text from the bundle reaches the system. At most one every 30 seconds and
 * twenty in a rolling day, counted in memory (a restart starts again). A refused or unsupported
 * toast does not use up the budget.
 */
export function createNotifyCapability(deps: NotifyCapabilityDeps): CapabilityHandler {
  const shownAt: number[] = [];

  return (args) => {
    const id = typeof args === 'object' && args !== null ? (args as Record<string, unknown>)['id'] : undefined;
    if (typeof id !== 'string' || !Object.hasOwn(PREMIUM_NOTIFICATIONS, id)) throw new CapabilityError('bad_args');

    const now = deps.now();
    while (shownAt.length > 0 && now - (shownAt[0] as number) >= NOTIFY_DAY_MS) shownAt.shift();
    const last = shownAt.at(-1);
    if ((last !== undefined && now - last < NOTIFY_MIN_GAP_MS) || shownAt.length >= NOTIFY_PER_DAY) {
      throw new CapabilityError('rate_limited');
    }

    const strings = PREMIUM_NOTIFICATIONS[id as keyof typeof PREMIUM_NOTIFICATIONS][deps.locale()];
    const outcome = deps.show({
      title: strings.title,
      body: strings.body,
      onClick: () => {
        deps.openPremiumTab();
      },
    });
    deps.log.info({ scope: 'premium', event: 'premium.notify', outcome });
    if (outcome === 'unavailable') throw new CapabilityError('unavailable');
    shownAt.push(now);
    return null;
  };
}
