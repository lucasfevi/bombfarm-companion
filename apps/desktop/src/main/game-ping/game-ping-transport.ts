import { connect } from 'node:net';

/**
 * The ping readout's only socket. It opens a TCP connection to the game's host and closes it the
 * moment the handshake completes: no bytes are written, no request is made, and nothing about
 * the player or the session token is involved, so the host sees no more than a port probe. The
 * clock starts once the name is resolved, so the number is the network round trip and not the
 * lookup. It is the only file that may import `node:net`; `game-api/boundaries.test.ts` holds
 * that line.
 */

const GAME_HOST = 'app.bombfarm.net';
const GAME_PORT = 443;
const CONNECT_TIMEOUT_MS = 5_000;

/** Resolves with the round trip in milliseconds; rejects on a refusal, a timeout or no network. */
export type GamePingProbe = () => Promise<number>;

export const gamePingProbe: GamePingProbe = () =>
  new Promise<number>((resolve, reject) => {
    const socket = connect({ host: GAME_HOST, port: GAME_PORT });
    let resolvedAt = performance.now();
    socket.setTimeout(CONNECT_TIMEOUT_MS);
    socket.once('lookup', () => {
      resolvedAt = performance.now();
    });
    socket.once('connect', () => {
      const elapsed = performance.now() - resolvedAt;
      socket.destroy();
      resolve(Math.max(1, Math.round(elapsed)));
    });
    socket.once('timeout', () => {
      socket.destroy();
      reject(new Error('connect timed out'));
    });
    socket.once('error', (error) => {
      socket.destroy();
      reject(error);
    });
  });
