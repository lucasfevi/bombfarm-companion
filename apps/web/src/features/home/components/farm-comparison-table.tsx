'use client';

import { formatPhaseCoord, phaseMapDisplayName } from '@bombfarm/domain/phase-wiki';
import { formatBand, formatRatePerHour } from '@bombfarm/farm/model/farm-ranking-format';
import { formatClearTime } from '@bombfarm/hero/model';
import { Bar, Chip, DataTable, cn } from '@bombfarm/ui';
import { useAppLang } from '@/shared/context/app-lang';
import type { FarmRankingResult } from '@/shared/stores';
import type { FarmCardPillTone } from '../model/farm-card-view';
import { formatSignedPct } from '../model/farm-sentence';

type FarmRateRow = FarmRankingResult['rows'][number];

export type FarmComparisonColumn = {
  id: 'current' | 'best' | 'nextItemLevel' | 'nextDifficulty';
  title: string;
  row: FarmRateRow;
  vs: { pct: number; tone: FarmCardPillTone; against: string } | 'here' | 'same';
};

const PILL_CLASS = {
  up: 'border-[color-mix(in_oklch,var(--up)_40%,var(--line))] bg-[color-mix(in_oklch,var(--up)_14%,var(--surface))] text-up',
  down: 'border-[color-mix(in_oklch,var(--warn)_36%,var(--line))] bg-[color-mix(in_oklch,var(--warn)_12%,var(--surface))] text-warn',
  neutral: 'border-line bg-transparent text-muted',
} as const;

const BEST_TINT = 'bg-[color-mix(in_oklch,var(--accent)_7%,transparent)]';
const LABEL_CLASS = 'py-3 pl-0 text-[10.5px] font-medium tracking-[0.04em] text-muted uppercase';
const FIGURE_CLASS = 'py-3 font-mono tabular-nums';

