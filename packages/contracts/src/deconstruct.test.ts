import { describe, expect, it } from 'vitest';
import {
  DECONSTRUCT_BATCH_MAX,
  isDeconstructEvent,
  isDeconstructInjectRequest,
  isDeconstructStartRequest,
  type DeconstructEvent,
} from './deconstruct.js';

const ids = (count: number): string[] => Array.from({ length: count }, (_, index) => String(1000 + index));

const BURNED_EVENT: DeconstructEvent = {
  type: 'done',
  runId: 'run-1',
  itemIds: ['11', '12'],
  result: { status: 'burned', burned: 2, gained: 90, essence: 102570 },
};

describe('isDeconstructStartRequest', () => {
  it('accepts one id and a full batch of one hundred', () => {
    expect(isDeconstructStartRequest({ itemIds: ['9001'] })).toBe(true);
    expect(isDeconstructStartRequest({ itemIds: ids(DECONSTRUCT_BATCH_MAX) })).toBe(true);
  });

  it('rejects an empty selection and a hundred-and-first id', () => {
    expect(isDeconstructStartRequest({ itemIds: [] })).toBe(false);
    expect(isDeconstructStartRequest({ itemIds: ids(DECONSTRUCT_BATCH_MAX + 1) })).toBe(false);
  });

  it('rejects a repeated id', () => {
    expect(isDeconstructStartRequest({ itemIds: ['5', '6', '5'] })).toBe(false);
  });

  it.each([
    ['a comma inside an id', ['1,2']],
    ['a signed id', ['-4']],
    ['a decimal id', ['4.5']],
    ['an id with a space', ['4 5']],
    ['an empty id', ['']],
    ['a numeric id', [7]],
  ])('rejects %s', (_label, itemIds) => {
    expect(isDeconstructStartRequest({ itemIds })).toBe(false);
  });

  it.each([
    ['a bare array', ['1']],
    ['null', null],
    ['a missing list', {}],
    ['a string list', { itemIds: '1,2' }],
  ])('rejects %s', (_label, value) => {
    expect(isDeconstructStartRequest(value)).toBe(false);
  });
});

describe('isDeconstructEvent', () => {
  it('accepts a burned, a refused and a failed outcome', () => {
    expect(isDeconstructEvent(BURNED_EVENT)).toBe(true);
    expect(isDeconstructEvent({ ...BURNED_EVENT, result: { status: 'refused', code: 'ITEM_LOCKED' } })).toBe(true);
    expect(isDeconstructEvent({ ...BURNED_EVENT, result: { status: 'failed', reason: 'cooldown' } })).toBe(true);
  });

  it.each([
    ['an unknown event type', { ...BURNED_EVENT, type: 'progress' }],
    ['an empty run id', { ...BURNED_EVENT, runId: '' }],
    ['no item ids', { ...BURNED_EVENT, itemIds: [] }],
    ['a non-numeric item id', { ...BURNED_EVENT, itemIds: ['abc'] }],
    ['a negative burn count', { ...BURNED_EVENT, result: { status: 'burned', burned: -1, gained: 0, essence: 0 } }],
    ['a fractional gain', { ...BURNED_EVENT, result: { status: 'burned', burned: 1, gained: 1.5, essence: 0 } }],
    ['a burned result without a balance', { ...BURNED_EVENT, result: { status: 'burned', burned: 1, gained: 1 } }],
    ['a refusal with no code', { ...BURNED_EVENT, result: { status: 'refused', code: '' } }],
    ['an unknown failure reason', { ...BURNED_EVENT, result: { status: 'failed', reason: 'gremlins' } }],
    ['an unknown status', { ...BURNED_EVENT, result: { status: 'maybe' } }],
    ['no result', { type: 'done', runId: 'run-1', itemIds: ['1'] }],
    ['null', null],
  ])('rejects %s', (_label, value) => {
    expect(isDeconstructEvent(value)).toBe(false);
  });
});

describe('isDeconstructInjectRequest', () => {
  it('accepts a list of valid events, including none', () => {
    expect(isDeconstructInjectRequest({ events: [BURNED_EVENT] })).toBe(true);
    expect(isDeconstructInjectRequest({ events: [] })).toBe(true);
  });

  it('rejects a list that carries one malformed event', () => {
    expect(isDeconstructInjectRequest({ events: [BURNED_EVENT, { type: 'done' }] })).toBe(false);
  });

  it.each([
    ['null', null],
    ['no events key', {}],
    ['events that are not a list', { events: BURNED_EVENT }],
  ])('rejects %s', (_label, value) => {
    expect(isDeconstructInjectRequest(value)).toBe(false);
  });
});
