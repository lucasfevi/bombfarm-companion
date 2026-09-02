import type { LiveMap } from '@bombfarm/contracts';
import { formatPhaseCoord, phaseMapDisplayName } from '@bombfarm/domain/phase-wiki';
import { formatCompactNumber, type Lang } from '@bombfarm/ui';
import { useCopy, useLocale } from '../../lib/copy';
import { formatCount } from '../../lib/format';

const EM_DASH = '—';

function healthPercent(fraction: number): number {
  return Math.round(fraction * 100);
}

function HealthBar({ fraction }: { fraction: number | null }) {
  return (
    <div data-testid="live-map-health-bar" className="h-1 min-w-0 overflow-hidden rounded-full bg-bg">
      <div
        className="h-full rounded-full bg-[color-mix(in_oklch,var(--accent)_55%,var(--bg-2))]"
        style={{ width: `${String(fraction === null ? 0 : healthPercent(fraction))}%` }}
      />
    </div>
  );
}

function EconomyFigure({
  testId,
  label,
  value,
  lang,
  className,
}: {
  testId: string;
  label: string;
  value: number | null | undefined;
  lang: Lang;
  className: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-[0.06em] text-muted whitespace-nowrap">{label}</span>
      <span data-testid={testId} className={className}>
        {value == null ? EM_DASH : formatCompactNumber(value, lang, 1)}
      </span>
    </div>
  );
}

export function MiniMap({ map }: { map: LiveMap | null }) {
  const t = useCopy();
  const { locale, lang } = useLocale();

  const coord = map === null ? t.liveMapUnknownName : formatPhaseCoord(map.phase, lang);
  const flavourName = map === null ? null : phaseMapDisplayName(map.phase, lang);
  const health = map?.healthFraction ?? null;
  const propsAlive = map?.propsAlive ?? null;
  const propsTotal = map?.propsTotal ?? null;
  const economy = map?.economy ?? undefined;

  const propsValue =
    propsAlive === null
      ? EM_DASH
      : propsTotal === null
        ? formatCount(propsAlive, locale)
        : `${formatCount(propsAlive, locale)}/${formatCount(propsTotal, locale)}`;

  return (
    <section data-testid="mini-map" aria-label={t.liveMapTitle} className="min-w-0 shrink-0 rounded-md border border-line/55 bg-surface p-2">
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span data-testid="live-map-coord" className="text-[18px] font-bold leading-none text-ink">
              {coord}
            </span>
            {flavourName === null ? null : (
              <span data-testid="live-map-name" className="truncate text-[10px] text-muted">
                {flavourName}
              </span>
            )}
          </div>
          {map === null ? null : (
            <span data-testid="live-map-phase" className="text-[12px] font-bold text-muted tabular-nums whitespace-nowrap">
              {`#${String(map.phase)}`}
            </span>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-[0.06em] text-muted">{t.liveMapHealthLabel}</span>
          <span data-testid="live-map-health" className="text-[15px] font-bold tabular-nums text-ink">
            {health === null ? EM_DASH : `${formatCount(healthPercent(health), locale)}%`}
          </span>
          <HealthBar fraction={health} />
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] uppercase tracking-[0.06em] text-muted">{t.liveMapPropsLabel}</span>
          <span data-testid="live-map-props" className="text-[15px] font-bold tabular-nums text-ink">
            {propsValue}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2 border-t border-line/55 pt-2">
          <EconomyFigure
            testId="live-map-xp-per-prop"
            label={t.liveMapXpPerPropLabel}
            value={economy?.xpPerProp}
            lang={lang}
            className="text-[13px] font-bold tabular-nums text-info"
          />
          <EconomyFigure
            testId="live-map-gold-per-prop"
            label={t.liveMapGoldPerPropLabel}
            value={economy?.averageGoldPerProp}
            lang={lang}
            className="text-[13px] font-bold tabular-nums text-gold"
          />
          <EconomyFigure
            testId="live-map-gold-per-clear"
            label={t.liveMapGoldPerClearLabel}
            value={economy?.averageGoldPerClear}
            lang={lang}
            className="text-[13px] font-bold tabular-nums text-gold"
          />
        </div>
      </div>
    </section>
  );
}