export function FarmComparisonTable({
  columns,
  peakGoldPerHour,
  sameLabel,
}: {
  columns: readonly FarmComparisonColumn[];
  peakGoldPerHour: number;
  sameLabel: string;
}) {
  const { t, lang } = useAppLang();
  const cellClass = (column: FarmComparisonColumn) =>
    cn('align-top', column.id === 'best' && BEST_TINT, column.row.locked && 'text-muted');

  return (
    <DataTable.Root className="overflow-x-auto">
      <DataTable.Table className="min-w-160 table-fixed">
        <colgroup>
          <col className="w-23" />
          {columns.map((column) => (
            <col key={column.id} />
          ))}
        </colgroup>
        <thead>
          <DataTable.Row>
            <th className="p-0" />
            {columns.map((column) => (
              <th
                key={column.id}
                className={cn(
                  'px-2 pb-0 text-left align-top text-[10px] font-bold tracking-[0.08em] uppercase',
                  column.id === 'best' ? cn(BEST_TINT, 'text-accent') : 'text-muted',
                )}
                data-testid={`home-farm-${column.id}-title`}
              >
                {column.title}
              </th>
            ))}
          </DataTable.Row>
          <DataTable.Row>
            <th className="border-b border-line p-0" />
            {columns.map((column) => (
              <th
                key={column.id}
                className={cn('border-b border-line px-2 pt-2 pb-3.5 text-left align-top font-normal normal-case', column.id === 'best' && cn(BEST_TINT, 'border-b-[color-mix(in_oklch,var(--accent)_45%,var(--line))]'))}
                data-testid={`home-farm-${column.id}`}
              >
                <span
                  className={cn('block text-sm font-bold whitespace-nowrap', column.row.locked ? 'text-muted' : 'text-ink')}
                  data-testid={`home-farm-${column.id}-phase`}
                >
                  {formatPhaseCoord(column.row.phase, lang)}
                  <span className="ml-1.5 font-mono text-[11.5px] font-medium text-muted">#{column.row.phase}</span>
                </span>
                <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11.5px] text-muted">
                  {phaseMapDisplayName(column.row.phase, lang)}
                  {column.row.locked ? <Chip variant="small">{t.homeCardFarmLocked}</Chip> : null}
                </span>
              </th>
            ))}
          </DataTable.Row>
        </thead>
        <DataTable.Body>
          <DataTable.Row>
            <DataTable.RowHeader className={LABEL_CLASS}>{t.homeCardFarmRowGold}</DataTable.RowHeader>
            {columns.map((column) => (
              <DataTable.Cell key={column.id} className={cn(cellClass(column), 'pt-4 pb-3.5')}>
                <span
                  className={cn('block font-mono text-xl font-bold tabular-nums', column.row.locked ? 'text-muted' : 'text-gold')}
                  data-testid={`home-farm-${column.id}-gold`}
                >
                  {formatRatePerHour(column.row.goldPerHour, lang)}
                </span>
                <div className="mt-2.5">
                  <Bar
                    percent={peakGoldPerHour > 0 ? (column.row.goldPerHour / peakGoldPerHour) * 100 : 0}
                    variant={column.id === 'best' ? 'best' : 'fill'}
                    className={column.row.locked ? 'bg-muted' : 'bg-gold'}
                  />
                </div>
              </DataTable.Cell>
            ))}
          </DataTable.Row>
          <DataTable.Row>
            <DataTable.RowHeader className={LABEL_CLASS}>{t.homeCardFarmRowXp}</DataTable.RowHeader>
            {columns.map((column) => (
              <DataTable.Cell
                key={column.id}
                className={cn(cellClass(column), FIGURE_CLASS, !column.row.locked && 'text-info')}
                data-testid={`home-farm-${column.id}-xp`}
              >
                {formatRatePerHour(column.row.xpPerHour, lang)}
              </DataTable.Cell>
            ))}
          </DataTable.Row>
          <DataTable.Row>
            <DataTable.RowHeader className={LABEL_CLASS}>{t.homeCardFarmRowItemLevels}</DataTable.RowHeader>
            {columns.map((column) => (
              <DataTable.Cell
                key={column.id}
                className={cn(cellClass(column), FIGURE_CLASS)}
                data-testid={`home-farm-${column.id}-items`}
              >
                {formatBand(column.row.itemLevelLabel)}
              </DataTable.Cell>
            ))}
          </DataTable.Row>
          <DataTable.Row>
            <DataTable.RowHeader className={LABEL_CLASS}>{t.homeCardFarmRowClearTime}</DataTable.RowHeader>
            {columns.map((column) => (
              <DataTable.Cell
                key={column.id}
                className={cn(cellClass(column), FIGURE_CLASS)}
                data-testid={`home-farm-${column.id}-clear`}
              >
                {formatClearTime(column.row.clearSecs)}
              </DataTable.Cell>
            ))}
          </DataTable.Row>
          <DataTable.Row>
            <DataTable.RowHeader className={LABEL_CLASS}>{t.homeCardFarmRowVs}</DataTable.RowHeader>
            {columns.map((column) => (
              <DataTable.Cell key={column.id} nowrap={false} className={cn(cellClass(column), 'pt-4 pb-3')} data-testid={`home-farm-${column.id}-vs`}>
                {column.vs === 'here' ? (
                  <span className="text-xs text-muted">{t.homeCardFarmHere}</span>
                ) : column.vs === 'same' ? (
                  <span className="text-xs text-muted">{sameLabel}</span>
                ) : (
                  <>
                    <span
                      className={cn(
                        'inline-flex h-6 items-center rounded-full border px-2 font-mono text-[13px] font-bold tabular-nums',
                        PILL_CLASS[column.row.locked ? 'neutral' : column.vs.tone],
                      )}
                      data-tone={column.vs.tone}
                    >
                      {formatSignedPct(column.vs.pct, lang)}
                    </span>
                    <span className="mt-1.5 block text-[10.5px] text-muted">{column.vs.against}</span>
                  </>
                )}
              </DataTable.Cell>
            ))}
          </DataTable.Row>
        </DataTable.Body>
      </DataTable.Table>
    </DataTable.Root>
  );
}
