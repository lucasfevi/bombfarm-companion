import { firstHideTextFor } from '@bombfarm/game-api';
import type { AppLocale } from '@bombfarm/contracts';
import { createFirstHideAnnouncer } from './first-hide-notice.js';

/** The first-hide announcer with its text resolved from the live locale at announce time. */
export function createLocalizedFirstHideAnnouncer(
  deps: Omit<Parameters<typeof createFirstHideAnnouncer>[0], 'text'> & {
    readonly getLocale: () => AppLocale;
  },
) {
  const { getLocale, ...rest } = deps;
  return createFirstHideAnnouncer({ ...rest, text: () => firstHideTextFor(getLocale()) });
}
