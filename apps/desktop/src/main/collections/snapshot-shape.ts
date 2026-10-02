import { COLLECTION_AXES, type CollectionsSnapshot } from '@bombfarm/contracts';

const PAGES = 6;

type JsonObject = Readonly<Record<string, unknown>>;

function isRecord(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNumberRow(value: unknown, length: number): boolean {
  return Array.isArray(value) && value.length === length && value.every(isNumber);
}

function isAxisValues(value: unknown): boolean {
  return isRecord(value) && COLLECTION_AXES.every((axis) => isNumber(value[axis]));
}

function isEffect(value: unknown): boolean {
  return (
    isRecord(value) &&
    COLLECTION_AXES.some((axis) => axis === value['axis']) &&
    isNumberRow(value['pageValues'], PAGES) &&
    isNumber(value['now'])
  );
}

function isSet(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value['code'] === 'string' &&
    isNumber(value['level']) &&
    isNumberRow(value['piecesByPage'], PAGES) &&
    Array.isArray(value['effects']) &&
    value['effects'].every(isEffect)
  );
}

function isPiece(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value['defId'] === 'string' &&
    typeof value['set'] === 'string' &&
    isNumber(value['slot']) &&
    isNumber(value['level']) &&
    isNumber(value['sacrificedMask']) &&
    isNumber(value['pendingMask'])
  );
}

/** Whether a value read back from disk is still the contract's snapshot — a row written by a
 *  build whose contract has since moved fails here instead of reaching the screen half-formed. */
export function isCollectionsSnapshot(value: unknown): value is CollectionsSnapshot {
  return (
    isRecord(value) &&
    isNumber(value['partialPct']) &&
    isAxisValues(value['caps']) &&
    isAxisValues(value['totals']) &&
    isAxisValues(value['raw']) &&
    Array.isArray(value['sets']) &&
    value['sets'].every(isSet) &&
    Array.isArray(value['pieces']) &&
    value['pieces'].every(isPiece)
  );
}
