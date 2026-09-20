import { describe, expect, it } from 'vitest';
import {
  isApplyEquipUnit,
  isApplyEvent,
  isApplyInjectRequest,
  isApplyPointsUnit,
  isApplyStartRequest,
  isCommitVector,
  type ApplyEquipUnit,
  type ApplyEvent,
  type ApplyPointsUnit,
} from './apply.js';

const ZERO_VECTOR = [0, 0, 0, 0, 0, 0, 0, 0] as const;

const VALID_EQUIP_UNIT: ApplyEquipUnit = {
  index: 0,
  call: 'equip',
  itemId: 'item-1',
  defId: 'def-1',
  slot: 'weapon',
  fromHeroId: null,
  toHeroId: 'hero-1',
  displacesItemId: null,
  freedByIndex: null,
  pendingAt: [null],
  doneAt: ['hero-1'],
};

const VALID_POINTS_UNIT: ApplyPointsUnit = {
  index: 0,
  heroId: 'hero-1',
  level: 50,
  needsRespec: false,
  respecGold: 0,
  vectorBefore: ZERO_VECTOR,
  vector: ZERO_VECTOR,
  pointsPlaced: 0,
};

describe('isCommitVector', () => {
  it('accepts eight non-negative integers', () => {
    expect(isCommitVector([1, 2, 3, 4, 5, 6, 7, 8])).toBe(true);
    expect(isCommitVector(ZERO_VECTOR)).toBe(true);
  });

  it.each([
    ['a seven-element vector', [1, 2, 3, 4, 5, 6, 7]],
    ['a nine-element vector', [1, 2, 3, 4, 5, 6, 7, 8, 9]],
    ['a negative entry', [1, 2, 3, 4, 5, 6, 7, -1]],
    ['a non-integer entry', [1, 2, 3, 4, 5, 6, 7, 1.5]],
    ['not an array', 'nope'],
    ['null', null],
  ])('rejects %s', (_label, value) => {
    expect(isCommitVector(value)).toBe(false);
  });
});

describe('isApplyEquipUnit', () => {
  it('accepts a well-formed unit', () => {
    expect(isApplyEquipUnit(VALID_EQUIP_UNIT)).toBe(true);
  });

  it('accepts a bag-bound unequip unit with every location null', () => {
    expect(
      isApplyEquipUnit({
        ...VALID_EQUIP_UNIT,
        call: 'unequip',
        toHeroId: null,
        doneAt: [null],
      }),
    ).toBe(true);
  });

  it.each([
    ['index', { index: -1 }],
    ['index (non-integer)', { index: 1.5 }],
    ['call', { call: 'sell' }],
    ['itemId', { itemId: '' }],
    ['defId', { defId: 42 }],
    ['slot', { slot: null }],
    ['fromHeroId', { fromHeroId: 42 }],
    ['toHeroId', { toHeroId: 42 }],
    ['displacesItemId', { displacesItemId: 42 }],
    ['freedByIndex', { freedByIndex: -1 }],
    ['pendingAt', { pendingAt: 'not-an-array' }],
    ['pendingAt element', { pendingAt: [42] }],
    ['doneAt', { doneAt: 'not-an-array' }],
  ])('rejects a bad %s', (_field, patch) => {
    expect(isApplyEquipUnit({ ...VALID_EQUIP_UNIT, ...patch })).toBe(false);
  });

  it('rejects a non-object', () => {
    expect(isApplyEquipUnit(null)).toBe(false);
    expect(isApplyEquipUnit('unit')).toBe(false);
  });
});

