import { gameDifficultyLabel, phaseMapDisplayName } from '@bombfarm/domain/phase-wiki';
import {
  formatBand,
  formatPhaseLabel,
  formatRatePerHour,
} from '@bombfarm/farm/model/farm-ranking-format';
import { ClockIcon } from '@bombfarm/game-art';
import { formatClearTime } from '@bombfarm/hero/model';
import { Bar, Chip, Tooltip, cn, type BarVariant } from '@bombfarm/ui';
import { mutedClass } from '@bombfarm/ui/panel-field.recipe';
import { useAppLang } from '@/shared/context/app-lang';
import type { FarmRankingResult } from '@/shared/stores';

type FarmRateRow = FarmRankingResult['rows'][number];

export function FarmPhaseTile({
  row,
  title,
  barPercent,
  variant,
  testId,
}: {
  row: FarmRateRow;
  title: string;
  barPercent: number;
  variant: BarVariant;
  testId: string;
}) {
  const { t, lang } = useAppLang();

  return (
    <div className="flex min-w-0 flex-col gap-1" data-testid={testId}>
      <p className={cn('m-0 text-xs', mutedClass)}>{title}</p>
      <p className="m-0 flex flex-wrap items-center gap-1.5 font-semibold">
        <span data-testid={`${testId}-phase`}>{formatPhaseLabel(row.phase, lang)}</span>
        <Chip variant="small">{gameDifficultyLabel(row.ato, lang)}</Chip>
        <span
          className={cn('inline-flex items-center', !row.gate && 'invisible')}
          aria-hidden={!row.gate}
          data-testid={`${testId}-gate`}
        >
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
          <span className="sr-only">{t.farmRankingGateBadge}</span>
        </span>
      </p>
      <p className={cn('m-0 text-xs', mutedClass)}>{phaseMapDisplayName(row.phase, lang)}</p>
      <p
        className="m-0 font-mono text-2xl leading-none font-bold tabular-nums text-accent"
        data-testid={`${testId}-gold`}
      >
        {formatRatePerHour(row.goldPerHour, lang)}
      </p>
      <Bar percent={barPercent} variant={variant} />
      <p className={cn('m-0 font-mono text-[11.5px] tabular-nums', mutedClass)} data-testid={`${testId}-detail`}>
        {[
          formatRatePerHour(row.xpPerHour, lang),
          formatBand(row.itemLevelLabel),
          formatClearTime(row.clearSecs),
        ].join(' · ')}
      </p>
    </div>
  );
}
