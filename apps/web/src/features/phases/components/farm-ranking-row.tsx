'use client';

import { DataTable, Tooltip, cn } from '@bombfarm/ui';
import { statListMutedRowClass } from '@bombfarm/ui/panel-field.recipe';
import { sub, type Lang, type Strings } from '@/shared/i18n';
import type { FarmRateRow } from '@bombfarm/domain/farm-rate';
import { dropAppliesOnPhase } from '@bombfarm/domain/phase-wiki';
import { ClockIcon } from '@/shared/game-art';
import { ROW_HEIGHT_CSS } from '@bombfarm/farm/model/farm-ranking-row-height';
import {
  formatBand,
  formatMitigationPct,
  formatOneShot,
  formatPhaseLabel,
  formatRatePerHour,
  formatSignedRatePerHour,
} from '@bombfarm/farm/model/farm-ranking-format';
import { formatClearTime } from '@bombfarm/farm/model/phases-page';

type Props = {
  row: FarmRateRow;
  lang: Lang;
  t: Strings;
  current: boolean;
  onActivate: (phase: number) => void;
  /** 1-based position within the full filtered row set (not the rendered window) — the
   *  per-row half of the `aria-rowcount`/`aria-rowindex` pair that proves virtualization
   *  never silently drops a row. */
  ariaRowIndex: number;
};

/** Presentational, zero math — every cell is a formatted `FarmRateRow` field. */
export function FarmRankingRow({ row, lang, t, current, onActivate, ariaRowIndex }: Props) {
  const activate = () => onActivate(row.phase);
  const oneShotLabels = { yes: t.farmRankingOneShotYes, no: t.farmRankingOneShotNo };
  const oneShotTip = row.oneShot
    ? t.farmRankingOneShotTooltipYes
    : sub(t.farmRankingOneShotTooltipNo, { htk: formatMitigationPct(row.expectedHtk, lang) });
  const gemApplies = dropAppliesOnPhase('gem', row.gate);
  const timeApplies = dropAppliesOnPhase('time', row.gate);

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
      aria-rowindex={ariaRowIndex}
      data-testid={`farm-row-${row.phase}`}
      // Enforces the height the window math and the spacer rows assume — natural row height
      // varies by ~1px (the `tr:last-child` border-bottom rule alone shifts it), which drifts
      // the scroll math across 600 rows if left unpinned.
      style={{ height: ROW_HEIGHT_CSS, minHeight: ROW_HEIGHT_CSS }}
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
          <span
            className={cn('inline-flex items-center', !row.gate && 'invisible')}
            aria-hidden={!row.gate}
          >
            <Tooltip.Provider delay={200} closeDelay={80}>
              <Tooltip.Root>
                <Tooltip.Trigger render={<span className="inline-flex" />}>
                  <ClockIcon />
                </Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Positioner sideOffset={6}>
                    <Tooltip.Popup>{t.farmRankingGateBadge}</Tooltip.Popup>
                  </Tooltip.Positioner>
                </Tooltip.Portal>
              </Tooltip.Root>
            </Tooltip.Provider>
            <span className="sr-only">{t.farmRankingGateBadge}</span>
          </span>
        </span>
      </DataTable.Cell>
      <DataTable.Cell align="right" numeric>
        {formatMitigationPct(row.mitigationPct, lang)}%
      </DataTable.Cell>
      <DataTable.Cell align="right" numeric data-testid={`farm-row-gold-${row.phase}`}>
        {formatRatePerHour(row.goldPerHour, lang)}
      </DataTable.Cell>
      <DataTable.Cell align="right" numeric>
        {formatRatePerHour(row.chestsPerHour, lang)}
      </DataTable.Cell>
      <DataTable.Cell align="right" numeric>
        {formatSignedRatePerHour(row.keysPerHour, lang)}
      </DataTable.Cell>
      <DataTable.Cell align="right" numeric className={cn(!gemApplies && statListMutedRowClass)}>
        {gemApplies ? formatRatePerHour(row.gemsPerHour, lang) : '—'}
      </DataTable.Cell>
      <DataTable.Cell align="right" numeric className={cn(!timeApplies && statListMutedRowClass)}>
        {timeApplies ? formatRatePerHour(row.timePiecesPerHour, lang) : '—'}
      </DataTable.Cell>
      <DataTable.Cell align="right" numeric>
        {formatRatePerHour(row.xpPerHour, lang)}
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
    </DataTable.Row>
  );
}
