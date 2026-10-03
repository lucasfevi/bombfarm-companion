import { COLLECTION_AXES } from '@bombfarm/contracts';
import { isPlainObject } from '../type-guards.js';
import {
  COLLECTION_AXIS_SYMBOLS,
  COLLECTIONS_EFFECT_SYMBOLS,
  COLLECTIONS_PIECE_SYMBOLS,
  COLLECTIONS_SET_SYMBOLS,
  COLLECTIONS_TOP_LEVEL_SYMBOLS,
  wireKey,
  type CollectionsWireSymbol,
} from './lexicon.js';

function tokens(symbols: readonly CollectionsWireSymbol[]): readonly string[] {
  return symbols.map(wireKey);
}

const AXIS_TOKENS = tokens(COLLECTION_AXES.map((axis) => COLLECTION_AXIS_SYMBOLS[axis]));

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === expected.length && expected.every((key) => Object.hasOwn(value, key));
}

function isEveryObject(value: unknown, matches: (entry: Record<string, unknown>) => boolean): boolean {
  return Array.isArray(value) && value.every((entry) => isPlainObject(entry) && matches(entry));
}

function isAxisRecord(value: unknown): boolean {
  return isPlainObject(value) && hasExactKeys(value, AXIS_TOKENS);
}

function isEffectBody(effect: Record<string, unknown>): boolean {
  return hasExactKeys(effect, tokens(COLLECTIONS_EFFECT_SYMBOLS));
}

function isSetBody(set: Record<string, unknown>): boolean {
  return hasExactKeys(set, tokens(COLLECTIONS_SET_SYMBOLS)) && isEveryObject(set[wireKey('setEffects')], isEffectBody);
}

function isPieceBody(piece: Record<string, unknown>): boolean {
  return hasExactKeys(piece, tokens(COLLECTIONS_PIECE_SYMBOLS));
}

/**
 * The Collections state is not an account section, so it has no entry in the route fingerprints;
 * it is told apart the same way they are — by its complete key set, at every level. A key the
 * game adds or drops anywhere in the body is "not this body", so a reshaped body is refused for
 * review rather than read on a guess.
 */
export function isCollectionsStateBody(body: unknown): boolean {
  if (!isPlainObject(body)) return false;
  return (
    hasExactKeys(body, tokens(COLLECTIONS_TOP_LEVEL_SYMBOLS)) &&
    isAxisRecord(body[wireKey('caps')]) &&
    isAxisRecord(body[wireKey('totals')]) &&
    isAxisRecord(body[wireKey('raw')]) &&
    isEveryObject(body[wireKey('sets')], isSetBody) &&
    isEveryObject(body[wireKey('pieces')], isPieceBody)
  );
}
