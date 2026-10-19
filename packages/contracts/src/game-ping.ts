/**
 * The desktop app's game-ping seam: how long a TCP handshake with the game's server takes from
 * this machine. It measures the network path to that host and nothing the game itself reports.
 */

/** How often main measures. Short enough that the number follows a connection change, long
 *  enough that an idle app costs the game host one bare handshake every quarter minute. */
export const GAME_PING_CHECK_MS = 15_000;

export interface GamePingView {
  /** Round-trip milliseconds of the last check, or `null` before the first one lands and
   *  whenever the last one failed. */
  readonly latencyMs: number | null;
}

export const emptyGamePingView: GamePingView = { latencyMs: null };
