import type { OnlinePlayersHttpGet } from './online-players-transport.js';

/** The count offline mode shows. A fixed number stamped with the current time: the strip has
 *  nothing to fetch it from there, and a value that never moves is what a fixture is for. */
export const OFFLINE_ONLINE_PLAYERS = 2537;

export const offlineOnlinePlayersGet =
  (now: () => number): OnlinePlayersHttpGet =>
  () =>
    Promise.resolve({
      status: 200,
      body: JSON.stringify({ v: 1, at: Math.floor(now() / 1000), players: OFFLINE_ONLINE_PLAYERS }),
    });
