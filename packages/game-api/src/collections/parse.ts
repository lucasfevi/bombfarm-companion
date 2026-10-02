import {
  COLLECTION_AXES,
  type CollectionAxis,
  type CollectionAxisValues,
  type CollectionEffectState,
  type CollectionPieceState,
  type CollectionSetState,
  type CollectionsSnapshot,
} from '@bombfarm/contracts';
import { isPlainObject } from '../type-guards.js';
import { COLLECTION_AXIS_SYMBOLS, wireKey } from './lexicon.js';

const PAGES = 6;
const PIECES_PER_PAGE = 8;

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function wholeNumber(value: unknown): number | null {
  const number = finiteNumber(value);
  return number !== null && Number.isInteger(number) ? number : null;
}

function mapAll<T, R>(values: readonly T[], read: (value: T) => R | null): R[] | null {
  const out: R[] = [];
  for (const value of values) {
    const item = read(value);
    if (item === null) return null;
    out.push(item);
  }
  return out;
}

function numberRow(value: unknown, length: number): number[] | null {
  if (!Array.isArray(value) || value.length !== length) return null;
  return mapAll(value, finiteNumber);
}

const AXIS_BY_TOKEN: ReadonlyMap<string, CollectionAxis> = new Map(
  COLLECTION_AXES.map((axis) => [wireKey(COLLECTION_AXIS_SYMBOLS[axis]), axis]),
);

function parseAxisValues(value: unknown): CollectionAxisValues | null {
  if (!isPlainObject(value)) return null;
  const values: Partial<Record<CollectionAxis, number>> = {};
  for (const axis of COLLECTION_AXES) {
    const amount = finiteNumber(value[wireKey(COLLECTION_AXIS_SYMBOLS[axis])]);
    if (amount === null) return null;
    values[axis] = amount;
  }
  return values as CollectionAxisValues;
}

/** An effect on an axis the contract does not name is skipped rather than refused: the game adding
 *  an eleventh axis must not blank the ten the screen can draw. */
function parseEffects(value: unknown): CollectionEffectState[] | null {
  if (!Array.isArray(value)) return null;
  const effects: CollectionEffectState[] = [];
  for (const entry of value) {
    if (!isPlainObject(entry)) return null;
    const axisToken = entry[wireKey('effectAxis')];
    const pageValues = numberRow(entry[wireKey('effectPages')], PAGES);
    const now = finiteNumber(entry[wireKey('effectNow')]);
    if (typeof axisToken !== 'string' || pageValues === null || now === null) return null;
    const axis = AXIS_BY_TOKEN.get(axisToken);
    if (axis !== undefined) effects.push({ axis, pageValues, now });
  }
  return effects;
}

function parsePiecesByPage(value: unknown): number[] | null {
  if (!Array.isArray(value) || value.length !== PAGES) return null;
  return mapAll(value, (count) => {
    const pieces = wholeNumber(count);
    return pieces !== null && pieces >= 0 && pieces <= PIECES_PER_PAGE ? pieces : null;
  });
}

function parseSet(value: unknown): CollectionSetState | null {
  if (!isPlainObject(value)) return null;
  const code = value[wireKey('setCode')];
  const level = finiteNumber(value[wireKey('setLevel')]);
  const piecesByPage = parsePiecesByPage(value[wireKey('setPerPage')]);
  const effects = parseEffects(value[wireKey('setEffects')]);
  if (typeof code !== 'string' || level === null || piecesByPage === null || effects === null) return null;
  return { code, level, piecesByPage, effects };
}

function mask(value: unknown): number | null {
  const bits = wholeNumber(value);
  return bits !== null && bits >= 0 ? bits : null;
}

function parsePiece(value: unknown): CollectionPieceState | null {
  if (!isPlainObject(value)) return null;
  const defId = value[wireKey('pieceDefId')];
  const set = value[wireKey('pieceSet')];
  const slot = wholeNumber(value[wireKey('pieceSlot')]);
  const level = finiteNumber(value[wireKey('pieceLevel')]);
  const sacrificedMask = mask(value[wireKey('pieceMask')]);
  const pendingMask = mask(value[wireKey('piecePending')]);
  if (
    typeof defId !== 'string' ||
    typeof set !== 'string' ||
    slot === null ||
    level === null ||
    sacrificedMask === null ||
    pendingMask === null
  ) {
    return null;
  }
  return { defId, set, slot, level, sacrificedMask, pendingMask };
}

/**
 * Reads the Collections state: the axis caps and totals, every set book with its progress, and
 * every piece. `null` on any missing required key or wrong type — a wrong-length page list, a number
 * that is not finite — because a half-read book would draw progress the account does not have.
 * Keys the game adds are ignored, so the parser stays usable when the strict identifier has begun
 * to refuse the body. The version, the enabled flag, the upgrade table and the two page counters
 * the server derives from the per-page counts are not read.
 */
export function parseCollectionsState(body: unknown): CollectionsSnapshot | null {
  if (!isPlainObject(body)) return null;
  const partialPct = finiteNumber(body[wireKey('partialPct')]);
  const caps = parseAxisValues(body[wireKey('caps')]);
  const totals = parseAxisValues(body[wireKey('totals')]);
  const raw = parseAxisValues(body[wireKey('raw')]);
  const rawSets = body[wireKey('sets')];
  const rawPieces = body[wireKey('pieces')];
  if (partialPct === null || caps === null || totals === null || raw === null) return null;
  if (!Array.isArray(rawSets) || !Array.isArray(rawPieces)) return null;
  const sets = mapAll(rawSets, parseSet);
  const pieces = mapAll(rawPieces, parsePiece);
  if (sets === null || pieces === null) return null;
  return { partialPct, caps, totals, raw, sets, pieces };
}
