import { describe, expect, it } from 'vitest';
import { OVERSCAN_ROWS, rowOffsets, windowFor, type TableRowKind } from './inventory-table-window';

const HEIGHTS = { entry: 50, group: 20 };

function body(groups: number, entriesPerGroup: number): TableRowKind[] {
  const kinds: TableRowKind[] = [];
  for (let group = 0; group < groups; group += 1) {
    kinds.push('group');
    for (let entry = 0; entry < entriesPerGroup; entry += 1) kinds.push('entry');
  }
  return kinds;
}

describe('rowOffsets', () => {
  it('accumulates each row kind at its own height and ends with the body total', () => {
    const offsets = rowOffsets(['group', 'entry', 'entry', 'group', 'entry'], HEIGHTS);
    expect(offsets).toEqual([0, 20, 70, 120, 140, 190]);
  });

  it('is a single zero for a body with no rows at all', () => {
    expect(rowOffsets([], HEIGHTS)).toEqual([0]);
  });
});

describe('windowFor', () => {
  const kinds = body(2, 100);
  const offsets = rowOffsets(kinds, HEIGHTS);

  it('mounts only the visible band plus overscan out of a long body', () => {
    const { start, end } = windowFor(offsets, 0, 400);
    expect(start).toBe(0);
    // 20px heading + eight 50px rows cover 400px, so nine rows are visible.
    expect(end).toBe(9 + OVERSCAN_ROWS);
    expect(end - start).toBeLessThan(kinds.length / 4);
  });

  it('covers every pixel of the viewport, heading heights included', () => {
    const scrollTop = 2_000;
    const { start, end } = windowFor(offsets, scrollTop, 400);
    expect(offsets[start]).toBeLessThanOrEqual(scrollTop);
    expect(offsets[end]).toBeGreaterThanOrEqual(scrollTop + 400);
  });

  it('clamps a scroll position left over from a longer list back onto the end of a short one', () => {
    const short = rowOffsets(body(1, 3), HEIGHTS);
    const { start, end } = windowFor(short, 5_000, 400);
    expect(start).toBe(0);
    expect(end).toBe(4);
  });

  it('renders nothing for a body with no rows', () => {
    expect(windowFor(rowOffsets([], HEIGHTS), 0, 400)).toEqual({ start: 0, end: 0 });
  });
});
