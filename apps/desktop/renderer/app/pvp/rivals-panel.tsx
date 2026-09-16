'use client';

import { useMemo } from 'react';
import type { PvpHistoryResult } from '@bombfarm/contracts';
import { Button, cn, DataTable, InfoTip, Panel, PanelHeader } from '@bombfarm/ui';
import { sub, useCopy, useLocale } from '../../lib/copy';
import { formatCapturedAt, formatCount, formatGainPct } from '../../lib/format';
import { rivalRecords, type RivalRecord } from '../../lib/pvp/pvp-rivals';
import { usePvpFilters } from '../../lib/pvp/use-pvp-filters';

const TABLE_MAX_ROWS = 8;
/** The same cap as `maxRows`, as a class the xl breakpoint can lift; the row height is DataTable's default. */
const FILL_CAP_BELOW_XL = 'max-h-[calc(2rem*8)]';
const FEWEST_RIVALS = 2;

function toneOf(sign: number): string | undefined {
  if (sign > 0) return 'text-up';
  if (sign < 0) return 'text-down';
  return undefined;
}

export function RivalsPanel({
  history,
  className,
  fill = false,
}: {
  history: PvpHistoryResult | null;
  className?: string;
  /** Beside an open replay the panel takes the replay's height and its table scrolls inside it;
   *  alone, or stacked over the replay on a narrow window, the table caps itself at
   *  {@link TABLE_MAX_ROWS} rows. */
  fill?: boolean;
}) {
  const t = useCopy();
  const rivals = useMemo(() => rivalRecords(history?.rows ?? []), [history]);
  const few = rivals.length < FEWEST_RIVALS;

  return (
    <Panel
      data-testid="pvp-rivals"
      data-state={few ? 'few' : 'rivals'}
      data-fill={fill ? 'replay' : undefined}
      className={cn(fill && 'xl:flex', fill && 'xl:h-full', fill && 'xl:min-h-0', fill && 'xl:flex-col', className)}
    >
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
          {...(fill ? { className: cn(FILL_CAP_BELOW_XL, 'xl:max-h-none', 'xl:flex-1') } : { maxRows: TABLE_MAX_ROWS })}
        >
          <DataTable.Table>
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
              {rivals.map((rival) => (
                <RivalRow key={rival.name} rival={rival} />
              ))}
            </DataTable.Body>
          </DataTable.Table>
        </DataTable.Root>
      )}
    </Panel>
  );
}

function RivalRow({ rival }: { rival: RivalRecord }) {
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