describe('isApplyPointsUnit', () => {
  it('accepts a well-formed unit', () => {
    expect(isApplyPointsUnit(VALID_POINTS_UNIT)).toBe(true);
  });

  it.each([
    ['index', { index: -1 }],
    ['index (non-integer)', { index: 1.5 }],
    ['heroId', { heroId: '' }],
    ['level', { level: 'fifty' }],
    ['needsRespec', { needsRespec: 'yes' }],
    ['respecGold (negative)', { respecGold: -1 }],
    ['respecGold (non-finite)', { respecGold: Number.POSITIVE_INFINITY }],
    ['vectorBefore (seven elements)', { vectorBefore: [1, 2, 3, 4, 5, 6, 7] }],
    ['vector (negative entry)', { vector: [1, 2, 3, 4, 5, 6, 7, -1] }],
    ['pointsPlaced', { pointsPlaced: 'zero' }],
  ])('rejects a bad %s', (_field, patch) => {
    expect(isApplyPointsUnit({ ...VALID_POINTS_UNIT, ...patch })).toBe(false);
  });

  it('rejects a non-object', () => {
    expect(isApplyPointsUnit(undefined)).toBe(false);
  });
});

describe('isApplyStartRequest', () => {
  it('accepts a well-formed equip request', () => {
    expect(isApplyStartRequest({ step: 'equip', planRunId: 'run-1', units: [VALID_EQUIP_UNIT] })).toBe(true);
  });

  it('accepts a well-formed points request', () => {
    expect(isApplyStartRequest({ step: 'points', planRunId: 'run-1', units: [VALID_POINTS_UNIT] })).toBe(true);
  });

  it('accepts an empty unit list for either step', () => {
    expect(isApplyStartRequest({ step: 'equip', planRunId: 'run-1', units: [] })).toBe(true);
    expect(isApplyStartRequest({ step: 'points', planRunId: 'run-1', units: [] })).toBe(true);
  });

  it('rejects a step outside the closed pair', () => {
    expect(isApplyStartRequest({ step: 'gear', planRunId: 'run-1', units: [] })).toBe(false);
  });

  it('rejects a missing planRunId', () => {
    expect(isApplyStartRequest({ step: 'equip', units: [] })).toBe(false);
    expect(isApplyStartRequest({ step: 'equip', planRunId: '', units: [] })).toBe(false);
  });

  it('rejects an equip request carrying points units, and a points request carrying equip units', () => {
    expect(isApplyStartRequest({ step: 'equip', planRunId: 'run-1', units: [VALID_POINTS_UNIT] })).toBe(false);
    expect(isApplyStartRequest({ step: 'points', planRunId: 'run-1', units: [VALID_EQUIP_UNIT] })).toBe(false);
  });

  it('rejects a non-object', () => {
    expect(isApplyStartRequest(null)).toBe(false);
  });
});

const VALID_UNIT_EVENT: ApplyEvent = { type: 'unit', runId: 'run-1', step: 'equip', index: 0, status: 'ok' };
const VALID_COOLDOWN_EVENT: ApplyEvent = { type: 'cooldown', runId: 'run-1', step: 'equip', index: 0, resumeAtMs: 1_000 };
const VALID_RESUMED_EVENT: ApplyEvent = { type: 'resumed', runId: 'run-1', step: 'equip', index: 0 };
const VALID_DONE_EVENT: ApplyEvent = {
  type: 'done',
  runId: 'run-1',
  step: 'equip',
  result: {
    step: 'equip',
    total: 1,
    made: 1,
    skipped: [],
    failed: null,
    stop: 'finished',
    stopCode: null,
    goldSpent: 0,
    durationMs: 0,
  },
};

