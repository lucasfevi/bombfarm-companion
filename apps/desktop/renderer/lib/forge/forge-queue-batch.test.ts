import { describe, expect, it } from 'vitest';
import { EMPTY_FORGE_QUEUE, type ForgeQueueState } from './forge-queue-reducer';
import { planForgeQueueBatch } from './forge-queue-batch';

const upgrades = (entries: [string, number][]) => new Map(entries);

function queueWith(pieces: [string, number][], overrides: Partial<ForgeQueueState> = {}): ForgeQueueState {
  return { ...EMPTY_FORGE_QUEUE, pieces: pieces.map(([itemId, target]) => ({ itemId, target })), ...overrides };
}

describe('the five verdicts', () => {
  it('a piece not in the bag is missing', () => {
    const batch = planForgeQueueBatch([{ itemId: 'a', to: 12 }], EMPTY_FORGE_QUEUE, upgrades([]));
    expect(batch).toMatchObject({ toAdd: [], adding: 0, queued: 0, retargeted: 0, missing: 1, atTarget: 0 });
  });

  it('a piece in the bag at or above the target is atTarget', () => {
    const batch = planForgeQueueBatch([{ itemId: 'a', to: 12 }], EMPTY_FORGE_QUEUE, upgrades([['a', 12]]));
    expect(batch).toMatchObject({ toAdd: [], adding: 0, missing: 0, atTarget: 1 });
    const above = planForgeQueueBatch([{ itemId: 'a', to: 12 }], EMPTY_FORGE_QUEUE, upgrades([['a', 14]]));
    expect(above).toMatchObject({ toAdd: [], atTarget: 1 });
  });

  it('a piece already queued at the plan target is queued, not added', () => {
    const queue = queueWith([['a', 12]]);
    const batch = planForgeQueueBatch([{ itemId: 'a', to: 12 }], queue, upgrades([['a', 8]]));
    expect(batch).toMatchObject({ toAdd: [], adding: 0, queued: 1, retargeted: 0 });
  });

  it('a piece queued at another target is retargeted, and counted in both adding and retargeted', () => {
    const queue = queueWith([['a', 10]]);
    const batch = planForgeQueueBatch([{ itemId: 'a', to: 12 }], queue, upgrades([['a', 8]]));
    expect(batch.toAdd).toEqual([{ itemId: 'a', target: 12 }]);
    expect(batch).toMatchObject({ adding: 1, retargeted: 1, queued: 0 });
  });

  it('a piece nowhere in the queue is add, and lands in toAdd at the plan target', () => {
    const batch = planForgeQueueBatch([{ itemId: 'a', to: 12 }], EMPTY_FORGE_QUEUE, upgrades([['a', 8]]));
    expect(batch.toAdd).toEqual([{ itemId: 'a', target: 12 }]);
    expect(batch).toMatchObject({ adding: 1, retargeted: 0, queued: 0 });
  });
});

describe('counts and order', () => {
  it('every verdict sums back to the list length', () => {
    const queue = queueWith([
      ['b', 20],
      ['c', 5],
    ]);
    const batch = planForgeQueueBatch(
      [
        { itemId: 'a', to: 12 },
        { itemId: 'b', to: 12 },
        { itemId: 'c', to: 12 },
        { itemId: 'd', to: 12 },
        { itemId: 'e', to: 12 },
      ],
      queue,
      upgrades([
        ['a', 8],
        ['b', 8],
        ['c', 8],
        ['d', 12],
      ]),
    );
    expect(batch.total).toBe(5);
    expect(batch.adding + batch.queued + batch.missing + batch.atTarget).toBe(batch.total);
  });

  it('toAdd keeps the forge list order, not the queue order', () => {
    const queue = queueWith([['b', 20]]);
    const batch = planForgeQueueBatch(
      [
        { itemId: 'b', to: 12 },
        { itemId: 'a', to: 12 },
      ],
      queue,
      upgrades([
        ['a', 8],
        ['b', 8],
      ]),
    );
    expect(batch.toAdd).toEqual([
      { itemId: 'b', target: 12 },
      { itemId: 'a', target: 12 },
    ]);
  });
});

describe('the piece in flight (A-5)', () => {
  it('counts as queued at any target, never as a retarget', () => {
    const queue: ForgeQueueState = { ...EMPTY_FORGE_QUEUE, active: { itemId: 'a', runId: 'r1' } };
    const batch = planForgeQueueBatch([{ itemId: 'a', to: 20 }], queue, upgrades([['a', 8]]));
    expect(batch).toMatchObject({ toAdd: [], adding: 0, retargeted: 0, queued: 1 });
  });
});

describe('bag verdicts precede queue verdicts', () => {
  it('a piece queued at another target but already at target in the bag is atTarget, not a retarget', () => {
    const queue = queueWith([['a', 10]]);
    const batch = planForgeQueueBatch([{ itemId: 'a', to: 12 }], queue, upgrades([['a', 12]]));
    expect(batch).toMatchObject({ toAdd: [], adding: 0, retargeted: 0, atTarget: 1 });
  });
});
