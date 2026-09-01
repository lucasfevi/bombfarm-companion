/**
 * The Farm Ranking table's virtualization window — pure, so the two hosts' very different
 * scrollport heights are one arithmetic to test rather than a behaviour to observe in a browser.
 *
 * The height is an input rather than a constant because the two hosts have different room for
 * the table: the web planner scrolls a full-width page, while the desktop shell draws it inside a
 * window whose minimum is 640px tall, where a fixed 614px scrollport is taller than everything
 * the player can see at once.
 */
import { ROW_HEIGHT_PX } from './farm-ranking-row-height';

/**
 * The scrollport height the table had when it was the only one: 14 rows at the old, wrong 44px
 * assumption, rounded UP against the real 33px row height so the window always covers at least
 * the full visible band, never less. Still the default, so a host that says nothing about its own
 * viewport renders exactly what it always did.
 */
export const DEFAULT_SCROLLPORT_HEIGHT_PX = 614;

/** A floor, so a window small enough to collapse the table to nothing never reaches the table. */
export const MIN_VISIBLE_ROWS = 5;

/** Rows kept mounted beyond the visible band on each side, so a scroll step never outruns
 *  the render window before React catches up. */
export const OVERSCAN_ROWS = 10;

export function visibleRowsFor(scrollportHeightPx: number): number {
  return Math.max(MIN_VISIBLE_ROWS, Math.ceil(scrollportHeightPx / ROW_HEIGHT_PX));
}

/**
 * `scrollTop` is state carried over from before the current filter/sort pass — and, since the
 * height can change under a window resize, from before the current window size too. Either can
 * leave it pointing past what the list can now show (scrolled deep into 600 rows, then a filter
 * narrows to 5; or the same scroll position against a window that just got taller), so
 * `firstVisible` is clamped to what the list can actually show. Without the clamp the slice lands
 * past the end and the body renders nothing.
 */
export function windowFor(
  scrollTop: number,
  total: number,
  visibleRows: number,
): { start: number; end: number } {
  const maxFirstVisible = Math.max(0, total - visibleRows);
  const firstVisible = Math.min(maxFirstVisible, Math.floor(scrollTop / ROW_HEIGHT_PX));
  const start = Math.max(0, firstVisible - OVERSCAN_ROWS);
  const end = Math.min(total, firstVisible + visibleRows + OVERSCAN_ROWS);
  return { start, end };
}
