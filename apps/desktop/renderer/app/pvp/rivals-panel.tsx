'use client';

import { useMemo, useState } from 'react';
import type { PvpHistoryResult } from '@bombfarm/contracts';
import { inventoryFieldClass } from '@bombfarm/game-art';
import { Button, cn, DataTable, InfoTip, Panel, PanelHeader } from '@bombfarm/ui';
import { sub, useCopy, useLocale } from '../../lib/copy';
import { formatCapturedAt, formatCount, formatGainPct } from '../../lib/format';
import {
  DEFAULT_RIVAL_SORT,
  nextRivalSort,
  rivalRecords,
  searchRivals,
  sortRivals,
  type RivalRecord,
  type RivalSort,
  type RivalSortKey,
} from '../../lib/pvp/pvp-rivals';
import { HEADER_HEIGHT_PX, RIVAL_ROW_HEIGHT_PX, VISIBLE_ROWS } from '../../lib/pvp/pvp-table-rows';
import { usePvpFilters } from '../../lib/pvp/use-pvp-filters';
import { scrollportHeightPx, useRowWindow } from '../../lib/row-window';
import { RowWindowSpacer } from '../../lib/row-window-spacer';

const FEWEST_RIVALS = 2;
const COLUMNS = 4;

function toneOf(sign: number): string | undefined {
  if (sign > 0) return 'text-up';
  if (sign < 0) return 'text-down';
  return undefined;
}

/** The top {@link VISIBLE_ROWS} rivals under the header, the rest behind a scrollbar — the same
 *  height alone, stacked over the replay, or beside it. The scrollport keeps its unfiltered
 *  height while a search narrows the list, so typing never makes the panel jump. */
export function RivalsPanel({ history, className }: { history: PvpHistoryResult | null; className?: string }) {
  const t = useCopy();
  const rivals = useMemo(() => rivalRecords(history?.rows ?? []), [history]);
  const [sort, setSort] = useState<RivalSort>(DEFAULT_RIVAL_SORT);
  const [query, setQuery] = useState('');
  const shown = useMemo(() => sortRivals(searchRivals(rivals, query), sort), [rivals, query, sort]);
  const few = rivals.length < FEWEST_RIVALS;
  const windowed = useRowWindow(shown, VISIBLE_ROWS, RIVAL_ROW_HEIGHT_PX);
  const scrollportHeight = scrollportHeightPx(Math.min(rivals.length, VISIBLE_ROWS), RIVAL_ROW_HEIGHT_PX, HEADER_HEIGHT_PX);
  const sortProps = {
    sortKey: sort.key,
    sortDir: sort.direction,
    onSort: (key: RivalSortKey) => {
      setSort(nextRivalSort(sort, key));
    },
  };

  return (
    <Panel data-testid="pvp-rivals" data-state={few ? 'few' : 'rivals'} className={cn('xl:self-start', className)}>
      <PanelHeader title={t.pvpRivalsTitle}>
        {few ? null : <span className="text-xs text-muted">{t.pvpRivalsNote}</span>}
      </PanelHeader>
      {few ? (
        <p className="m-0 text-xs text-muted" data-testid="pvp-rivals-few">
          {t.pvpRivalsFew}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <input
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
              }}
              placeholder={t.pvpRivalsSearchPlaceholder}
              aria-label={t.pvpRivalsSearchLabel}
              data-testid="pvp-rivals-search"
              className={cn(inventoryFieldClass, 'w-56', 'min-w-0')}
            />
            <span className="ml-auto shrink-0 text-xs tabular-nums text-muted" data-testid="pvp-rivals-count">
              {sub(t.inventoryFilterCount, { shown: shown.length, total: rivals.length })}
            </span>
          </div>
          <DataTable.Root
            scrollable
            style={{ height: scrollportHeight }}
            onScroll={windowed.onScroll}
            data-testid="pvp-rivals-scroll"
          >
            {/* Fixed layout: an auto table sizes its columns from the rows mounted right now, and
                the row window swaps those rows on every scroll step. */}
            <DataTable.Table aria-rowcount={windowed.total} className="table-fixed">
              <colgroup>
                <col />
                <col className="w-32" />
                <col className="w-28" />
                <col className="w-32" />
              </colgroup>
              <DataTable.Head>
                <DataTable.Row>
                  <DataTable.Header<RivalSortKey> sortable scope="col" col="name" {...sortProps}>
                    {t.pvpColumnOpponent}
                  </DataTable.Header>
                  <DataTable.Header<RivalSortKey>
                    sortable
                    scope="col"
                    align="right"
                    col="record"
                    {...sortProps}
                    aside={<InfoTip label={t.pvpRivalsColumnRecord} tip={t.pvpRivalsRecordHint} />}
                  >
                    {t.pvpRivalsColumnRecord}
                  </DataTable.Header>
                  <DataTable.Header<RivalSortKey>
                    sortable
                    scope="col"
                    align="right"
                    col="score"
                    {...sortProps}
                    aside={<InfoTip label={t.pvpColumnScore} tip={t.pvpRivalsMarginHint} />}
                  >
                    {t.pvpColumnScore}
                  </DataTable.Header>
                  <DataTable.Header<RivalSortKey> sortable scope="col" col="last" {...sortProps}>
                    {t.pvpRivalsColumnLast}
                  </DataTable.Header>
                </DataTable.Row>
              </DataTable.Head>
              <DataTable.Body data-testid="pvp-rivals-body">
                {windowed.start > 0 ? (
                  <RowWindowSpacer
                    testId="pvp-rivals-spacer-top"
                    rows={windowed.start}
                    rowHeightPx={RIVAL_ROW_HEIGHT_PX}
                    colSpan={COLUMNS}
                  />
                ) : null}
                {windowed.rows.map((rival, index) => (
                  <RivalRow key={rival.name} rival={rival} ariaRowIndex={windowed.start + index + 1} />
                ))}
                {windowed.end < windowed.total ? (
                  <RowWindowSpacer
                    testId="pvp-rivals-spacer-bottom"
                    rows={windowed.total - windowed.end}
                    rowHeightPx={RIVAL_ROW_HEIGHT_PX}
                    colSpan={COLUMNS}
                  />
                ) : null}
              </DataTable.Body>
            </DataTable.Table>
            {shown.length === 0 ? (
              <p className="m-0 px-2 py-3 text-xs text-muted" data-testid="pvp-rivals-no-match">
                {t.pvpFilterOpponentNoMatch}
              </p>
            ) : null}
          </DataTable.Root>
        </div>
      )}
    </Panel>
  );
}

