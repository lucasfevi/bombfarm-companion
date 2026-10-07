import { GRID_COLS } from '../attribution/hp-delta.js';

export const GRID_ROWS_DEFAULT = 16;

export function gridRows(kinds?: readonly number[]): number {
  if (kinds === undefined || kinds.length === 0 || kinds.length % GRID_COLS !== 0) return GRID_ROWS_DEFAULT;
  return kinds.length / GRID_COLS;
}

export function crossCells(center: number, reach: number, rows: number): readonly number[] {
  const row = Math.floor(center / GRID_COLS);
  const col = center % GRID_COLS;
  const cells = [center];
  for (let step = 1; step <= reach; step += 1) {
    if (col - step >= 0) cells.push(center - step);
    if (col + step < GRID_COLS) cells.push(center + step);
    if (row - step >= 0) cells.push(center - GRID_COLS * step);
    if (row + step < rows) cells.push(center + GRID_COLS * step);
  }
  return cells;
}
