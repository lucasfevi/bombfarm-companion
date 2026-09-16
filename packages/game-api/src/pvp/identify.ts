import { isPlainObject } from '../type-guards.js';
import { wireKey } from './lexicon.js';

export type PvpRoute = 'duel' | 'film';

/**
 * A duel result is the body that says who won and which film it made; a film is the body that
 * carries frames for a phase. Neither is an account section, so neither has a complete-key-set
 * fingerprint: a result's state object grows with the feature and a film is ~2 MB of frames, and
 * refusing either over a key the game added would drop the one body that cannot be re-fetched.
 * The two are told apart by the pair of keys only each carries; a body carrying both pairs is
 * refused rather than guessed at.
 */
export function identifyPvpBody(body: unknown): PvpRoute | null {
  if (!isPlainObject(body)) return null;
  const duel = typeof body[wireKey('won')] === 'boolean' && typeof body[wireKey('filmId')] === 'number';
  const film = Array.isArray(body[wireKey('filmFrames')]) && typeof body[wireKey('phase')] === 'number';
  if (duel === film) return null;
  return duel ? 'duel' : 'film';
}
