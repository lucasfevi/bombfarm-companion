/**
 * The waiting pieces, remembered across a reload. Only the pieces: whether the queue was running
 * is not kept, so a restored queue waits for Start — main knows nothing of the queue and the run
 * it had in flight is the one thing that survives on its own.
 */
import { FORGE_MAX } from '@bombfarm/domain/forge';
import type { ForgeQueuePiece } from './forge-queue-reducer';

const FORGE_QUEUE_STORAGE_KEY = 'bfc-forge-queue';

function isPiece(value: unknown): value is ForgeQueuePiece {
  if (typeof value !== 'object' || value === null) return false;
  const raw = value as Record<string, unknown>;
  return (
    typeof raw.itemId === 'string' &&
    raw.itemId !== '' &&
    typeof raw.target === 'number' &&
    Number.isInteger(raw.target) &&
    raw.target >= 1 &&
    raw.target <= FORGE_MAX
  );
}

/** Never throws and never returns a half-read list: a row that does not read as a piece is
 *  dropped, and one item id keeps its first entry only. */
export function normalizeForgeQueuePieces(value: unknown): ForgeQueuePiece[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const pieces: ForgeQueuePiece[] = [];
  for (const raw of value) {
    if (!isPiece(raw) || seen.has(raw.itemId)) continue;
    seen.add(raw.itemId);
    pieces.push({ itemId: raw.itemId, target: raw.target });
  }
  return pieces;
}

export function loadForgeQueuePieces(): ForgeQueuePiece[] {
  try {
    const stored = window.localStorage.getItem(FORGE_QUEUE_STORAGE_KEY);
    if (stored === null) return [];
    return normalizeForgeQueuePieces(JSON.parse(stored));
  } catch {
    return [];
  }
}

export function saveForgeQueuePieces(pieces: readonly ForgeQueuePiece[]): void {
  try {
    if (pieces.length === 0) window.localStorage.removeItem(FORGE_QUEUE_STORAGE_KEY);
    else window.localStorage.setItem(FORGE_QUEUE_STORAGE_KEY, JSON.stringify(pieces));
  } catch {
    // A queue that is not remembered is re-added from the Optimizer; not worth failing over.
  }
}
