'use client';

import { useMemo, useState, type UIEvent } from 'react';
import { DataTable } from '@bombfarm/ui';
import { sub, type Lang } from '@bombfarm/hero/copy';
import type { FarmCopy } from '../copy';
import type { FarmRateRow } from '@bombfarm/domain/farm-rate';
import { FARM_COLUMNS, type FarmSortDir, type FarmSortKey } from '../model/farm-ranking-view';
import { ROW_HEIGHT_CSS, ROW_HEIGHT_PX } from '../model/farm-ranking-row-height';
import {
  DEFAULT_SCROLLPORT_HEIGHT_PX,
  visibleRowsFor,
  windowFor,
} from '../model/farm-ranking-window';
import { FarmColumnHeaderLabel } from './farm-ranking-column-header';
import { FarmRankingRow } from './farm-ranking-row';
import { FarmRankingSpacerRow } from './farm-ranking-spacer-row';

/**
 * Per-column widths (rem), sized for the LONGER of EN/PT header + real cell content
 * (`content-fit-ui.md` rule 1). The five resource headers (see `farm-ranking-column-header.tsx`)
 * show only a `size-8` sprite now, so their width is driven by body content, not the header:
 * `gold`, `chests`, `gems` and `timePieces` shrink to their rate cell's own width. `keys` stays
 * slightly wider than those four — its value is signed (`formatSignedRatePerHour`), and the
 * leading `+`/`-` is the one extra character the others never carry; it no longer sizes for a
 * trailing annotation, now that the keys cell reads the signed rate alone. `phase` is sized for
 * the coordinate cell (`Very Hard 1-15 (#600)`), `clearTime` for `formatClearTime`'s longest
 * output.
 */
const COLUMN_WIDTH_REM: Record<string, number> = {
  phase: 10,
  mitigation: 6,
  gold: 5,
  chests: 5,
  keys: 5.5,
  gems: 5,
  timePieces: 5,
  xp: 6,
  itemLevel: 6,
  clearTime: 7,
  oneShot: 6,
};

type Props = {
  rows: readonly FarmRateRow[];
  /** Grouped rather than two flat props (the 8-prop cap left no room once reRankActive
   *  joined) — the board's own sort state is already this exact shape. */
  sort: { key: FarmSortKey; direction: FarmSortDir };
  onSort: (key: FarmSortKey) => void;
  currentPhase: number;
  onActivate: (phase: number) => void;
  lang: Lang;
  t: FarmCopy;
  /** How the table is shown rather than what it lists, grouped to stay inside the 8-prop cap —
   *  the same regrouping `sort` above already carries. */
  display: {
    /** True when the rows above come from the proposed respec build, not the player's current
     *  one. Drives the caption text and a data-farm-mode attribute — no column, sort or filter
     *  change; the table itself is byte-identical either way. */
    reRankActive: boolean;
    /** The scrollport's height, which is what the virtualization window is sized from. Omitted,
     *  the table renders at the height it always had. */
    scrollportHeightPx?: number | undefined;
  };
};

/**
 * `DataTable.Root scrollable` around a `table-fixed` `<table>` sized for real content
 * (`no-layout-shift.md` rule 7, `content-fit-ui.md` rule 6). The body mounts only a
 * scroll-position-derived window of rows plus overscan, not all (up to) 600 — expanding the
 * unlocked-only filter to the full 600-row set used to mount every one of them (content-visibility
 * only defers OFFSCREEN LAYOUT, it does not skip mounting), which measured as the real hitch on
 * that transition. `aria-rowcount` on the table and `aria-rowindex` on each rendered row now carry
 * the "no row is silently dropped by filtering" guarantee a DOM row count used to prove directly.
 */
export function FarmRankingTable({
  rows,
  sort,
  onSort,
  currentPhase,
  onActivate,
  lang,
  t,
  display,
}: Props) {
  const { reRankActive, scrollportHeightPx = DEFAULT_SCROLLPORT_HEIGHT_PX } = display;
  const [scrollTop, setScrollTop] = useState(0);
  const total = rows.length;
  const visibleRows = useMemo(() => visibleRowsFor(scrollportHeightPx), [scrollportHeightPx]);
  const { start, end } = useMemo(
    () => windowFor(scrollTop, total, visibleRows),
    [scrollTop, total, visibleRows],
  );
  const windowedRows = rows.slice(start, end);

  function handleScroll(event: UIEvent<HTMLDivElement>) {
    setScrollTop(event.currentTarget.scrollTop);
  }

  const sortColumn = FARM_COLUMNS.find((column) => column.sortKey === sort.key);
  const sortLive = sortColumn
    ? sub(t.farmRankingSortedBy, {
        column: t[sortColumn.headerKey],
        direction: sort.direction === 'asc' ? t.farmRankingSortAsc : t.farmRankingSortDesc,
      })
    : '';

  return (
    <div data-testid="farm-ranking-table">
      <div aria-live="polite" className="sr-only" data-testid="farm-sort-live">
        {sortLive}
      </div>
      <DataTable.Root
        scrollable
        maxRows={visibleRows}
        rowHeight={ROW_HEIGHT_CSS}
        className="rounded-sm border border-line"
        onScroll={handleScroll}
        data-testid="farm-ranking-scroll"
      >
        <DataTable.Table
          className="min-w-266 table-fixed"
          data-farm-mode={reRankActive ? 'proposed' : 'current'}
          aria-rowcount={total}
        >
          <colgroup>
            {FARM_COLUMNS.map((column) => (
              <col key={column.id} style={{ width: `${COLUMN_WIDTH_REM[column.id]}rem` }} />
            ))}
          </colgroup>
          <DataTable.Caption>
            {reRankActive ? t.farmRespecRerankCaption : t.farmRankingCaption}
          </DataTable.Caption>
          <DataTable.Head>
            <DataTable.Row>
              {FARM_COLUMNS.map((column) => {
                const label = (
                  <FarmColumnHeaderLabel columnId={column.id} label={t[column.headerKey]} />
                );
                return column.sortKey ? (
                  <DataTable.Header
                    key={column.id}
                    sortable
                    col={column.sortKey}
                    sortKey={sort.key}
                    sortDir={sort.direction}
                    onSort={onSort}
                    align={column.align}
                  >
                    {label}
                  </DataTable.Header>
                ) : (
                  <DataTable.Header key={column.id} align={column.align}>
                    {label}
                  </DataTable.Header>
                );
              })}
            </DataTable.Row>
          </DataTable.Head>
          <DataTable.Body>
            {start > 0 ? (
              <FarmRankingSpacerRow
                testId="farm-ranking-spacer-top"
                rows={start}
                rowHeightPx={ROW_HEIGHT_PX}
                colSpan={FARM_COLUMNS.length}
              />
            ) : null}
            {windowedRows.map((row, index) => (
              <FarmRankingRow
                key={row.phase}
                row={row}
                lang={lang}
                t={t}
                current={row.phase === currentPhase}
                onActivate={onActivate}
                ariaRowIndex={start + index + 1}
              />
            ))}
            {end < total ? (
              <FarmRankingSpacerRow
                testId="farm-ranking-spacer-bottom"
                rows={total - end}
                rowHeightPx={ROW_HEIGHT_PX}
                colSpan={FARM_COLUMNS.length}
              />
            ) : null}
          </DataTable.Body>
        </DataTable.Table>
      </DataTable.Root>
    </div>
  );
}
