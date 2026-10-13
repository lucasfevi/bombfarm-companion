import type { SheetStageRow } from '@bombfarm/domain/sheet-stages';
import type { CloneDeltaTone } from './sheet-clone-diff';

export function formatStageCell(
  value: number,
  format: (n: number, d?: number) => string,
  asDelta: boolean,
  unit = '',
): string {
  if (asDelta && Math.abs(value) < 1e-9) return '—';
  if (!asDelta) return `${format(value, 2)}${unit}`;
  const abs = `${format(Math.abs(value), 2)}${unit}`;
  return value < 0 ? `−${abs}` : `+${abs}`;
}

/**
 * The game's display clamp (`STAT_CAPS.critChance`/`.cdr`, `gameSheetView`), shown as its own
 * column rather than folded into Total — Total must stay the uncapped telescoping sum (see
 * `SheetStageRow`'s doc comment in `sheet-stages.ts`). `—` when the row sits at/under the cap
 * (`deltaCap` is exactly 0 there); otherwise the in-game value plus how much is being wasted,
 * e.g. `100.00 (−77.95)`.
 */
export function formatOverCapCell(
  row: SheetStageRow,
  format: (n: number, d?: number) => string,
  unit: string,
): string {
  if (row.deltaCap === 0) return '—';
  return `${format(row.cappedTotal, 2)}${unit} (${formatStageCell(row.deltaCap, format, true, unit)})`;
}

export function cloneDeltaText(
  delta: number,
  tone: CloneDeltaTone,
  format: (n: number, d?: number) => string,
  unit = '',
): string {
  return tone === 'flat' ? '—' : formatStageCell(delta, format, true, unit);
}

export function stageColumnText(
  column: 'birth' | 'total' | `delta${string}`,
  value: number,
  format: (n: number, d?: number) => string,
  unit: string,
): string {
  return formatStageCell(value, format, column !== 'birth' && column !== 'total', unit);
}
