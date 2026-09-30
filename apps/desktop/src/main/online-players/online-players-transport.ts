import { net } from 'electron';

/**
 * The online-players path's only socket, and the only file allowed to name the host it reads —
 * the same shape the market and usage-ping transports hold. Reads only: there is no method field
 * here at all, so the request can never be anything but a GET, and the guards in
 * `game-api/boundaries.test.ts` forbid one from appearing.
 *
 * It carries nothing about the player: no install id, no account, no session token.
 */

export const ONLINE_PLAYERS_URL = 'https://api.bombfarm-companion.app/v1/online';

const REQUEST_TIMEOUT_MS = 10_000;

export interface OnlinePlayersHttpResponse {
  readonly status: number;
  readonly body: string;
}

export type OnlinePlayersHttpGet = () => Promise<OnlinePlayersHttpResponse>;

export const onlinePlayersHttpGet: OnlinePlayersHttpGet = async () => {
  const response = await net.fetch(ONLINE_PLAYERS_URL, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  return { status: response.status, body: response.ok ? await response.text() : '' };
};
