import { describe, expect, it } from 'vitest';
import type { DeconstructDoneEvent } from '@bombfarm/contracts';
import {
  deconstructRunReducer,
  IDLE_DECONSTRUCT_RUN,
  isBurning,
  justSettled,
  type DeconstructRunAction,
  type DeconstructRunState,
} from './deconstruct-run-reducer';

function fold(actions: readonly DeconstructRunAction[], from: DeconstructRunState = IDLE_DECONSTRUCT_RUN): DeconstructRunState {
  return actions.reduce(deconstructRunReducer, from);
}

function done(result: DeconstructDoneEvent['result'], runId = 'r1'): DeconstructRunAction {
  return { kind: 'done', event: { type: 'done', runId, itemIds: ['1', '2'], result } };
}

describe('the deconstruct run reducer', () => {
  it('goes idle, starting, running as a burn is asked for and accepted', () => {
    expect(fold([{ kind: 'starting' }])).toEqual({ status: 'starting' });
    expect(fold([{ kind: 'starting' }, { kind: 'began', runId: 'r1', itemIds: ['1', '2'] }])).toEqual({
      status: 'running',
      runId: 'r1',
      itemIds: ['1', '2'],
    });
  });

  it('settles a burned answer with what it paid and the balance it left', () => {
    const state = fold([{ kind: 'starting' }, { kind: 'began', runId: 'r1', itemIds: ['1'] }, done({ status: 'burned', burned: 2, gained: 90, essence: 1_090 })]);
    expect(state).toEqual({
      status: 'result',
      runId: 'r1',
      outcome: { kind: 'burned', burned: 2, gained: 90, essence: 1_090 },
    });
  });

  it('settles a refusal with the server code, untouched', () => {
    expect(fold([{ kind: 'starting' }, done({ status: 'refused', code: 'ITEM_EQUIPPED' })])).toMatchObject({
      status: 'result',
      outcome: { kind: 'refused', code: 'ITEM_EQUIPPED' },
    });
  });

  it('settles a failure with its reason', () => {
    expect(fold([{ kind: 'starting' }, done({ status: 'failed', reason: 'network' })])).toMatchObject({
      status: 'result',
      outcome: { kind: 'failed', reason: 'network' },
    });
  });

  it('settles a start that main refused, with no run behind it', () => {
    expect(fold([{ kind: 'starting' }, { kind: 'start-refused', reason: 'busy' }])).toEqual({
      status: 'result',
      runId: null,
      outcome: { kind: 'start-refused', reason: 'busy' },
    });
  });

  it('adopts an answer for a run it did not start, as the smoke injects one', () => {
    expect(fold([done({ status: 'burned', burned: 1, gained: 5, essence: 5 })])).toMatchObject({ status: 'result', runId: 'r1' });
  });

  it('takes an answer that beats the start reply and does not fall back to running when the reply lands', () => {
    const state = fold([
      { kind: 'starting' },
      done({ status: 'burned', burned: 1, gained: 5, essence: 5 }),
      { kind: 'began', runId: 'r1', itemIds: ['1'] },
    ]);
    expect(state.status).toBe('result');
  });

  it('ignores a second request while one is in flight', () => {
    const running = fold([{ kind: 'starting' }, { kind: 'began', runId: 'r1', itemIds: ['1'] }]);
    expect(deconstructRunReducer(running, { kind: 'starting' })).toBe(running);
    const starting = fold([{ kind: 'starting' }]);
    expect(deconstructRunReducer(starting, { kind: 'starting' })).toBe(starting);
  });

  it('does not let a refused start overwrite a run that is already going', () => {
    const running = fold([{ kind: 'starting' }, { kind: 'began', runId: 'r1', itemIds: ['1'] }]);
    expect(deconstructRunReducer(running, { kind: 'start-refused', reason: 'busy' })).toBe(running);
  });

  it('dismisses a result back to idle, and does nothing to anything else', () => {
    const result = fold([done({ status: 'refused', code: 'X' })]);
    expect(deconstructRunReducer(result, { kind: 'dismiss' })).toBe(IDLE_DECONSTRUCT_RUN);
    const running = fold([{ kind: 'starting' }]);
    expect(deconstructRunReducer(running, { kind: 'dismiss' })).toBe(running);
  });

  it('lets a new burn replace a result the player left on screen', () => {
    const result = fold([done({ status: 'refused', code: 'X' })]);
    expect(deconstructRunReducer(result, { kind: 'starting' })).toEqual({ status: 'starting' });
  });
});

describe('what the page derives from the status', () => {
  it('calls a run burning from the request until the answer', () => {
    expect(isBurning({ status: 'starting' })).toBe(true);
    expect(isBurning({ status: 'running', runId: 'r', itemIds: [] })).toBe(true);
    expect(isBurning(IDLE_DECONSTRUCT_RUN)).toBe(false);
    expect(isBurning({ status: 'result', runId: null, outcome: { kind: 'failed', reason: 'error' } })).toBe(false);
  });

  it('knows the moment a run settles and no other', () => {
    expect(justSettled('running', 'result')).toBe(true);
    expect(justSettled('idle', 'result')).toBe(true);
    expect(justSettled('result', 'result')).toBe(false);
    expect(justSettled('result', 'idle')).toBe(false);
  });
});
