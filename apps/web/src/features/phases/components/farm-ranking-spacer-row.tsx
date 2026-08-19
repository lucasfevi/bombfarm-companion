'use client';

type Props = {
  testId: string;
  rows: number;
  rowHeightPx: number;
  colSpan: number;
};

/** A single `<tr>` reserving the scroll height of the rows the virtualized window skipped, so
 *  the scrollbar and scroll position stay correct without those rows mounted. Zeroed
 *  padding/border keeps its height exactly `rows * rowHeightPx` — the base `td` rule adds
 *  both otherwise. Plain multiplication, not a CSS `calc()` string — `rowHeightPx` is already
 *  the enforced, measured pixel height (`farm-ranking-row-height.ts`), so there is no unit
 *  conversion left for the browser to do. */
export function FarmRankingSpacerRow({ testId, rows, rowHeightPx, colSpan }: Props) {
  return (
    <tr aria-hidden="true" data-testid={testId}>
      <td colSpan={colSpan} style={{ height: rows * rowHeightPx, padding: 0, border: 0 }} />
    </tr>
  );
}
