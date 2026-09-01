import { describe, expect, it } from 'vitest';
import {
  MAX_TABLE_SCROLLPORT_PX,
  MIN_TABLE_SCROLLPORT_PX,
  tableScrollportHeightFor,
} from './use-farm-table-height';

/** The shell's own minimum window, and a comfortable one. */
const MIN_WINDOW_HEIGHT = 640;

describe('the ranking table is sized to this window', () => {
  it('fits inside the shell\'s smallest window rather than overflowing it', () => {
    const height = tableScrollportHeightFor(MIN_WINDOW_HEIGHT);
    expect(height).toBeLessThan(MIN_WINDOW_HEIGHT);
    expect(height).toBeGreaterThanOrEqual(MIN_TABLE_SCROLLPORT_PX);
  });

  it('grows with the window, up to the height the web planner renders at', () => {
    expect(tableScrollportHeightFor(900)).toBeGreaterThan(
      tableScrollportHeightFor(MIN_WINDOW_HEIGHT),
    );
    expect(tableScrollportHeightFor(1440)).toBe(MAX_TABLE_SCROLLPORT_PX);
    expect(tableScrollportHeightFor(4000)).toBe(MAX_TABLE_SCROLLPORT_PX);
  });

  it('never collapses, however short or absurd the reported window is', () => {
    expect(tableScrollportHeightFor(0)).toBe(MIN_TABLE_SCROLLPORT_PX);
    expect(tableScrollportHeightFor(120)).toBe(MIN_TABLE_SCROLLPORT_PX);
  });

  it('is monotonic — a taller window never yields a shorter table', () => {
    let previous = 0;
    for (let windowHeight = 0; windowHeight <= 2000; windowHeight += 37) {
      const height = tableScrollportHeightFor(windowHeight);
      expect(height).toBeGreaterThanOrEqual(previous);
      previous = height;
    }
  });
});
