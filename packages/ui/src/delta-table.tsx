'use client';

import type { ReactNode } from 'react';
import { cn } from './cn';
import { Icon } from './icon';
import { Tooltip } from './tooltip';
import {
  deltaTableClass,
  deltaTableLabelColClass,
  deltaTableNumericColClass,
  deltaTableHeadRowClass,
  deltaTableHeadCellClass,
  deltaTableHeadNumericCellClass,
  deltaTableRowClass,
  deltaTableLabelCellClass,
  deltaTableLabelInnerClass,
  deltaTableNumericCellClass,
  deltaTableDeltaRecipe,
  deltaTableLockButtonClass,
} from './delta-table.recipe';

export type DeltaTableRow = {
  id: string;
  label: ReactNode;
  now: number;
  target: number;
  /** Renders a compact lock glyph after the label — a value this row's own producer freezes. */
  locked?: boolean;
  /** Accessible name for the lock glyph. Required whenever `locked` is true. */
  lockLabel?: string;
  /** Tooltip body shown on the lock glyph. Required whenever `locked` is true. */
  lockHint?: string;
  /** Passed through to the row's `data-testid` verbatim. */
  testId?: string;
};

export type DeltaTableColumnLabels = {
  label: ReactNode;
  now: ReactNode;
  target: ReactNode;
  change: ReactNode;
};

export type DeltaTableProps = {
  rows: readonly DeltaTableRow[];
  columnLabels: DeltaTableColumnLabels;
  /** Visually hidden `<caption>` — the table's accessible name. */
  caption: ReactNode;
  decimals?: number;
  /** Drops a row whose `now` and `target` are both 0. Callers decide — the two real surfaces disagree on purpose. */
  hideZeroRows?: boolean;
  className?: string;
};

function formatValue(value: number, decimals: number): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatDelta(delta: number, decimals: number): string {
  return `${delta >= 0 ? '+' : ''}${formatValue(delta, decimals)}`;
}

function deltaTone(delta: number): 'up' | 'down' | 'flat' {
  if (delta > 0) return 'up';
  if (delta < 0) return 'down';
  return 'flat';
}

/**
 * Stat / Now / Target / Change ledger. A real `<table>` (navigable by assistive tech, unlike a
 * CSS-grid stand-in) with `table-layout: fixed` and an explicit `<colgroup>`, so nothing a row
 * carries — a long label, a locked-row glyph — can shift a column's width or single out a row's
 * height. The change column is always `target - now`, computed here rather than accepted as a
 * fourth input, so a caller can never pass a delta that disagrees with its own now/target pair.
 */
export function DeltaTable({
  rows,
  columnLabels,
  caption,
  decimals = 0,
  hideZeroRows = false,
  className,
}: DeltaTableProps) {
  const visibleRows = hideZeroRows ? rows.filter((row) => row.now !== 0 || row.target !== 0) : rows;

  return (
    <table className={cn(deltaTableClass, className)}>
      <caption className="sr-only">{caption}</caption>
      <colgroup>
        <col className={deltaTableLabelColClass} />
        <col className={deltaTableNumericColClass} />
        <col className={deltaTableNumericColClass} />
        <col className={deltaTableNumericColClass} />
      </colgroup>
      <thead>
        <tr className={deltaTableHeadRowClass}>
          <th scope="col" className={deltaTableHeadCellClass}>
            {columnLabels.label}
          </th>
          <th scope="col" className={deltaTableHeadNumericCellClass}>
            {columnLabels.now}
          </th>
          <th scope="col" className={deltaTableHeadNumericCellClass}>
            {columnLabels.target}
          </th>
          <th scope="col" className={deltaTableHeadNumericCellClass}>
            {columnLabels.change}
          </th>
        </tr>
      </thead>
      <tbody>
        {visibleRows.map((row) => {
          const delta = row.target - row.now;
          return (
            <tr key={row.id} data-testid={row.testId} className={deltaTableRowClass}>
              <th scope="row" className={deltaTableLabelCellClass}>
                <span className={deltaTableLabelInnerClass}>
                  {row.label}
                  {row.locked ? (
                    <Tooltip.Root>
                      <Tooltip.Trigger
                        type="button"
                        delay={180}
                        closeDelay={80}
                        className={deltaTableLockButtonClass}
                        aria-label={row.lockLabel}
                      >
                        <Icon name="lock-closed" size="xs" />
                      </Tooltip.Trigger>
                      <Tooltip.Portal>
                        <Tooltip.Positioner sideOffset={6}>
                          <Tooltip.Popup>
                            <p className="m-0 max-w-56 text-[11px] leading-snug">{row.lockHint}</p>
                          </Tooltip.Popup>
                        </Tooltip.Positioner>
                      </Tooltip.Portal>
                    </Tooltip.Root>
                  ) : null}
                </span>
              </th>
              <td className={deltaTableNumericCellClass}>{formatValue(row.now, decimals)}</td>
              <td className={deltaTableNumericCellClass}>{formatValue(row.target, decimals)}</td>
              <td className={deltaTableDeltaRecipe({ tone: deltaTone(delta) })}>
                {formatDelta(delta, decimals)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