function RivalRow({ rival, ariaRowIndex }: { rival: RivalRecord; ariaRowIndex: number }) {
  const t = useCopy();
  const { locale } = useLocale();
  const { opponent, setOpponent } = usePvpFilters();
  const chosen = opponent === rival.name;
  const pick = () => {
    setOpponent(rival.name);
  };
  const recordTone = toneOf(rival.won - rival.lost);
  const marginTone = rival.marginPct === null ? undefined : toneOf(rival.marginPct);
  const lastLine = rival.latest.won ? t.pvpRivalsLastWon : t.pvpRivalsLastLost;

  return (
    <DataTable.Row
      data-testid="pvp-rival-row"
      data-opponent={rival.name}
      data-chosen={chosen ? 'true' : 'false'}
      aria-rowindex={ariaRowIndex}
      style={{ height: RIVAL_ROW_HEIGHT_PX }}
      onClick={pick}
      className={cn('cursor-pointer', 'hover:bg-[color-mix(in_oklch,var(--line)_28%,transparent)]')}
    >
      <DataTable.RowHeader className="truncate">
        <Button
          type="button"
          variant="text"
          aria-pressed={chosen}
          className={cn('normal-case', 'tracking-normal', 'text-[13px]', 'font-semibold', chosen ? 'text-accent' : 'text-ink')}
          onClick={(event) => {
            event.stopPropagation();
            pick();
          }}
        >
          {rival.name}
        </Button>
      </DataTable.RowHeader>
      <DataTable.Cell align="right" numeric>
        <span data-testid="pvp-rival-record" className={cn('font-mono', recordTone)}>
          {sub(t.pvpRivalsRecord, { won: formatCount(rival.won, locale), lost: formatCount(rival.lost, locale) })}
        </span>
      </DataTable.Cell>
      <DataTable.Cell align="right" numeric>
        <span data-testid="pvp-rival-margin" className={cn(marginTone)}>
          {rival.marginPct === null ? <span aria-hidden>—</span> : formatGainPct(rival.marginPct, locale)}
        </span>
      </DataTable.Cell>
      <DataTable.Cell data-testid="pvp-rival-last" nowrap className="truncate text-muted">
        {sub(lastLine, { age: formatCapturedAt(rival.latest.recordedAt, t) })}
      </DataTable.Cell>
    </DataTable.Row>
  );
}
