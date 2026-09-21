import type { CommitVector } from '@bombfarm/contracts';
import type { SheetStats } from '../gear/types';

// Derived from /hero/detail's next_point diffed against computed, not the sheet field order
// (attack, energy, speed, critChance, critDmg, penetration, cdr, luck) — the server accepts a
// wrong order with 200 and silently misallocates the points.
export const COMMIT_ORDER = [
  'attack',
  'energy',
  'speed',
  'luck',
  'critChance',
  'critDmg',
  'penetration',
  'cdr',
] as const satisfies readonly (keyof SheetStats)[];

export const COMMIT_INDEX: Readonly<Record<keyof SheetStats, 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7>> = Object.fromEntries(
  COMMIT_ORDER.map((key, index) => [key, index]),
) as Readonly<Record<keyof SheetStats, 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7>>;

export function pointsToCommitVector(pts: Readonly<Record<string, number>>): CommitVector {
  const values = COMMIT_ORDER.map((key) => {
    const value = pts[key] ?? 0;
    if (!Number.isInteger(value) || value < 0) {
      throw new RangeError(`commit vector value for "${key}" must be a non-negative integer, got ${String(value)}`);
    }
    return value;
  });
  return values as unknown as CommitVector;
}

export function commitVectorEquals(a: CommitVector, b: CommitVector): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}
