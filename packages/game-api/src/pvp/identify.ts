import { isPlainObject } from '../type-guards.js';
import { wireKey } from './lexicon.js';

export type PvpRoute = 'duel' | 'film' | 'state' | 'ranking';

/**
 * A duel result is the body that says who won and which film it made; a film is the body that
 * carries frames for a phase; the state is the standing the client polls (the object a result
 * carries nested under its state key, here at the top level); a ranking names its board and carries the
 * top hundred with the player's own entry. None is an account section, so none has a
 * complete-key-set fingerprint: a result's state object grows with the feature and a film is
 * ~2 MB of frames, and refusing either over a key the game added would drop the one body that
 * cannot be re-fetched. Each is told apart by the keys only it carries at the top level; a body
 * matching more than one is refused rather than guessed at.
 */
export function identifyPvpBody(body: unknown): PvpRoute | null {
  if (!isPlainObject(body)) return null;
  const matches: PvpRoute[] = [];
  if (typeof body[wireKey('won')] === 'boolean' && typeof body[wireKey('filmId')] === 'number') matches.push('duel');
  if (Array.isArray(body[wireKey('filmFrames')]) && typeof body[wireKey('phase')] === 'number') matches.push('film');
  if (
    typeof body[wireKey('statePoints')] === 'number' &&
    typeof body[wireKey('stateTier')] === 'string' &&
    Array.isArray(body[wireKey('stateSquad')])
  ) {
    matches.push('state');
  }
  if (
    typeof body[wireKey('rankingBy')] === 'string' &&
    Array.isArray(body[wireKey('rankingTop')]) &&
    isPlainObject(body[wireKey('rankingMe')])
  ) {
    matches.push('ranking');
  }
  return matches.length === 1 ? (matches[0] as PvpRoute) : null;
}
