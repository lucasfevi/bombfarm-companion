import { describe, expect, it } from 'vitest';
import { crossFootprint, GRID_COLS } from '../attribution/hp-delta.js';
import { crossCells, GRID_ROWS_DEFAULT, gridRows } from './geometry.js';

const ROWS = 16;
const CELLS = GRID_COLS * ROWS;
const at = (row: number, col: number) => row * GRID_COLS + col;
const sorted = (cells: readonly number[]) => [...cells].sort((a, b) => a - b);

describe('crossCells', () => {
  it('covers the centre and two cells each way on both axes for an interior reach of 2', () => {
    const centre = at(8, 9);
    const cells = crossCells(centre, 2, ROWS);
    expect(sorted(cells)).toEqual(
      sorted([
        centre,
        centre - 1,
        centre - 2,
        centre + 1,
        centre + 2,
        centre - GRID_COLS,
        centre - 2 * GRID_COLS,
        centre + GRID_COLS,
        centre + 2 * GRID_COLS,
      ]),
    );
    expect(cells).toHaveLength(9);
  });

  it('covers only the centre for a reach of 0', () => {
    expect(crossCells(at(5, 5), 0, ROWS)).toEqual([at(5, 5)]);
  });

  it('does not wrap off the right edge onto the next row', () => {
    const cells = crossCells(at(4, GRID_COLS - 1), 2, ROWS);
    expect(cells).not.toContain(at(5, 0));
    expect(cells).not.toContain(at(5, 1));
    expect(cells).toContain(at(4, GRID_COLS - 2));
    expect(cells).toContain(at(4, GRID_COLS - 3));
  });

  it('does not wrap off the left edge onto the previous row', () => {
    const cells = crossCells(at(4, 0), 2, ROWS);
    expect(cells).not.toContain(at(3, GRID_COLS - 1));
    expect(cells).not.toContain(at(3, GRID_COLS - 2));
    expect(cells).toContain(at(4, 1));
    expect(cells).toContain(at(4, 2));
  });

  it('clips the top rows so no cell is negative', () => {
    const cells = crossCells(at(1, 7), 3, ROWS);
    expect(Math.min(...cells)).toBeGreaterThanOrEqual(0);
    expect(cells).toContain(at(0, 7));
    expect(cells).toHaveLength(1 + 6 + 1 + 3);
  });

  it('clips the bottom rows so no cell reaches the row count', () => {
    const cells = crossCells(at(ROWS - 2, 7), 3, ROWS);
    expect(Math.max(...cells)).toBeLessThan(CELLS);
    expect(cells).toContain(at(ROWS - 1, 7));
    expect(cells).toHaveLength(1 + 6 + 1 + 3);
  });

  it('keeps only the in-grid arms at a corner', () => {
    expect(sorted(crossCells(0, 2, ROWS))).toEqual(sorted([0, 1, 2, GRID_COLS, 2 * GRID_COLS]));
    const last = CELLS - 1;
    expect(sorted(crossCells(last, 2, ROWS))).toEqual(sorted([last, last - 1, last - 2, last - GRID_COLS, last - 2 * GRID_COLS]));
  });

  it('uses the row count it is given rather than the default', () => {
    const cells = crossCells(at(9, 3), 2, 10);
    expect(Math.max(...cells)).toBeLessThan(GRID_COLS * 10);
    expect(cells).not.toContain(at(10, 3));
  });

  it('agrees with the existing footprint on every interior centre', () => {
    for (let row = 2; row < ROWS - 2; row += 1) {
      for (let col = 2; col < GRID_COLS - 2; col += 1) {
        const centre = at(row, col);
        expect(sorted(crossCells(centre, 2, ROWS))).toEqual(sorted([...crossFootprint(centre, 2)]));
      }
    }
  });
});

describe('gridRows', () => {
  it('reads the row count from a kinds array that is a whole number of rows', () => {
    expect(gridRows(new Array<number>(GRID_COLS * 16).fill(-1))).toBe(16);
    expect(gridRows(new Array<number>(GRID_COLS * 12).fill(-1))).toBe(12);
  });

  it('falls back to the default when kinds is absent', () => {
    expect(gridRows(undefined)).toBe(GRID_ROWS_DEFAULT);
    expect(gridRows()).toBe(16);
  });

  it('falls back to the default when kinds is empty or not a whole number of rows', () => {
    expect(gridRows([])).toBe(GRID_ROWS_DEFAULT);
    expect(gridRows(new Array<number>(GRID_COLS * 12 + 1).fill(-1))).toBe(GRID_ROWS_DEFAULT);
  });
});
