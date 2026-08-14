'use client';

import { DataTable } from '@bombfarm/ui';
import { sub, type Lang, type Strings } from '@/shared/i18n';
import type { FarmRateRow } from '@bombfarm/domain/farm-rate';
import { FARM_COLUMNS, type FarmSortDir, type FarmSortKey } from '@/features/phases/model/farm-ranking-view';
import { FarmRankingRow } from './farm-ranking-row';

/**
 * Per-column widths (rem), sized for the LONGER of EN/PT header + real cell content
 * (`content-fit-ui.md` rule 1, rule 6) — "Peças de tempo / h" and "Tempo de clear" are the
 * width drivers, not their EN counterparts. Sums to the table's `min-w-368` (92rem).
 */
const COLUMN_WIDTH_REM: Record<string, number> = {
  phase: 12,
  mitigation: 6,
  gold: 7,
  chests: 7,
  keys: 7,
  gems: 6,
  timePieces: 8,
  xp: 6,
  itemLevel: 6,
  clearTime: 7,
  oneShot: 6,
  jaula: 8,
  infeasible: 6,
};

type Props = {
  rows: readonly FarmRateRow[];
  sortKey: FarmSortKey;
  sortDir: FarmSortDir;
  onSort: (key: FarmSortKey) => void;
  currentPhase: number;
  onActivate: (phase: number) => void;
  lang: Lang;
  t: Strings;
};

/**
 * `DataTable.Root scrollable` around a `table-fixed` `<table>` sized for real content
 * (`no-layout-shift.md` rule 7, `content-fit-ui.md` rule 6). Body rows carry
 * `content-visibility: auto` — every one of the (up to) 600 rows stays mounted,
 * so the "all 600 present" assertion stays honest; the CSS property is the offscreen-cost
 * mitigation, not a virtualizer.
 */
export function FarmRankingTable({
  rows,
  sortKey,
  sortDir,
  onSort,
  currentPhase,
  onActivate,
  lang,
  t,
}: Props) {
  const sortColumn = FARM_COLUMNS.find((column) => column.sortKey === sortKey);
  const sortLive = sortColumn
    ? sub(t.farmRankingSortedBy, {
        column: t[sortColumn.headerKey],
        direction: sortDir === 'asc' ? t.farmRankingSortAsc : t.farmRankingSortDesc,
      })
    : '';

  return (
    <div data-testid="farm-ranking-table">
      <div aria-live="polite" className="sr-only" data-testid="farm-sort-live">
        {sortLive}
      </div>
      <DataTable.Root
        scrollable
        maxRows={14}
        rowHeight="2.75rem"
        className="rounded-sm border border-line"
      >
        <div className="overflow-x-auto">
          <DataTable.Table className="min-w-368 table-fixed">
            <colgroup>
              {FARM_COLUMNS.map((column) => (
                <col key={column.id} style={{ width: `${COLUMN_WIDTH_REM[column.id]}rem` }} />
              ))}
            </colgroup>
            <DataTable.Caption>{t.farmRankingCaption}</DataTable.Caption>
            <DataTable.Head>
              <DataTable.Row>
                {FARM_COLUMNS.map((column) =>
                  column.sortKey ? (
                    <DataTable.Header
                      key={column.id}
                      sortable
                      col={column.sortKey}
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onSort={onSort}
                      align={column.align}
                    >
                      {t[column.headerKey]}
                    </DataTable.Header>
                  ) : (
                    <DataTable.Header key={column.id} align={column.align}>
                      {t[column.headerKey]}
                    </DataTable.Header>
                  ),
                )}
              </DataTable.Row>
            </DataTable.Head>
            <DataTable.Body className="[&>tr]:[content-visibility:auto] [&>tr]:[contain-intrinsic-size:auto_2.75rem]">
              {rows.map((row) => (
                <FarmRankingRow
                  key={row.phase}
                  row={row}
                  lang={lang}
                  t={t}
                  current={row.phase === currentPhase}
                  onActivate={onActivate}
                />
              ))}
            </DataTable.Body>
          </DataTable.Table>
        </div>
      </DataTable.Root>
    </div>
  );
}
