import { describe, expect, it } from 'vitest';
import type { ForgeRunResult, ForgeStopReason } from '@bombfarm/contracts';
import { EMPTY_FORGE_QUEUE, forgeQueueReducer, type ForgeQueueAction, type ForgeQueueState } from './forge-queue-reducer';

function result(stop: ForgeStopReason, overrides: Partial<ForgeRunResult> = {}): ForgeRunResult {
  return {
    itemId: 'a',
    from: 8,
    to: stop === 'target' ? 12 : 10,
    target: 12,
    stop,
    reached: stop === 'target',
    rolls: 4,
    fails: 1,
    crits: 0,
    safeJumps: 0,
    spent: 4_000,
    walletAfter: 1_000,
    durationMs: 8_000,
    ...overrides,
  };
}

function fold(actions: ForgeQueueAction[], from: ForgeQueueState = EMPTY_FORGE_QUEUE): ForgeQueueState {
  return actions.reduce(forgeQueueReducer, from);
}

const twoWaiting = fold([
  { kind: 'add', itemId: 'a', target: 12 },
  { kind: 'add', itemId: 'b', target: 8 },
]);

/** Running, with `a` handed to main and answered. */
const aInFlight = fold([{ kind: 'start' }, { kind: 'requested', itemId: 'a' }, { kind: 'started', itemId: 'a', runId: 'r1' }], twoWaiting);

describe('adding and removing pieces', () => {
  it('appends in the order added, and adding the same piece again moves its target rather than duplicating it', () => {
    const again = forgeQueueReducer(twoWaiting, { kind: 'add', itemId: 'a', target: 13 });
    expect(again.pieces).toEqual([
      { itemId: 'a', target: 13 },
      { itemId: 'b', target: 8 },
    ]);
    expect(forgeQueueReducer(twoWaiting, { kind: 'add', itemId: 'a', target: 12 })).toBe(twoWaiting);
  });

  it('leaves the piece in flight alone: a new target for it is ignored and so is a remove', () => {
    expect(forgeQueueReducer(aInFlight, { kind: 'add', itemId: 'a', target: 14 })).toBe(aInFlight);
    expect(forgeQueueReducer(aInFlight, { kind: 'remove', itemId: 'a' })).toBe(aInFlight);
  });

  it('clear takes every waiting piece off, and leaves the one in flight to finish', () => {
    expect(forgeQueueReducer(twoWaiting, { kind: 'clear' })).toEqual({ ...EMPTY_FORGE_QUEUE, pieces: [] });
    expect(forgeQueueReducer(EMPTY_FORGE_QUEUE, { kind: 'clear' })).toBe(EMPTY_FORGE_QUEUE);

    const cleared = forgeQueueReducer(aInFlight, { kind: 'clear' });
    expect(cleared.pieces).toEqual([{ itemId: 'a', target: 12 }]);
    expect(cleared).toMatchObject({ status: 'running', active: { itemId: 'a', runId: 'r1' } });
    const finished = forgeQueueReducer(cleared, { kind: 'done', runId: 'r1', result: result('target') });
    expect(finished).toEqual({ ...EMPTY_FORGE_QUEUE, pieces: [] });
  });

  it('removing the last waiting piece leaves an idle, empty queue', () => {
    const state = fold([{ kind: 'remove', itemId: 'a' }, { kind: 'remove', itemId: 'b' }], twoWaiting);
    expect(state).toEqual({ ...EMPTY_FORGE_QUEUE, pieces: [] });
    expect(forgeQueueReducer(state, { kind: 'remove', itemId: 'zzz' })).toBe(state);
  });
});

