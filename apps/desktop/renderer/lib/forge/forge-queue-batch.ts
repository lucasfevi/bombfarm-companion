/**
 * What a plan's forge list would do to the queue, without touching it — the same five verdicts
 * `sync` already applies to a piece it holds, read here against a list the queue has not seen
 * yet. A piece missing from the bag or already at its target is left out for the same reason
 * `sync` would drop it later; the queue's own dedupe (`add`) decides the rest once the batch is
 * actually dispatched.
 */
import type { ForgeQueuePiece, ForgeQueueState } from './forge-queue-reducer';

export type ForgeQueueBatchVerdict = 'add' | 'retarget' | 'queued' | 'missing' | 'atTarget';

export type ForgeQueueBatch = {
  readonly toAdd: readonly ForgeQueuePiece[];
  readonly total: number;
  readonly adding: number;
  readonly queued: number;
  readonly retargeted: number;
  readonly missing: number;
  readonly atTarget: number;
};

export function planForgeQueueBatch(
  forgeList: ReadonlyArray<{ readonly itemId: string; readonly to: number }>,
  queue: ForgeQueueState,
  upgrades: ReadonlyMap<string, number>,
): ForgeQueueBatch {
  const queuedById = new Map(queue.pieces.map((piece) => [piece.itemId, piece]));
  const toAdd: ForgeQueuePiece[] = [];
  let queued = 0;
  let retargeted = 0;
  let missing = 0;
  let atTarget = 0;

  for (const { itemId, to } of forgeList) {
    const upgrade = upgrades.get(itemId);
    if (upgrade === undefined) {
      missing += 1;
      continue;
    }
    if (upgrade >= to) {
      atTarget += 1;
      continue;
    }
    const existing = queuedById.get(itemId);
    if (queue.active?.itemId === itemId || existing?.target === to) {
      queued += 1;
      continue;
    }
    if (existing !== undefined) retargeted += 1;
    toAdd.push({ itemId, target: to });
  }

  return { toAdd, total: forgeList.length, adding: toAdd.length, queued, retargeted, missing, atTarget };
}
