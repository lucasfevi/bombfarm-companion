import { gameDifficultyLabel, phaseMapDisplayName } from '@bombfarm/domain/phase-wiki';
import { formatBand, formatPhaseLabel, formatRatePerHour } from '@bombfarm/farm/model/farm-ranking-format';
import { Chip, cn } from '@bombfarm/ui';
import { mutedClass } from '@bombfarm/ui/panel-field.recipe';
import { useAppLang } from '@/shared/context/app-lang';
import { sub } from '@/shared/i18n';
import type { FarmOutlookTile as FarmOutlookTileView } from '../model/farm-card-view';
import { formatSignedPct } from '../model/farm-sentence';

const TONE_CLASS = { up: 'text-up', down: 'text-warn', neutral: 'text-muted' } as const;

export function FarmOutlookTile({
  title,
  tile,
  testId,
}: {
  title: string;
  tile: FarmOutlookTileView;
  testId: string;
}) {
  const { t, lang } = useAppLang();
  const { row, block } = tile;
  const lockLine = !row.locked
    ? null
    : block === null
      ? sub(t.homeCardFarmReachFirst, { phase: row.phase })
      : block.gateInfeasible
        ? sub(t.homeCardFarmClearGateCannot, { gate: block.gate })
        : sub(t.homeCardFarmClearGateFirst, { gate: block.gate });

  return (
    <div className="flex min-w-0 flex-col gap-1" data-testid={testId} data-locked={row.locked || undefined}>
      <p className={cn('m-0 text-xs', mutedClass)}>{title}</p>
      <p className="m-0 flex flex-wrap items-center gap-1.5 font-semibold">
        <span data-testid={`${testId}-phase`}>{formatPhaseLabel(row.phase, lang)}</span>
        <Chip variant="small">{gameDifficultyLabel(row.ato, lang)}</Chip>
        {row.locked ? <Chip variant="small">{t.homeCardFarmLocked}</Chip> : null}
      </p>
      <p className={cn('m-0 text-xs', mutedClass)}>{phaseMapDisplayName(row.phase, lang)}</p>
      <p className="m-0 flex items-baseline gap-2 font-mono tabular-nums">
        <span className="text-xl leading-none font-bold text-accent" data-testid={`${testId}-gold`}>
          {formatRatePerHour(row.goldPerHour, lang)}
        </span>
        <span className={cn('text-sm font-bold', TONE_CLASS[tile.tone])} data-testid={`${testId}-pct`}>
          {formatSignedPct(tile.pct, lang)}
        </span>
        <span className={cn('text-[11px]', mutedClass)}>
          {tile.against === 'best' ? t.homeCardFarmVsBest : t.homeCardFarmVsCurrent}
        </span>
      </p>
      <p className={cn('m-0 font-mono text-[11.5px] tabular-nums', mutedClass)} data-testid={`${testId}-detail`}>
        {formatBand(row.itemLevelLabel)}
      </p>
      {lockLine ? (
        <p className={cn('m-0 text-xs', mutedClass)} data-testid={`${testId}-lock`}>
          {lockLine}
        </p>
      ) : null}
    </div>
  );
}
