/**
 * The inventory table's virtualization window — pure, so the arithmetic is tested as arithmetic
 * rather than observed in a browser.
 *
 * Unlike a table of uniform rows, this body interleaves two heights: a kind heading opens each
 * group and is shorter than the item rows under it. Offsets are therefore accumulated per row
 * rather than derived by multiplication, which is what keeps the spacer heights — and with them
 * the scrollbar — honest whatever mix of headings and rows a window happens to skip.
 */

/** What a flattened body row is, for height purposes only. */
export type TableRowKind = 'group' | 'entry';

export type TableRowHeights = {
  entry: number;
  group: number;
};

/** Rows kept mounted beyond the visible band on each side, so a scroll step never outruns the
 *  render window before React catches up. */
export const OVERSCAN_ROWS = 10;

/**
 * Running top offset of every row, plus the total as a final element — so `offsets[i]` is where
 * row `i` starts and `offsets[n]` is the body's full height. Length is always `kinds.length + 1`.
 */
export function rowOffsets(kinds: readonly TableRowKind[], heights: TableRowHeights): number[] {
  const offsets = new Array<number>(kinds.length + 1);
  let running = 0;
  for (let index = 0; index < kinds.length; index += 1) {
    offsets[index] = running;
    running += kinds[index] === 'group' ? heights.group : heights.entry;
  }
  offsets[kinds.length] = running;
  return offsets;
}

/** Index of the last row starting at or before `position`, by binary search over the offsets. */
function rowAt(offsets: readonly number[], position: number): number {
  let low = 0;
  let high = offsets.length - 2;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if ((offsets[middle] ?? 0) <= position) low = middle;
    else high = middle - 1;
  }
  return Math.max(0, low);
}

/**
 * The slice to mount for a scroll position, with overscan on both sides.
 *
 * `scrollTop` is carried over from before the current filter, sort or resize, so it can point
 * past what the list now holds; clamping it against the total height is what stops a narrowed
 * list from rendering an empty body under a spacer.
 */
export function windowFor(
  offsets: readonly number[],
  scrollTop: number,
  viewportHeight: number,
): { start: number; end: number } {
  const total = offsets.length - 1;
  if (total <= 0) return { start: 0, end: 0 };

  const height = offsets[total] ?? 0;
  const top = Math.max(0, Math.min(scrollTop, Math.max(0, height - viewportHeight)));
  const firstVisible = rowAt(offsets, top);
  const lastVisible = rowAt(offsets, top + viewportHeight);

  return {
    start: Math.max(0, firstVisible - OVERSCAN_ROWS),
    end: Math.min(total, lastVisible + 1 + OVERSCAN_ROWS),
  };
}
