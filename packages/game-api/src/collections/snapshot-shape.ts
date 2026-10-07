import { COLLECTION_AXES, type CollectionsSnapshot } from '@bombfarm/contracts';
import { isPlainObject } from '../type-guards.js';

const PAGES = 6;
const PIECES_PER_PAGE = 8;
const PERCENT_MAX = 100;

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isWholeCount(value: unknown): value is number {
  return isCount(value) && Number.isInteger(value);
}

function isCountRow(value: unknown, length: number): boolean {
  return Array.isArray(value) && value.length === length && value.every(isCount);
}

function isAxisValues(value: unknown): boolean {
  return isPlainObject(value) && COLLECTION_AXES.every((axis) => isCount(value[axis]));
}

function isEffect(value: unknown): boolean {
  return (
    isPlainObject(value) &&
    COLLECTION_AXES.some((axis) => axis === value['axis']) &&
    isCountRow(value['pageValues'], PAGES) &&
    isCount(value['now'])
  );
}

function isPiecesByPage(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.length === PAGES &&
    value.every((pieces) => isWholeCount(pieces) && pieces <= PIECES_PER_PAGE)
  );
}

function isSet(value: unknown): boolean {
  return (
    isPlainObject(value) &&
    typeof value['code'] === 'string' &&
    isCount(value['level']) &&
    isPiecesByPage(value['piecesByPage']) &&
    Array.isArray(value['effects']) &&
    value['effects'].every(isEffect)
  );
}

function isPiece(value: unknown): boolean {
  return (
    isPlainObject(value) &&
    typeof value['defId'] === 'string' &&
    typeof value['set'] === 'string' &&
    isWholeCount(value['slot']) &&
    isCount(value['level']) &&
    isWholeCount(value['sacrificedMask']) &&
    isWholeCount(value['pendingMask'])
  );
}

/**
 * Whether a value is the contract's snapshot with every figure in range: percentages and levels
 * not negative, the partial-page share within 0 to 100, a page holding a whole 0 to 8 pieces,
 * masks whole and not negative. The parser ends on this check and the desktop's stored row is read
 * back through it, so a row can never be looser than what a read would have been allowed to store.
 */
export function isCollectionsSnapshot(value: unknown): value is CollectionsSnapshot {
  return (
    isPlainObject(value) &&
    isCount(value['partialPct']) &&
    value['partialPct'] <= PERCENT_MAX &&
    isAxisValues(value['caps']) &&
    isAxisValues(value['totals']) &&
    isAxisValues(value['raw']) &&
    Array.isArray(value['sets']) &&
    value['sets'].every(isSet) &&
    Array.isArray(value['pieces']) &&
    value['pieces'].every(isPiece)
  );
}