describe('isApplyEvent', () => {
  it.each([
    ['unit', VALID_UNIT_EVENT],
    ['cooldown', VALID_COOLDOWN_EVENT],
    ['resumed', VALID_RESUMED_EVENT],
    ['done', VALID_DONE_EVENT],
  ])('accepts a well-formed %s event', (_type, event) => {
    expect(isApplyEvent(event)).toBe(true);
  });

  it('rejects a missing runId or an unknown step', () => {
    expect(isApplyEvent({ ...VALID_UNIT_EVENT, runId: undefined })).toBe(false);
    expect(isApplyEvent({ ...VALID_UNIT_EVENT, step: 'gear' })).toBe(false);
  });

  it('rejects a unit event missing its status, or carrying a non-integer index', () => {
    const { status: _status, ...withoutStatus } = VALID_UNIT_EVENT as ApplyEvent & { status: string };
    expect(isApplyEvent(withoutStatus)).toBe(false);
    expect(isApplyEvent({ ...VALID_UNIT_EVENT, index: 1.5 })).toBe(false);
  });

  it('rejects a cooldown event missing resumeAtMs', () => {
    const { resumeAtMs: _resumeAtMs, ...withoutResumeAtMs } = VALID_COOLDOWN_EVENT as ApplyEvent & { resumeAtMs: number };
    expect(isApplyEvent(withoutResumeAtMs)).toBe(false);
  });

  it('rejects a resumed event missing index', () => {
    const { index: _index, ...withoutIndex } = VALID_RESUMED_EVENT as ApplyEvent & { index: number };
    expect(isApplyEvent(withoutIndex)).toBe(false);
  });

  it('rejects a done event missing result.stop, or carrying a stop value outside the closed seven', () => {
    const badStop = { ...VALID_DONE_EVENT, result: { ...(VALID_DONE_EVENT as { result: object }).result, stop: 'exploded' } };
    expect(isApplyEvent(badStop)).toBe(false);
    const badMade = { ...VALID_DONE_EVENT, result: { ...(VALID_DONE_EVENT as { result: object }).result, made: 1.5 } };
    expect(isApplyEvent(badMade)).toBe(false);
  });

  it('rejects an unknown event type', () => {
    expect(isApplyEvent({ ...VALID_UNIT_EVENT, type: 'progress' })).toBe(false);
  });

  it('rejects a non-object', () => {
    expect(isApplyEvent(null)).toBe(false);
  });

  it('switches exhaustively over the four members with a never default (compile-time proof, run over every fixture)', () => {
    function labelFor(event: ApplyEvent): string {
      switch (event.type) {
        case 'unit':
          return 'unit';
        case 'cooldown':
          return 'cooldown';
        case 'resumed':
          return 'resumed';
        case 'done':
          return 'done';
        default: {
          const exhaustive: never = event;
          return exhaustive;
        }
      }
    }
    expect(labelFor(VALID_UNIT_EVENT)).toBe('unit');
    expect(labelFor(VALID_COOLDOWN_EVENT)).toBe('cooldown');
    expect(labelFor(VALID_RESUMED_EVENT)).toBe('resumed');
    expect(labelFor(VALID_DONE_EVENT)).toBe('done');
  });
});

describe('isApplyInjectRequest', () => {
  const VALID_REQUEST = { runId: 'run-1', events: [VALID_UNIT_EVENT, VALID_DONE_EVENT], gapMs: 100 };

  it('accepts a well-formed request, including an empty event list', () => {
    expect(isApplyInjectRequest(VALID_REQUEST)).toBe(true);
    expect(isApplyInjectRequest({ runId: 'run-1', events: [], gapMs: 0 })).toBe(true);
  });

  it('rejects a non-array events field', () => {
    expect(isApplyInjectRequest({ ...VALID_REQUEST, events: 'nope' })).toBe(false);
  });

  it('rejects a negative gapMs', () => {
    expect(isApplyInjectRequest({ ...VALID_REQUEST, gapMs: -1 })).toBe(false);
  });

  it('rejects a missing runId', () => {
    const { runId: _runId, ...withoutRunId } = VALID_REQUEST;
    expect(isApplyInjectRequest(withoutRunId)).toBe(false);
  });

  it('refuses the whole payload when one event among otherwise-valid ones is malformed', () => {
    expect(isApplyInjectRequest({ ...VALID_REQUEST, events: [VALID_UNIT_EVENT, { type: 'unit' }, VALID_DONE_EVENT] })).toBe(false);
  });

  it('rejects a non-object', () => {
    expect(isApplyInjectRequest(null)).toBe(false);
  });
});
