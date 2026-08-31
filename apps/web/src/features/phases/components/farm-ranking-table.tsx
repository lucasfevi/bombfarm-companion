'use client';

import { useMemo, useState, type UIEvent } from 'react';
import { DataTable } from '@bombfarm/ui';
import { sub, type Lang, type Strings } from '@/shared/i18n';
import type { FarmRateRow } from '@bombfarm/domain/farm-rate';
import { FARM_COLUMNS, type FarmSortDir, type FarmSortKey } from '@bombfarm/farm/model/farm-ranking-view';
import { ROW_HEIGHT_CSS, ROW_HEIGHT_PX } from '@bombfarm/farm/model/farm-ranking-row-height';
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
  t: Strings;
  /** True when the rows above come from the proposed respec build, not the player's current
   *  one. Drives the caption text and a data-farm-mode attribute — no column, sort or filter
   *  change; the table itself is byte-identical either way. */
  reRankActive: boolean;
};

/** Same scrollport height the table had before virtualization (14 rows at the old, wrong
 *  44px assumption) — rounded UP against the real 33px row height so the window always
 *  covers at least the full visible band, never less. */
const CONTAINER_HEIGHT_PX = 614;
const VISIBLE_ROWS = Math.ceil(CONTAINER_HEIGHT_PX / ROW_HEIGHT_PX);
/** Rows kept mounted beyond the visible band on each side, so a scroll step never outruns
 *  the render window before React catches up. */
const OVERSCAN_ROWS = 10;

/**
 * `scrollTop` is state carried over from before the current filter/sort pass, so a set that just
 * got narrower can leave it pointing past the new `total` (e.g. scrolled deep into 600 rows, then
 * a filter narrows to 5) — clamping `firstVisible` to what the shrunken list can actually show
 * keeps the window landing on real rows instead of slicing past the end into nothing.
 */
function windowFor(scrollTop: number, total: number): { start: number; end: number } {
  const maxFirstVisible = Math.max(0, total - VISIBLE_ROWS);
  const firstVisible = Math.min(maxFirstVisible, Math.floor(scrollTop / ROW_HEIGHT_PX));
  const start = Math.max(0, firstVisible - OVERSCAN_ROWS);
  const end = Math.min(total, firstVisible + VISIBLE_ROWS + OVERSCAN_ROWS);
  return { start, end };
}

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
  reRankActive,
}: Props) {
  const [scrollTop, setScrollTop] = useState(0);
  const total = rows.length;
  const { start, end } = useMemo(() => windowFor(scrollTop, total), [scrollTop, total]);
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
        maxRows={VISIBLE_ROWS}
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