describe('start, request and answer', () => {
  it('start on an empty queue is a no-op; on a waiting queue it runs with nothing yet requested', () => {
    expect(forgeQueueReducer(EMPTY_FORGE_QUEUE, { kind: 'start' })).toBe(EMPTY_FORGE_QUEUE);
    const running = forgeQueueReducer(twoWaiting, { kind: 'start' });
    expect(running.status).toBe('running');
    expect(running.active).toBeNull();
  });

  it('only the head piece can be requested, and only once', () => {
    const running = forgeQueueReducer(twoWaiting, { kind: 'start' });
    expect(forgeQueueReducer(running, { kind: 'requested', itemId: 'b' })).toBe(running);
    const requested = forgeQueueReducer(running, { kind: 'requested', itemId: 'a' });
    expect(requested.active).toEqual({ itemId: 'a', runId: null });
    expect(forgeQueueReducer(requested, { kind: 'requested', itemId: 'a' })).toBe(requested);
  });

  it('a refusal about the environment halts the queue on the head piece, which stays', () => {
    const requested = fold([{ kind: 'start' }, { kind: 'requested', itemId: 'a' }], twoWaiting);
    const halted = forgeQueueReducer(requested, { kind: 'refused', itemId: 'a', reason: 'game_not_running' });
    expect(halted.status).toBe('halted');
    expect(halted.active).toBeNull();
    expect(halted.halt).toEqual({ kind: 'refused', itemId: 'a', reason: 'game_not_running' });
    expect(halted.pieces.map((piece) => piece.itemId)).toEqual(['a', 'b']);
  });

  it('a refusal about the piece itself drops it and keeps the queue running for the next', () => {
    const requested = fold([{ kind: 'start' }, { kind: 'requested', itemId: 'a' }], twoWaiting);
    for (const reason of ['unknown_item', 'bad_target'] as const) {
      const next = forgeQueueReducer(requested, { kind: 'refused', itemId: 'a', reason });
      expect(next.status).toBe('running');
      expect(next.active).toBeNull();
      expect(next.pieces.map((piece) => piece.itemId)).toEqual(['b']);
    }
  });

  it('Start after a halt resumes from the halted piece with the reason cleared', () => {
    const requested = fold([{ kind: 'start' }, { kind: 'requested', itemId: 'a' }], twoWaiting);
    const halted = forgeQueueReducer(requested, { kind: 'refused', itemId: 'a', reason: 'busy' });
    const resumed = forgeQueueReducer(halted, { kind: 'start' });
    expect(resumed.status).toBe('running');
    expect(resumed.halt).toBeNull();
    expect(resumed.pieces[0]?.itemId).toBe('a');
  });
});

describe('a run ending', () => {
  it('a done for a run the queue did not start changes nothing', () => {
    expect(forgeQueueReducer(aInFlight, { kind: 'done', runId: 'other', result: result('target') })).toBe(aInFlight);
    expect(forgeQueueReducer(twoWaiting, { kind: 'done', runId: 'r1', result: result('target') })).toBe(twoWaiting);
  });

  it('reaching the target drops the piece and keeps running while pieces remain, idle once none do', () => {
    const next = forgeQueueReducer(aInFlight, { kind: 'done', runId: 'r1', result: result('target') });
    expect(next.status).toBe('running');
    expect(next.active).toBeNull();
    expect(next.pieces).toEqual([{ itemId: 'b', target: 8 }]);
    expect(next.forged).toBe(1);

    const bInFlight = fold([{ kind: 'requested', itemId: 'b' }, { kind: 'started', itemId: 'b', runId: 'r2' }], next);
    const emptied = forgeQueueReducer(bInFlight, { kind: 'done', runId: 'r2', result: result('target', { itemId: 'b' }) });
    expect(emptied).toEqual({ ...EMPTY_FORGE_QUEUE, pieces: [] });
  });

  it.each(['budget', 'shortfall', 'cooldown', 'attempts', 'missing', 'error'] as const)(
    'stopping on %s halts the queue with the piece still at its head',
    (stop) => {
      const halted = forgeQueueReducer(aInFlight, { kind: 'done', runId: 'r1', result: result(stop) });
      expect(halted.status).toBe('halted');
      expect(halted.halt).toEqual({ kind: 'stop', itemId: 'a', stop });
      expect(halted.pieces.map((piece) => piece.itemId)).toEqual(['a', 'b']);
      expect(halted.active).toBeNull();
    },
  );

  it('a cancelled run — from the footer or from the Forge tab — leaves the queue idle, not halted', () => {
    const fromForgeTab = forgeQueueReducer(aInFlight, { kind: 'done', runId: 'r1', result: result('cancelled') });
    expect(fromForgeTab).toMatchObject({ status: 'idle', active: null, halt: null });
    expect(fromForgeTab.pieces.map((piece) => piece.itemId)).toEqual(['a', 'b']);

    const cancelled = forgeQueueReducer(aInFlight, { kind: 'cancel' });
    expect(cancelled.status).toBe('idle');
    expect(cancelled.active).toEqual({ itemId: 'a', runId: 'r1' });
    const settled = forgeQueueReducer(cancelled, { kind: 'done', runId: 'r1', result: result('cancelled') });
    expect(settled).toMatchObject({ status: 'idle', active: null, halt: null });
  });

  it('a run cancelled from the footer that still reached its target drops the piece', () => {
    const cancelled = forgeQueueReducer(aInFlight, { kind: 'cancel' });
    const settled = forgeQueueReducer(cancelled, { kind: 'done', runId: 'r1', result: result('target') });
    expect(settled.status).toBe('idle');
    expect(settled.pieces.map((piece) => piece.itemId)).toEqual(['b']);
  });
});

