import { describe, expect, it } from 'vitest';
import { ROW_HEIGHT_PX } from './farm-ranking-row-height';
import {
  DEFAULT_SCROLLPORT_HEIGHT_PX,
  MIN_VISIBLE_ROWS,
  OVERSCAN_ROWS,
  visibleRowsFor,
  windowFor,
} from './farm-ranking-window';

const TOTAL = 600;

describe('visibleRowsFor', () => {
  it('covers at least the full visible band — the partial row at the bottom edge is mounted', () => {
    expect(visibleRowsFor(DEFAULT_SCROLLPORT_HEIGHT_PX)).toBe(
      Math.ceil(DEFAULT_SCROLLPORT_HEIGHT_PX / ROW_HEIGHT_PX),
    );
    expect(visibleRowsFor(DEFAULT_SCROLLPORT_HEIGHT_PX)).toBe(19);
  });

  it('never collapses the table to nothing, however little height the host offers', () => {
    expect(visibleRowsFor(0)).toBe(MIN_VISIBLE_ROWS);
    expect(visibleRowsFor(-400)).toBe(MIN_VISIBLE_ROWS);
    expect(visibleRowsFor(ROW_HEIGHT_PX)).toBe(MIN_VISIBLE_ROWS);
  });

  it('a shorter window mounts fewer rows than the default one', () => {
    expect(visibleRowsFor(240)).toBeLessThan(visibleRowsFor(DEFAULT_SCROLLPORT_HEIGHT_PX));
    expect(visibleRowsFor(240)).toBe(8);
  });
});

describe('windowFor', () => {
  it('starts at the top with no overscan above it', () => {
    expect(windowFor(0, TOTAL, 19)).toEqual({ start: 0, end: 19 + OVERSCAN_ROWS });
  });

  it('brackets the scrolled-to row with overscan on both sides', () => {
    const scrollTop = 100 * ROW_HEIGHT_PX;
    expect(windowFor(scrollTop, TOTAL, 19)).toEqual({
      start: 100 - OVERSCAN_ROWS,
      end: 100 + 19 + OVERSCAN_ROWS,
    });
  });

  it('clamps firstVisible against a set that just got narrower — the window lands on real rows', () => {
    const deep = 500 * ROW_HEIGHT_PX;
    const { start, end } = windowFor(deep, 5, 19);
    expect(start).toBe(0);
    expect(end).toBe(5);
  });

  /**
   * The runtime height change — a window resize — is the case a static small height never
   * exercises: the same `scrollTop` is re-read against a different window size, and the taller
   * window is the one that can slice past the end.
   */
  it('a height change at the same scroll position keeps the window on real rows', () => {
    const scrollTop = 595 * ROW_HEIGHT_PX;

    const short = windowFor(scrollTop, TOTAL, visibleRowsFor(240));
    expect(short.start).toBeGreaterThanOrEqual(0);
    expect(short.end).toBeLessThanOrEqual(TOTAL);
    expect(short.end).toBeGreaterThan(short.start);

    const tall = windowFor(scrollTop, TOTAL, visibleRowsFor(DEFAULT_SCROLLPORT_HEIGHT_PX));
    expect(tall.start).toBeGreaterThanOrEqual(0);
    expect(tall.end).toBe(TOTAL);
    // The taller window shows the last row without scrolling further, so it starts higher up.
    expect(tall.start).toBeLessThan(short.start);
  });

  it('every height renders a non-empty window at every reachable scroll position', () => {
    for (const heightPx of [0, 120, 240, 400, DEFAULT_SCROLLPORT_HEIGHT_PX, 1200]) {
      const visibleRows = visibleRowsFor(heightPx);
      for (const total of [1, 5, 42, TOTAL]) {
        for (const row of [0, 3, 41, 599]) {
          const { start, end } = windowFor(row * ROW_HEIGHT_PX, total, visibleRows);
          expect(start).toBeGreaterThanOrEqual(0);
          expect(end).toBeLessThanOrEqual(total);
          expect(end).toBeGreaterThan(start);
        }
      }
    }
  });
});
