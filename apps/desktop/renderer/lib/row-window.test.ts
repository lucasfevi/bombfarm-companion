import { describe, expect, it } from 'vitest';
import { OVERSCAN_ROWS, scrollportHeightPx, windowFor } from './row-window';

const ROW = 31;
const VISIBLE = 10;

describe('windowFor', () => {
  it('starts at the top with no overscan above it', () => {
    expect(windowFor(0, 600, VISIBLE, ROW)).toEqual({ start: 0, end: VISIBLE + OVERSCAN_ROWS });
  });

  it('brackets the scrolled-to row with overscan on both sides', () => {
    expect(windowFor(100 * ROW, 600, VISIBLE, ROW)).toEqual({
      start: 100 - OVERSCAN_ROWS,
      end: 100 + VISIBLE + OVERSCAN_ROWS,
    });
  });

  it('a row scrolled partly out of view still counts as the first visible one', () => {
    expect(windowFor(100 * ROW + ROW - 1, 600, VISIBLE, ROW).start).toBe(100 - OVERSCAN_ROWS);
  });

  it('never runs past the end at the bottom of the list', () => {
    expect(windowFor(590 * ROW, 600, VISIBLE, ROW)).toEqual({ start: 590 - OVERSCAN_ROWS, end: 600 });
  });

  it('clamps a scroll position carried over from a longer list, so the window lands on real rows', () => {
    expect(windowFor(500 * ROW, 5, VISIBLE, ROW)).toEqual({ start: 0, end: 5 });
    expect(windowFor(500 * ROW, 12, VISIBLE, ROW)).toEqual({ start: 0, end: 12 });
  });

  it('mounts every row of a list shorter than the visible band, with no spacer either side', () => {
    expect(windowFor(0, 3, VISIBLE, ROW)).toEqual({ start: 0, end: 3 });
    expect(windowFor(0, 0, VISIBLE, ROW)).toEqual({ start: 0, end: 0 });
  });
});

describe('scrollportHeightPx', () => {
  it('is the header plus exactly the visible rows, so the next row starts at the bottom edge', () => {
    expect(scrollportHeightPx(VISIBLE, ROW, 29)).toBe(29 + 10 * 31);
  });
});
