import type { SheetStageRow, SheetStageTable } from '@bombfarm/domain/sheet-stages';
import { SHEET_PANEL_KEYS, type SheetKey } from '@bombfarm/domain/planner-constants';

export const SHEET_STAGE_COLUMNS = [
  'birth',
  'deltaLevel',
  'deltaStars',
  'deltaAbility',
  'deltaGear',
  'deltaPoints',
  'deltaTree',
  'deltaRune',
  'total',
] as const;

export type SheetStageColumn = (typeof SHEET_STAGE_COLUMNS)[number];

export type CloneDeltaTone = 'up' | 'down' | 'flat';

export type SheetDiffCell = { current: number; clone: number; changed: boolean };

export type SheetDiffRow = {
  cells: Record<SheetStageColumn, SheetDiffCell>;
  overCap: { current: SheetStageRow; clone: SheetStageRow; changed: boolean };
  cloneDelta: number;
  cloneDeltaTone: CloneDeltaTone;
};

const cents = (value: number): number => Math.round(value * 100);

function diffCell(current: number, clone: number): SheetDiffCell {
  return { current, clone, changed: cents(current) !== cents(clone) };
}

export function cloneDeltaTone(delta: number): CloneDeltaTone {
  const rounded = cents(delta);
  if (rounded > 0) return 'up';
  if (rounded < 0) return 'down';
  return 'flat';
}

function overCapChanged(current: SheetStageRow, clone: SheetStageRow): boolean {
  if (current.deltaCap === 0 && clone.deltaCap === 0) return false;
  return (
    cents(current.deltaCap) !== cents(clone.deltaCap) ||
    cents(current.cappedTotal) !== cents(clone.cappedTotal)
  );
}

function diffRow(current: SheetStageRow, clone: SheetStageRow): SheetDiffRow {
  const cells = {} as Record<SheetStageColumn, SheetDiffCell>;
  for (const column of SHEET_STAGE_COLUMNS) {
    cells[column] = diffCell(current[column], clone[column]);
  }
  const cloneDelta = clone.total - current.total;
  return {
    cells,
    overCap: {
      current,
      clone,
      changed: overCapChanged(current, clone),
    },
    cloneDelta,
    cloneDeltaTone: cloneDeltaTone(cloneDelta),
  };
}

export function sheetCloneDiff(
  current: SheetStageTable,
  clone: SheetStageTable,
): Record<SheetKey, SheetDiffRow> {
  const rows = {} as Record<SheetKey, SheetDiffRow>;
  for (const key of SHEET_PANEL_KEYS) {
    rows[key] = diffRow(current[key], clone[key]);
  }
  return rows;
}
