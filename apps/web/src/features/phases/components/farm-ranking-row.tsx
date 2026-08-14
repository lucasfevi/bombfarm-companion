'use client';

import { Chip, DataTable, Tooltip, cn } from '@bombfarm/ui';
import { sub, type Lang, type Strings } from '@/shared/i18n';
import type { FarmRateRow } from '@bombfarm/domain/farm-rate';
import {
  formatBand,
  formatMitigationPct,
  formatOneShot,
  formatPhaseLabel,
  formatRate,
  formatSignedRate,
} from '@/features/phases/model/farm-ranking-format';
import { formatClearTime, formatDurationShort } from '@/features/phases/model/phases-page';

type Props = {
  row: FarmRateRow;
  lang: Lang;
  t: Strings;
  current: boolean;
  onActivate: (phase: number) => void;
};

/** Presentational, zero math — every cell is a formatted `FarmRateRow` field. */
export function FarmRankingRow({ row, lang, t, current, onActivate }: Props) {
  const activate = () => onActivate(row.phase);
  const oneShotLabels = { yes: t.farmRankingOneShotYes, no: t.farmRankingOneShotNo };
  const oneShotTip = row.oneShot
    ? t.farmRankingOneShotTooltipYes
    : sub(t.farmRankingOneShotTooltipNo, { htk: formatMitigationPct(row.expectedHtk) });

  return (
    <DataTable.Row
      className={cn(
        'cursor-pointer focus-visible:[outline:2px_solid_var(--accent)] focus-visible:[outline-offset:-2px]',
        current
          ? 'bg-[color-mix(in_oklch,var(--accent)_10%,transparent)] shadow-[inset_3px_0_0_var(--accent)]'
          : 'hover:bg-[color-mix(in_oklch,var(--accent)_6%,transparent)]',
      )}
      tabIndex={0}
      aria-current={current ? 'true' : undefined}
      data-testid={`farm-row-${row.phase}`}
      onClick={activate}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          activate();
        }
      }}
    >
      <DataTable.Cell nowrap={false}>
        <span className="flex flex-wrap items-center gap-1.5">
          {formatPhaseLabel(row.phase, lang)}
          <Chip variant="small" className={cn(!row.gate && 'invisible')} aria-hidden={!row.gate}>
            {t.farmRankingGateBadge}
          </Chip>
          <Chip
            variant="small-warn"
            className={cn(!row.locked && 'invisible')}
            aria-hidden={!row.locked}
          >
            {t.farmRankingPushTargetBadge}
          </Chip>
        </span>
      </DataTable.Cell>
      <DataTable.Cell align="right" numeric>
        {formatMitigationPct(row.mitigationPct)}
      </DataTable.Cell>
      <DataTable.Cell align="right" numeric data-testid={`farm-row-gold-${row.phase}`}>
        {formatRate(row.goldPerHour)}
      </DataTable.Cell>
      <DataTable.Cell align="right" numeric>
        {formatRate(row.chestsPerHour)}
      </DataTable.Cell>
      <DataTable.Cell align="right" numeric>
        {formatSignedRate(row.keysPerHour)}
        {row.gate ? <span className="ml-1 text-[10px] text-muted">{t.farmRankingKeysConsumed}</span> : null}
      </DataTable.Cell>
      <DataTable.Cell align="right" numeric>
        {formatRate(row.gemsPerHour)}
      </DataTable.Cell>
      <DataTable.Cell align="right" numeric>
        {formatRate(row.timePiecesPerHour)}
      </DataTable.Cell>
      <DataTable.Cell align="right" numeric>
        {formatRate(row.xpPerHour)}
      </DataTable.Cell>
      <DataTable.Cell align="right">{formatBand(row.itemLevelLabel)}</DataTable.Cell>
      <DataTable.Cell align="right" numeric>
        {formatClearTime(row.clearSecs)}
      </DataTable.Cell>
      <DataTable.Cell nowrap={false}>
        <Tooltip.Provider delay={200} closeDelay={80}>
          <Tooltip.Root>
            <Tooltip.Trigger render={<span />}>
              {formatOneShot(row.oneShot, oneShotLabels)}
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner sideOffset={6}>
                <Tooltip.Popup>{oneShotTip}</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Provider>
      </DataTable.Cell>
      <DataTable.Cell nowrap={false}>
        {formatMitigationPct(row.jaulaEarlyCapPct)}% · {formatDurationShort(row.jaulaWindowSecs)}
      </DataTable.Cell>
      <DataTable.Cell>
        <Chip
          variant="small-warn"
          className={cn(!row.infeasible && 'invisible')}
          aria-hidden={!row.infeasible}
        >
          {t.farmRankingInfeasibleBadge}
        </Chip>
      </DataTable.Cell>
    </DataTable.Row>
  );
}
