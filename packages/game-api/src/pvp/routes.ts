import { PVP_RANKING_BOARD } from './lexicon.js';

/** The standing the client polls; the app asks for it itself when the PVP tab opens. */
export const PVP_STATE_PATH = '/pvp/state';

/** The client asks for the top hundred when the player opens the ranking; the app asks the same
 *  way, so the server sees a request it already serves. Only the player's own entry is kept. */
export const PVP_RANKING_LIMIT = 100;

export function pvpRankingPath(limit: number = PVP_RANKING_LIMIT): string {
  return `/ranking?by=${PVP_RANKING_BOARD}&limit=${String(limit)}`;
}