describe('the forged count', () => {
  it('counts pieces that reached their target, not ones dropped or stopped, and starts over once the queue empties', () => {
    const one = forgeQueueReducer(aInFlight, { kind: 'done', runId: 'r1', result: result('target') });
    const withC = forgeQueueReducer(one, { kind: 'add', itemId: 'c', target: 9 });
    const bDropped = fold([{ kind: 'requested', itemId: 'b' }, { kind: 'refused', itemId: 'b', reason: 'bad_target' }], withC);
    expect(bDropped.forged).toBe(1);
    const cStopped = fold(
      [{ kind: 'requested', itemId: 'c' }, { kind: 'started', itemId: 'c', runId: 'r3' }, { kind: 'done', runId: 'r3', result: result('budget', { itemId: 'c' }) }],
      bDropped,
    );
    expect(cStopped.forged).toBe(1);
    expect(forgeQueueReducer(cStopped, { kind: 'remove', itemId: 'c' }).forged).toBe(0);
  });
});

describe('syncing with the bag', () => {
  const upgrades = (entries: [string, number][]) => new Map(entries);

  it('drops a waiting piece that is gone from the bag or already at its target, never the one in flight', () => {
    const synced = forgeQueueReducer(aInFlight, { kind: 'sync', upgrades: upgrades([['a', 12]]) });
    expect(synced.pieces.map((piece) => piece.itemId)).toEqual(['a']);
    expect(synced.status).toBe('running');

    const atTarget = forgeQueueReducer(twoWaiting, { kind: 'sync', upgrades: upgrades([['a', 12], ['b', 3]]) });
    expect(atTarget.pieces).toEqual([{ itemId: 'b', target: 8 }]);
  });

  it('is a no-op when every waiting piece still has somewhere to climb', () => {
    expect(forgeQueueReducer(twoWaiting, { kind: 'sync', upgrades: upgrades([['a', 8], ['b', 0]]) })).toBe(twoWaiting);
  });

  it('a halted piece forged to its target elsewhere clears the halt', () => {
    const halted = forgeQueueReducer(aInFlight, { kind: 'done', runId: 'r1', result: result('budget') });
    const synced = forgeQueueReducer(halted, { kind: 'sync', upgrades: upgrades([['a', 12], ['b', 0]]) });
    expect(synced).toMatchObject({ status: 'idle', halt: null });
    expect(synced.pieces).toEqual([{ itemId: 'b', target: 8 }]);
  });
});

describe('restore', () => {
  it('seeds an untouched queue, paused, and never overwrites one the player has already used', () => {
    const restored = forgeQueueReducer(EMPTY_FORGE_QUEUE, { kind: 'restore', pieces: [{ itemId: 'x', target: 10 }] });
    expect(restored.status).toBe('idle');
    expect(restored.pieces).toEqual([{ itemId: 'x', target: 10 }]);
    expect(forgeQueueReducer(twoWaiting, { kind: 'restore', pieces: [{ itemId: 'x', target: 10 }] })).toBe(twoWaiting);
    expect(forgeQueueReducer(EMPTY_FORGE_QUEUE, { kind: 'restore', pieces: [] })).toBe(EMPTY_FORGE_QUEUE);
  });
});
