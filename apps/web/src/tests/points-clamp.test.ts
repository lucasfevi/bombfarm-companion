import { describe, expect, it } from 'vitest';
import { clampPointStep, SHEET_KEYS, ZERO_PTS, type SheetKey } from '@bombfarm/domain/planner-constants';

/** A hand-authored `Σ pts < level` fixture — the "remaining-unspent" branch, which no
 *  real save exercises (every imported hero either has `spentDelta === level` or overspends). */
function partiallySpent(): Record<SheetKey, number> {
  return { ...ZERO_PTS(), attack: 20, energy: 10, critChance: 3 };
}

describe('clampPointStep (full form per the user Q-1 override)', () => {
  it('floors at 0 for a -1 step at pts=0', () => {
    const pts = ZERO_PTS();
    const next = clampPointStep(pts, 'attack', -1, 38);
    expect(next.attack).toBe(0);
  });

  it('floors at 0 for a -5 step at pts=0', () => {
    const pts = ZERO_PTS();
    const next = clampPointStep(pts, 'attack', -5, 38);
    expect(next.attack).toBe(0);
  });

  it('partial -5 at pts=3 lands at 0, not -2', () => {
    const pts = { ...ZERO_PTS(), attack: 3 };
    const next = clampPointStep(pts, 'attack', -5, 38);
    expect(next.attack).toBe(0);
  });

  it('partial +5 with 3 unspent (remaining-unspent branch, stat_points_available > 0) applies only 3', () => {
    const pts = partiallySpent();
    const spent = SHEET_KEYS.reduce((sum, key) => sum + pts[key], 0);
    const level = spent + 3;
    const next = clampPointStep(pts, 'speed', 5, level);
    expect(next.speed).toBe(3);
    const spentAfter = SHEET_KEYS.reduce((sum, key) => sum + next[key], 0);
    expect(spentAfter).toBe(level);
  });

  it('+1 past budget is REFUSED — a no-op (Q-1 override: ±1 shares the ±5 ceiling)', () => {
    const pts = { ...ZERO_PTS(), attack: 38 };
    const next = clampPointStep(pts, 'attack', 1, 38);
    expect(next.attack).toBe(38);
    expect(next).toBe(pts);
  });

  it('+1 with exactly 1 point of remaining budget applies in full', () => {
    const pts = { ...ZERO_PTS(), attack: 37 };
    const next = clampPointStep(pts, 'attack', 1, 38);
    expect(next.attack).toBe(38);
  });

  it('+5 past budget is CLAMPED to a no-op once the budget is exhausted', () => {
    const pts = { ...ZERO_PTS(), attack: 38 };
    const next = clampPointStep(pts, 'attack', 5, 38);
    expect(next.attack).toBe(38);
    expect(next).toBe(pts);
  });

  it('overspend is unreachable via either stepper — a +5 on an already-overspent record (e.g. level lowered after spend) still finds no room', () => {
    // clampPointStep alone can never produce this pts/level combination (both steppers now
    // refuse to push past level); a real overspent record still occurs by lowering `level`
    // while points are already spent, which is why the text-warn counter stays live UI.
    const pts = { ...ZERO_PTS(), attack: 39 };
    const next = clampPointStep(pts, 'energy', 5, 38);
    expect(next.energy).toBe(0);
  });

  it('luck clamps like any other key: floors at 0', () => {
    const pts = ZERO_PTS();
    const next = clampPointStep(pts, 'luck', -1, 38);
    expect(next.luck).toBe(0);
  });

  it('luck clamps like any other key: +1 ceiling counts against the shared level budget', () => {
    const pts = { ...ZERO_PTS(), attack: 38 };
    const next = clampPointStep(pts, 'luck', 1, 38);
    expect(next.luck).toBe(0);
    expect(next).toBe(pts);
  });

  it('luck clamps like any other key: +5 ceiling counts against the shared level budget', () => {
    const pts = { ...ZERO_PTS(), attack: 36 };
    const next = clampPointStep(pts, 'luck', 5, 38);
    expect(next.luck).toBe(2);
  });

  it('a normal +5 step within budget applies in full', () => {
    const pts = ZERO_PTS();
    const next = clampPointStep(pts, 'cdr', 5, 38);
    expect(next.cdr).toBe(5);
  });

  it('a normal -1 step within budget applies in full', () => {
    const pts = { ...ZERO_PTS(), penetration: 4 };
    const next = clampPointStep(pts, 'penetration', -1, 38);
    expect(next.penetration).toBe(3);
  });

  it('a normal +1 step within budget applies in full', () => {
    const pts = ZERO_PTS();
    const next = clampPointStep(pts, 'attack', 1, 38);
    expect(next.attack).toBe(1);
  });
});
