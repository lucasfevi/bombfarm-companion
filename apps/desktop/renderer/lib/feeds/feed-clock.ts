/**
 * The four things this app keeps asking for on the player's behalf, and the clock each one runs
 * on. Feeds are not tabs: Farm, Heroes, Forge and Optimizer all read the same account, and it is
 * the account read that has an age. The live tap is not here either — it is a stream, with
 * nothing to ask for, and the connection chip already says how it is doing.
 */
import { MARKET_SNAPSHOT_CHECK_MS, UPDATE_CHECK_INTERVAL_MS } from '@bombfarm/contracts';
import { READ_PACING } from '@bombfarm/game-api';

export const FEED_IDS = ['account', 'pvp', 'market', 'updates'] as const;
export type FeedId = (typeof FEED_IDS)[number];

/** How often the feed refreshes itself when nobody presses anything; `null` for a feed that only
 *  moves when asked (the PVP standing is read when its tab opens, and by duel results). */
export const FEED_CYCLE_MS: Record<FeedId, number | null> = {
  account: READ_PACING.cycleForegroundMs,
  pvp: null,
  market: MARKET_SNAPSHOT_CHECK_MS,
  updates: UPDATE_CHECK_INTERVAL_MS,
};

export function feedAgeMs(capturedAt: string | null, now: number): number | null {
  if (capturedAt === null) return null;
  const at = Date.parse(capturedAt);
  if (!Number.isFinite(at)) return null;
  return Math.max(0, now - at);
}

/** How far the feed is towards its next automatic refresh, 0 to 1; `null` for a feed with no
 *  clock, or one that has never been read. */
export function feedMeter(feed: FeedId, ageMs: number | null): number | null {
  const cycle = FEED_CYCLE_MS[feed];
  if (cycle === null || ageMs === null) return null;
  return Math.min(1, ageMs / cycle);
}

/** Milliseconds until the feed's own clock fires again, floored at zero; `null` with no clock. */
export function feedNextInMs(feed: FeedId, ageMs: number | null): number | null {
  const cycle = FEED_CYCLE_MS[feed];
  if (cycle === null || ageMs === null) return null;
  return Math.max(0, cycle - ageMs);
}
