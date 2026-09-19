'use client';

/** A single `<tr>` reserving the scroll height of the rows a virtualized window skipped, so the
 *  scrollbar and scroll position stay correct without those rows mounted. Zeroed padding and
 *  border keep its height exactly `rows * rowHeightPx` — the base `td` rule adds both otherwise. */
export function RowWindowSpacer({
  testId,
  rows,
  rowHeightPx,
  colSpan,
}: {
  testId: string;
  rows: number;
  rowHeightPx: number;
  colSpan: number;
}) {
  return (
    <tr aria-hidden="true" data-testid={testId}>
      <td colSpan={colSpan} style={{ height: rows * rowHeightPx, padding: 0, border: 0 }} />
    </tr>
  );
}
