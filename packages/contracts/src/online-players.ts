/**
 * The desktop app's online-players seam: how many players the game's server counts right now, as
 * the project's own API relays it. The app asks that one endpoint and nothing else for this.
 */

/** How often main asks. The relay refreshes its own copy at most once a minute, and the count is
 *  sampled every five, so asking more often only re-reads the same number. */
export const ONLINE_PLAYERS_CHECK_MS = 5 * 60_000;

/** A reading older than this is not shown. It is long enough to ride out a few missed checks and
 *  short enough that a number on screen is never hours out of date. */
export const ONLINE_PLAYERS_MAX_AGE_MS = 30 * 60_000;

/** The largest count taken as real. A reading above it is treated as a broken feed, not as news. */
export const ONLINE_PLAYERS_MAX = 10_000_000;

/** What the relay answers with: when the server took the sample (seconds since the epoch) and the
 *  count it recorded. */
export interface OnlinePlayersReading {
  readonly at: number;
  readonly players: number;
}

export interface OnlinePlayersView {
  /** `null` until a reading is in hand, and again once the one held is too old to show. */
  readonly reading: OnlinePlayersReading | null;
}

export const emptyOnlinePlayersView: OnlinePlayersView = { reading: null };

function isCount(value: unknown, max: number): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= max;
}

/**
 * The one place a response body becomes a reading. Anything that is not exactly the versioned
 * shape yields `null`, so a change on the far side blanks the readout instead of printing a
 * wrong number. Extra keys are tolerated; the three below are not optional.
 */
export function readOnlinePlayersBody(value: unknown): OnlinePlayersReading | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  if (body['v'] !== 1) return null;
  const at = body['at'];
  const players = body['players'];
  if (!isCount(at, Number.MAX_SAFE_INTEGER) || !isCount(players, ONLINE_PLAYERS_MAX)) return null;
  return { at, players };
}
