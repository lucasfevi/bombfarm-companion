'use client';

import { useMemo } from 'react';
import type { PvpHistoryResult } from '@bombfarm/contracts';
import { Button, cn, DataTable, InfoTip, Panel, PanelHeader } from '@bombfarm/ui';
import { sub, useCopy, useLocale } from '../../lib/copy';
import { formatCapturedAt, formatCount, formatGainPct } from '../../lib/format';
import { rivalRecords, type RivalRecord } from '../../lib/pvp/pvp-rivals';
import { HEADER_HEIGHT_PX, RIVAL_ROW_HEIGHT_PX, VISIBLE_ROWS } from '../../lib/pvp/pvp-table-rows';
import { usePvpFilters } from '../../lib/pvp/use-pvp-filters';
import { scrollportHeightPx, useRowWindow } from '../../lib/row-window';
import { RowWindowSpacer } from '../../lib/row-window-spacer';

const FEWEST_RIVALS = 2;
const COLUMNS = 4;
const SCROLLPORT_HEIGHT_PX = scrollportHeightPx(VISIBLE_ROWS, RIVAL_ROW_HEIGHT_PX, HEADER_HEIGHT_PX);

function toneOf(sign: number): string | undefined {
  if (sign > 0) return 'text-up';
  if (sign < 0) return 'text-down';
  return undefined;
}

/** The top {@link VISIBLE_ROWS} rivals under the header, the rest behind a scrollbar — the same
 *  height alone, stacked over the replay, or beside it. */
export function RivalsPanel({ history, className }: { history: PvpHistoryResult | null; className?: string }) {
  const t = useCopy();
  const rivals = useMemo(() => rivalRecords(history?.rows ?? []), [history]);
  const few = rivals.length < FEWEST_RIVALS;
  const windowed = useRowWindow(rivals, VISIBLE_ROWS, RIVAL_ROW_HEIGHT_PX);

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
        <DataTable.Root
          scrollable
          style={{ maxHeight: SCROLLPORT_HEIGHT_PX }}
          onScroll={windowed.onScroll}
          data-testid="pvp-rivals-scroll"
        >
          <DataTable.Table aria-rowcount={windowed.total}>
            <DataTable.Head>
              <DataTable.Row>
                <DataTable.Header scope="col">{t.pvpColumnOpponent}</DataTable.Header>
                <DataTable.Header scope="col" align="right">
                  <span className="inline-flex items-center gap-1">
                    {t.pvpRivalsColumnRecord}
                    <InfoTip label={t.pvpRivalsColumnRecord} tip={t.pvpRivalsRecordHint} />
                  </span>
                </DataTable.Header>
                <DataTable.Header scope="col" align="right">
                  <span className="inline-flex items-center gap-1">
                    {t.pvpColumnScore}
                    <InfoTip label={t.pvpColumnScore} tip={t.pvpRivalsMarginHint} />
                  </span>
                </DataTable.Header>
                <DataTable.Header scope="col">{t.pvpRivalsColumnLast}</DataTable.Header>
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
        </DataTable.Root>
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
      <DataTable.RowHeader>
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
      <DataTable.Cell data-testid="pvp-rival-last" className="text-muted">
        {sub(lastLine, { age: formatCapturedAt(rival.latest.recordedAt, t) })}
      </DataTable.Cell>
    </DataTable.Row>
  );
}
