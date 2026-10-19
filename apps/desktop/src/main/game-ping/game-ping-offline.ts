import type { GamePingProbe } from './game-ping-transport.js';

/** The round trip offline mode shows: nothing to measure there, and a value that never moves is
 *  what a fixture is for. */
export const OFFLINE_GAME_PING_MS = 48;

export const offlineGamePingProbe: GamePingProbe = () => Promise.resolve(OFFLINE_GAME_PING_MS);
