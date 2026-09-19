/**
 * A scroll-position-derived window over a table of uniform rows: the slice to mount, and the
 * height of the rows skipped on either side. Pure, so a table's virtualization is one arithmetic
 * to test rather than a behaviour to observe in a browser.
 *
 * Every table that uses it pins its rows to the height it hands in — a natural row height varies
 * by a pixel with content and the last row's border rule, and that drift compounds over the rows
 * the spacers stand in for.
 */
import { useCallback, useMemo, useState, type UIEvent } from 'react';

/** Rows kept mounted beyond the visible band on each side, so a scroll step never outruns the
 *  render window before React catches up. */
export const OVERSCAN_ROWS = 10;

export interface RowWindow {
  readonly start: number;
  readonly end: number;
}

/**
 * `scrollTop` is state carried over from before the current filter pass, so it can point past
 * what the list now holds (scrolled deep, then a filter narrows the list to five rows). The
 * first visible row is clamped to what the list can actually show; without the clamp the slice
 * lands past the end and the body renders nothing under a spacer.
 */
export function windowFor(scrollTop: number, total: number, visibleRows: number, rowHeightPx: number): RowWindow {
  const maxFirstVisible = Math.max(0, total - visibleRows);
  const firstVisible = Math.min(maxFirstVisible, Math.floor(scrollTop / rowHeightPx));
  const start = Math.max(0, firstVisible - OVERSCAN_ROWS);
  const end = Math.min(total, firstVisible + visibleRows + OVERSCAN_ROWS);
  return { start, end };
}

/** The scroll container's height for `visibleRows` body rows under a sticky header of
 *  `headerHeightPx`: the eleventh row starts exactly at the bottom edge, so the table reads as
 *  the top ten and a scrollbar, not ten and a sliver. */
export function scrollportHeightPx(visibleRows: number, rowHeightPx: number, headerHeightPx: number): number {
  return headerHeightPx + visibleRows * rowHeightPx;
}

export interface WindowedRows<T> {
  readonly rows: readonly T[];
  readonly start: number;
  readonly end: number;
  readonly total: number;
  readonly onScroll: (event: UIEvent<HTMLDivElement>) => void;
}

export function useRowWindow<T>(all: readonly T[], visibleRows: number, rowHeightPx: number): WindowedRows<T> {
  const [scrollTop, setScrollTop] = useState(0);
  const total = all.length;
  const { start, end } = useMemo(
    () => windowFor(scrollTop, total, visibleRows, rowHeightPx),
    [scrollTop, total, visibleRows, rowHeightPx],
  );
  const rows = useMemo(() => all.slice(start, end), [all, start, end]);
  const onScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop);
  }, []);
  return { rows, start, end, total, onScroll };
}
