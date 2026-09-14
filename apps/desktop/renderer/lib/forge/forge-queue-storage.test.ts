import { describe, expect, it } from 'vitest';
import { normalizeForgeQueuePieces } from './forge-queue-storage';

describe('normalizeForgeQueuePieces', () => {
  it('keeps well-formed pieces in order and drops everything else, including a repeated item', () => {
    expect(
      normalizeForgeQueuePieces([
        { itemId: 'a', target: 12 },
        { itemId: 'a', target: 9 },
        { itemId: '', target: 8 },
        { itemId: 'b', target: 16 },
        { itemId: 'c', target: 0 },
        { itemId: 'd', target: 8.5 },
        { itemId: 'e', target: '8' },
        'junk',
        null,
        { itemId: 'f', target: 8 },
      ]),
    ).toEqual([
      { itemId: 'a', target: 12 },
      { itemId: 'f', target: 8 },
    ]);
  });

  it('reads anything that is not a list as an empty queue', () => {
    expect(normalizeForgeQueuePieces(null)).toEqual([]);
    expect(normalizeForgeQueuePieces({ itemId: 'a', target: 12 })).toEqual([]);
    expect(normalizeForgeQueuePieces('[]')).toEqual([]);
  });
});
