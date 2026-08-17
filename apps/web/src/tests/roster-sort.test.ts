import { describe, expect, it } from 'vitest';
import { raritySortIdx, rankSortIdx } from '@bombfarm/domain/roster-sort';
import { RANK_ORDER, RARITIES } from '@bombfarm/domain/planner-constants';

describe('raritySortIdx', () => {
  it('follows RARITIES order', () => {
    expect(raritySortIdx('Comum')).toBe(0);
    expect(raritySortIdx('Mítico')).toBe(RARITIES.length - 1);
    expect(raritySortIdx(RARITIES[2])).toBe(2);
  });
});

describe('rankSortIdx', () => {
  it('orders S..F then missing ranks last', () => {
    expect(rankSortIdx('S')).toBe(0);
    expect(rankSortIdx('a')).toBe(RANK_ORDER.indexOf('A'));
    expect(rankSortIdx('F')).toBe(RANK_ORDER.length - 1);
    expect(rankSortIdx(undefined)).toBe(RANK_ORDER.length);
    expect(rankSortIdx(null)).toBe(RANK_ORDER.length);
    expect(rankSortIdx('Z')).toBe(RANK_ORDER.length);
  });
});
