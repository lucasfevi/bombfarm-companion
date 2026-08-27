import type { RotationHousePanel } from '@bombfarm/domain/rotation-status';
import { sub, type Copy } from '../../lib/copy';
import type { AppLocale } from '@bombfarm/contracts';
import { formatCount } from '../../lib/format';
import { formatLiveDurationSeconds } from './format-live-duration';

/**
 * What the House panel used to be, folded into the Resting heading: the rest slots the heroes
 * below are competing for, how long a full refill takes, and how many skips the day has left.
 *
 * Every reading is independently optional. A house the game has sent nothing for contributes
 * nothing here rather than a row of missing-data strings, because the section it heads still has
 * a real count of its own to show.
 */
export function restingSlotsCount(recoveringCount: number, house: RotationHousePanel, locale: AppLocale): string {
  const count = formatCount(recoveringCount, locale);
  return house.slots !== undefined ? `${count}/${formatCount(house.slots, locale)}` : count;
}

/** Present only while the account is below the ceiling — and never when the ceiling is unknown. */
export function restingSlotsHint(house: RotationHousePanel, t: Copy): string | undefined {
  if (house.slots === undefined || house.slotsMax === undefined) return undefined;
  return house.slots < house.slotsMax ? t.liveRestingSlotsHint : undefined;
}

export function restingFacts(house: RotationHousePanel, t: Copy, locale: AppLocale): string[] {
  const facts: string[] = [];

  if (house.cycleSeconds !== undefined) {
    facts.push(sub(t.liveRestingCycleValue, { duration: formatLiveDurationSeconds(house.cycleSeconds) }));
  }

  // A spent day is stated even when the daily allowance itself was never sent: "none left" is the
  // reading that changes what a player does, and it does not need the maximum to be true.
  if (house.rescuesLeft === 0) {
    facts.push(t.liveRestingSkipsNone);
  } else if (house.rescuesLeft !== undefined && house.rescuesMax !== undefined) {
    facts.push(
      sub(t.liveRestingSkipsValue, {
        left: formatCount(house.rescuesLeft, locale),
        max: formatCount(house.rescuesMax, locale),
      }),
    );
  }

  return facts;
}
