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
import {
  COLLECTION_AXIS_SYMBOLS,
  COLLECTIONS_EFFECT_SYMBOLS,
  COLLECTIONS_PIECE_SYMBOLS,
  COLLECTIONS_SET_SYMBOLS,
  COLLECTIONS_TOP_LEVEL_SYMBOLS,
  wireKey,
  type CollectionsWireSymbol,
} from './lexicon.js';
import { isCollectionsSnapshot } from './snapshot-shape.js';

const PAGES = 6;

/** What a read had to leave out to produce a snapshot: a key the lexicon does not declare, at any
 *  level, or an effect on an axis the contract does not name. Zero for a body of the exact shape. */
export interface CollectionsRead {
  readonly snapshot: CollectionsSnapshot;
  readonly ignored: number;
}

interface Tally {
  ignored: number;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
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

function countUndeclaredKeys(record: Record<string, unknown>, declared: ReadonlySet<string>, tally: Tally): void {
  for (const key of Object.keys(record)) {
    if (!declared.has(key)) tally.ignored += 1;
  }
}

function declaredKeys(symbols: readonly CollectionsWireSymbol[]): ReadonlySet<string> {
  return new Set(symbols.map(wireKey));
}

const AXIS_KEYS: ReadonlySet<string> = new Set(AXIS_BY_TOKEN.keys());
const TOP_LEVEL_KEYS = declaredKeys(COLLECTIONS_TOP_LEVEL_SYMBOLS);
const SET_KEYS = declaredKeys(COLLECTIONS_SET_SYMBOLS);
const EFFECT_KEYS = declaredKeys(COLLECTIONS_EFFECT_SYMBOLS);
const PIECE_KEYS = declaredKeys(COLLECTIONS_PIECE_SYMBOLS);

function parseAxisValues(value: unknown, tally: Tally): CollectionAxisValues | null {
  if (!isPlainObject(value)) return null;
  countUndeclaredKeys(value, AXIS_KEYS, tally);
  const values: Partial<Record<CollectionAxis, number>> = {};
  for (const axis of COLLECTION_AXES) {
    const amount = finiteNumber(value[wireKey(COLLECTION_AXIS_SYMBOLS[axis])]);
    if (amount === null) return null;
    values[axis] = amount;
  }
  return values as CollectionAxisValues;
}

/** The axis is looked up first: an effect on an axis the contract does not name is skipped whole,
 *  whatever else is in it, so the game adding an eleventh axis cannot blank the ten the screen
 *  can draw. */
function parseEffects(value: unknown, tally: Tally): CollectionEffectState[] | null {
  if (!Array.isArray(value)) return null;
  const effects: CollectionEffectState[] = [];
  for (const entry of value) {
    if (!isPlainObject(entry)) return null;
    const axisToken = entry[wireKey('effectAxis')];
    if (typeof axisToken !== 'string') return null;
    const axis = AXIS_BY_TOKEN.get(axisToken);
    if (axis === undefined) {
      tally.ignored += 1;
      continue;
    }
    countUndeclaredKeys(entry, EFFECT_KEYS, tally);
    const pageValues = numberRow(entry[wireKey('effectPages')], PAGES);
    const now = finiteNumber(entry[wireKey('effectNow')]);
    if (pageValues === null || now === null) return null;
    effects.push({ axis, pageValues, now });
  }
  return effects;
}

function parseSet(value: unknown, tally: Tally): CollectionSetState | null {
  if (!isPlainObject(value)) return null;
  countUndeclaredKeys(value, SET_KEYS, tally);
  const code = value[wireKey('setCode')];
  const level = finiteNumber(value[wireKey('setLevel')]);
  const piecesByPage = numberRow(value[wireKey('setPerPage')], PAGES);
  const effects = parseEffects(value[wireKey('setEffects')], tally);
  if (typeof code !== 'string' || level === null || piecesByPage === null || effects === null) return null;
  return { code, level, piecesByPage, effects };
}

function parsePiece(value: unknown, tally: Tally): CollectionPieceState | null {
  if (!isPlainObject(value)) return null;
  countUndeclaredKeys(value, PIECE_KEYS, tally);
  const defId = value[wireKey('pieceDefId')];
  const set = value[wireKey('pieceSet')];
  const slot = finiteNumber(value[wireKey('pieceSlot')]);
  const level = finiteNumber(value[wireKey('pieceLevel')]);
  const sacrificedMask = finiteNumber(value[wireKey('pieceMask')]);
  const pendingMask = finiteNumber(value[wireKey('piecePending')]);
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
 * every piece, and says how much it left out. `null` on any missing required key, wrong type or
 * figure out of range ({@link isCollectionsSnapshot}) — because a half-read book would draw
 * progress the account does not have. Keys the game adds are ignored and counted, so the reader
 * stays usable when the strict identifier has begun to refuse the body and the caller can still
 * flag it. The version, the enabled flag, the upgrade table and the two page counters the server
 * derives from the per-page counts are not read.
 */
export function readCollectionsState(body: unknown): CollectionsRead | null {
  if (!isPlainObject(body)) return null;
  const tally: Tally = { ignored: 0 };
  countUndeclaredKeys(body, TOP_LEVEL_KEYS, tally);
  const partialPct = finiteNumber(body[wireKey('partialPct')]);
  const caps = parseAxisValues(body[wireKey('caps')], tally);
  const totals = parseAxisValues(body[wireKey('totals')], tally);
  const raw = parseAxisValues(body[wireKey('raw')], tally);
  const rawSets = body[wireKey('sets')];
  const rawPieces = body[wireKey('pieces')];
  if (partialPct === null || caps === null || totals === null || raw === null) return null;
  if (!Array.isArray(rawSets) || !Array.isArray(rawPieces)) return null;
  const sets = mapAll(rawSets, (set) => parseSet(set, tally));
  const pieces = mapAll(rawPieces, (piece) => parsePiece(piece, tally));
  if (sets === null || pieces === null) return null;
  const snapshot = { partialPct, caps, totals, raw, sets, pieces };
  return isCollectionsSnapshot(snapshot) ? { snapshot, ignored: tally.ignored } : null;
}

export function parseCollectionsState(body: unknown): CollectionsSnapshot | null {
  return readCollectionsState(body)?.snapshot ?? null;
}
