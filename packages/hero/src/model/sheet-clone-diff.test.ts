import { describe, expect, it } from 'vitest';
import { SHEET_KEYS, type SheetKey } from '@bombfarm/domain/planner-constants';
import type { SheetStageRow, SheetStageTable } from '@bombfarm/domain/sheet-stages';
import { cloneDeltaText, formatOverCapCell, stageColumnText } from './sheet-cells';
import { cloneDeltaTone, sheetCloneDiff } from './sheet-clone-diff';

const format = (value: number, decimals = 0): string => value.toFixed(decimals);

function stageRow(overrides: Partial<SheetStageRow> = {}): SheetStageRow {
  return {
    birth: 10,
    deltaLevel: 1,
    deltaStars: 0,
    deltaAbility: 0,
    deltaGear: 2,
    deltaPoints: 3,
    deltaTree: 4,
    deltaRune: 0,
    total: 20,
    deltaCap: 0,
    cappedTotal: 20,
    ...overrides,
  };
}

function table(overrides: Partial<Record<SheetKey, Partial<SheetStageRow>>> = {}): SheetStageTable {
  const out = {} as SheetStageTable;
  for (const key of SHEET_KEYS) out[key] = stageRow(overrides[key]);
  return out;
}

describe('sheetCloneDiff cells', () => {
  it('marks a cell changed only where the clone differs from the current gear', () => {
    const diff = sheetCloneDiff(table(), table({ attack: { deltaGear: 5, total: 23, cappedTotal: 23 } }));
    expect(diff.attack.cells.deltaGear).toEqual({ current: 2, clone: 5, changed: true });
    expect(diff.attack.cells.total.changed).toBe(true);
    expect(diff.attack.cells.birth.changed).toBe(false);
    expect(diff.attack.cells.deltaLevel.changed).toBe(false);
    expect(diff.energy.cells.deltaGear.changed).toBe(false);
  });

  it('reads two values that print the same at two decimals as unchanged', () => {
    const diff = sheetCloneDiff(table(), table({ attack: { deltaGear: 2.0004 } }));
    expect(diff.attack.cells.deltaGear.changed).toBe(false);
  });

  it('flags a changed points delta, which moves with gear through attack multipliers', () => {
    const diff = sheetCloneDiff(table(), table({ attack: { deltaPoints: 3.5 } }));
    expect(diff.attack.cells.deltaPoints.changed).toBe(true);
  });
});

describe('the delta clone column', () => {
  it('is the clone total minus the current total, tinted up when the clone is higher', () => {
    const diff = sheetCloneDiff(table(), table({ speed: { total: 22.5, cappedTotal: 22.5 } }));
    expect(diff.speed.cloneDelta).toBeCloseTo(2.5);
    expect(diff.speed.cloneDeltaTone).toBe('up');
  });

  it('is tinted down when the clone is lower', () => {
    const diff = sheetCloneDiff(table(), table({ speed: { total: 18, cappedTotal: 18 } }));
    expect(diff.speed.cloneDelta).toBeCloseTo(-2);
    expect(diff.speed.cloneDeltaTone).toBe('down');
  });

  it('is flat for an unchanged stat and for a difference below a printed cent', () => {
    const diff = sheetCloneDiff(table(), table({ luck: { total: 20.001 } }));
    expect(diff.energy.cloneDeltaTone).toBe('flat');
    expect(diff.luck.cloneDeltaTone).toBe('flat');
    expect(cloneDeltaTone(0)).toBe('flat');
  });

  it('prints with the table minus sign and unit, and a dash when flat', () => {
    expect(cloneDeltaText(-2, 'down', format, '%')).toBe('−2.00%');
    expect(cloneDeltaText(2.5, 'up', format)).toBe('+2.50');
    expect(cloneDeltaText(0, 'flat', format)).toBe('—');
  });
});

describe('over cap on the clone', () => {
  const clonePushedPastCap = {
    critChance: { total: 104.12, deltaCap: -4.12, cappedTotal: 100 },
  };

  it('differs when the clone pushes a stat past the cap the current gear sits under', () => {
    const diff = sheetCloneDiff(table(), table(clonePushedPastCap));
    expect(diff.critChance.overCap.changed).toBe(true);
    expect(formatOverCapCell(diff.critChance.overCap.current, format, '%')).toBe('—');
    expect(formatOverCapCell(diff.critChance.overCap.clone, format, '%')).toBe('100.00% (−4.12%)');
  });

  it('is unchanged while both sides sit under the cap, even though their totals differ', () => {
    const diff = sheetCloneDiff(table(), table({ critChance: { total: 30, cappedTotal: 30 } }));
    expect(diff.critChance.overCap.changed).toBe(false);
  });

  it('is unchanged when both sides waste the same amount', () => {
    expect(sheetCloneDiff(table(clonePushedPastCap), table(clonePushedPastCap)).critChance.overCap.changed).toBe(false);
  });
});

describe('stageColumnText', () => {
  it('prints birth and total absolute, and every other column as a signed delta', () => {
    expect(stageColumnText('birth', 10, format, '')).toBe('10.00');
    expect(stageColumnText('total', 20, format, '%')).toBe('20.00%');
    expect(stageColumnText('deltaGear', 2, format, '')).toBe('+2.00');
    expect(stageColumnText('deltaGear', 0, format, '')).toBe('—');
  });
});
