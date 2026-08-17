import type { SheetStats } from './gear';
import { SHEET_DISPLAY_KEYS } from './planner-constants';

export function sheetsClose(left: SheetStats, right: SheetStats): boolean {
  return SHEET_DISPLAY_KEYS.every((key) => Math.abs(left[key] - right[key]) < 0.05);
}
