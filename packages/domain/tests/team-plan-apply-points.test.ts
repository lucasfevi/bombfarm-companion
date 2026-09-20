import { describe, expect, it } from 'vitest';
import { COMMIT_INDEX, COMMIT_ORDER, commitVectorEquals, pointsToCommitVector } from '@bombfarm/domain/team-plan';

describe('COMMIT_ORDER / COMMIT_INDEX — the server index order', () => {
  it('pins every key to its server index by value', () => {
    expect(COMMIT_INDEX.attack).toBe(0);
    expect(COMMIT_INDEX.energy).toBe(1);
    expect(COMMIT_INDEX.speed).toBe(2);
    expect(COMMIT_INDEX.luck).toBe(3);
    expect(COMMIT_INDEX.critChance).toBe(4);
    expect(COMMIT_INDEX.critDmg).toBe(5);
    expect(COMMIT_INDEX.penetration).toBe(6);
    expect(COMMIT_INDEX.cdr).toBe(7);
  });

  it('has exactly eight entries', () => {
    expect(COMMIT_ORDER).toHaveLength(8);
    expect(Object.keys(COMMIT_INDEX)).toHaveLength(8);
  });

  it('is NOT the sheet-key field order (misallocation red state)', () => {
    const sheetKeyOrderPts = {
      attack: 1,
      energy: 2,
      speed: 3,
      critChance: 4,
      critDmg: 5,
      penetration: 6,
      cdr: 7,
      luck: 8,
    };
    const vector = pointsToCommitVector(sheetKeyOrderPts);
    expect(vector).not.toEqual(Object.values(sheetKeyOrderPts));
  });
});

describe('pointsToCommitVector', () => {
  it('returns the eight values in COMMIT_ORDER', () => {
    const pts = { attack: 10, energy: 20, speed: 30, luck: 40, critChance: 50, critDmg: 60, penetration: 70, cdr: 80 };
    expect(pointsToCommitVector(pts)).toEqual([10, 20, 30, 40, 50, 60, 70, 80]);
  });

  it('reads a missing key as 0', () => {
    expect(pointsToCommitVector({ attack: 5 })).toEqual([5, 0, 0, 0, 0, 0, 0, 0]);
    expect(pointsToCommitVector({})).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('throws RangeError for a negative value', () => {
    expect(() => pointsToCommitVector({ luck: -1 })).toThrow(RangeError);
  });

  it('throws RangeError for a non-integer value', () => {
    expect(() => pointsToCommitVector({ cdr: 1.5 })).toThrow(RangeError);
  });
});

describe('commitVectorEquals', () => {
  const a = [1, 2, 3, 4, 5, 6, 7, 8] as const;

  it('is true for two equal vectors', () => {
    expect(commitVectorEquals(a, [1, 2, 3, 4, 5, 6, 7, 8])).toBe(true);
  });

  it('is false when any entry differs', () => {
    expect(commitVectorEquals(a, [1, 2, 3, 4, 5, 6, 7, 9])).toBe(false);
  });
});
