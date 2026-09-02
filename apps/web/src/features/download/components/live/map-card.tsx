import { Panel, formatCompactNumber, formatNumber } from '@bombfarm/ui';
import { formatPhaseCoord, phaseMapDisplayName } from '@bombfarm/domain/phase-wiki';
import type { Lang } from '@/shared/i18n';
import { liveLabel } from '../../model/live-replica-copy';
import type { ReplicaDensity, ReplicaFrame } from '../../model/live-replica-data';
import { ReplicaBlock } from './replica-block';
import { ReplicaCardHead } from './replica-card-head';
import { ReplicaFigure } from './replica-figure';
import { ReplicaReading } from './replica-reading';

/**
 * The map header is the desktop's, structure for structure: the in-game difficulty coordinate as
 * the headline, the wiki flavour name under it, the phase number on the right. Both names come
 * from `@bombfarm/domain`'s own helpers rather than a string typed in here — the same call the
 * desktop makes, so this part of the drawing cannot drift or go untranslated.
 *
 * The compact density is the second Live window's map: the same header, health and props stacked
 * label-over-value instead of read across a row, and the economy figures as a three-column strip
 * with no "estimated" heading over them.
 */
export function MapCard({
  lang,
  map,
  density = 'full',
}: {
  lang: Lang;
  map: ReplicaFrame['map'];
  density?: ReplicaDensity;
}) {
  const header = (
    <div className="flex items-baseline justify-between gap-3">
      <span className="flex min-w-0 flex-col gap-0.5">
        <span
          className={
            density === 'compact'
              ? 'text-[18px] leading-none font-bold text-ink'
              : 'text-[20px] leading-none font-bold text-ink'
          }
        >
          {formatPhaseCoord(map.phase, lang)}
        </span>
        <span
          className={
            density === 'compact'
              ? 'truncate text-[10px] text-muted'
              : 'truncate text-[11px] text-muted'
          }
        >
          {phaseMapDisplayName(map.phase, lang)}
        </span>
      </span>
      <span
        className={
          density === 'compact'
            ? 'text-[12px] font-bold whitespace-nowrap text-muted tabular-nums'
            : 'text-[13px] font-bold whitespace-nowrap text-muted tabular-nums'
        }
      >
        #{map.phase}
      </span>
    </div>
  );

  const healthBar = (
    <div className="h-1.5 overflow-hidden rounded-full bg-bg">
      <div
        className="h-full rounded-full bg-[color-mix(in_oklch,var(--accent)_55%,var(--bg-2))]"
        style={{ width: `${String(map.healthPercent)}%` }}
      />
    </div>
  );

  const propsValue = `${formatNumber(map.propsAlive, lang, 0)}/${formatNumber(map.propsTotal, lang, 0)}`;

  if (density === 'compact') {
    return (
      <Panel className="flex w-80 max-w-full shrink-0 flex-col gap-2 p-2">
        {header}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] tracking-wide text-muted uppercase">
            {liveLabel('liveMapHealthLabel', lang)}
          </span>
          <span className="text-[15px] leading-none font-bold text-ink tabular-nums">
            {formatNumber(map.healthPercent, lang)}%
          </span>
          {healthBar}
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] tracking-wide text-muted uppercase">
            {liveLabel('liveMapPropsLabel', lang)}
          </span>
          <span className="text-[15px] leading-none font-bold text-ink tabular-nums">
            {propsValue}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2 border-t border-line/55 pt-2">
          <ReplicaFigure
            label={liveLabel('liveMapXpPerPropLabel', lang)}
            value={formatNumber(map.xpPerProp, lang, 0)}
            valueClass="text-info"
          />
          <ReplicaFigure
            label={liveLabel('liveMapGoldPerPropLabel', lang)}
            value={formatNumber(map.goldPerProp, lang, 0)}
            valueClass="text-gold"
          />
          <ReplicaFigure
            label={liveLabel('liveMapGoldPerClearLabel', lang)}
            value={formatCompactNumber(map.goldPerClear, lang)}
            valueClass="text-gold"
          />
        </div>
      </Panel>
    );
  }

  return (
    <Panel className="flex flex-col p-3">
      <ReplicaCardHead title={liveLabel('liveMapTitle', lang)} />
      <div className="flex flex-col gap-3">
        {header}

        <div className="flex flex-col gap-2">
          <ReplicaReading
            label={liveLabel('liveMapHealthLabel', lang)}
            value={`${formatNumber(map.healthPercent, lang)}%`}
          />
          {healthBar}
          <ReplicaReading label={liveLabel('liveMapPropsLabel', lang)} value={propsValue} />
        </div>
      </div>
      <div className="mt-3 flex flex-col gap-2 border-t border-line/55 pt-3">
        <span className="self-start text-[10px] tracking-wide text-muted uppercase">
          {liveLabel('liveMapEstimateNote', lang)}
        </span>
        <div className="grid grid-cols-3 gap-2">
          <ReplicaBlock
            label={liveLabel('liveMapXpPerPropLabel', lang)}
            value={formatNumber(map.xpPerProp, lang, 0)}
            valueClass="text-info"
          />
          <ReplicaBlock
            label={liveLabel('liveMapGoldPerPropLabel', lang)}
            value={formatNumber(map.goldPerProp, lang, 0)}
            valueClass="text-gold"
          />
          <ReplicaBlock
            label={liveLabel('liveMapGoldPerClearLabel', lang)}
            value={formatCompactNumber(map.goldPerClear, lang)}
            valueClass="text-gold"
          />
        </div>
      </div>
    </Panel>
  );
}
