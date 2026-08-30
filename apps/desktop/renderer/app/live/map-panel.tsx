import type { ReactNode } from 'react';
import type { LiveMap } from '@bombfarm/contracts';
import { formatPhaseCoord, phaseMapDisplayName } from '@bombfarm/domain/phase-wiki';
import { formatCompactNumber, Panel, Tooltip, type Lang } from '@bombfarm/ui';
import { useCopy, useLocale } from '../../lib/copy';
import { formatCount } from '../../lib/format';

const EM_DASH = '—';

/** The health reading is a whole percent: the wire sends a byte, so a decimal place would print
 *  precision the source does not carry. */
function healthPercent(fraction: number): number {
  return Math.round(fraction * 100);
}

/**
 * The map's own health, as a reading and a track. Its own track rather than `packages/ui`'s `Bar`
 * for the same reason `energy-bar.tsx` has one: that primitive is sized and squared off for the
 * planner's ranking rows.
 *
 * An absent fraction still draws the empty track — a panel that drops it is shorter than the same
 * panel a tick later, and the reading beside it already says "not sent" rather than "zero".
 */
function HealthBar({ fraction }: { fraction: number | null }) {
  return (
    <div className="h-1.5 min-w-0 overflow-hidden rounded-full bg-bg">
      <div
        className="h-full rounded-full bg-[color-mix(in_oklch,var(--accent)_55%,var(--bg-2))] transition-[width] duration-300"
        style={{ width: `${String(fraction === null ? 0 : healthPercent(fraction))}%` }}
      />
    </div>
  );
}

function Reading({ label, value, children }: { label: string; value: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10.5px] uppercase tracking-[0.06em] text-muted whitespace-nowrap">{label}</span>
      <span className="text-[23px] font-bold text-ink tabular-nums leading-none">{value}</span>
      {children}
    </div>
  );
}

export function MapPanel({ map }: { map: LiveMap | null }) {
  const t = useCopy();
  const { locale, lang } = useLocale();

  const coord = map === null ? t.liveMapUnknownName : formatPhaseCoord(map.phase, lang);
  const flavourName = map === null ? null : phaseMapDisplayName(map.phase, lang);

  const health = map?.healthFraction ?? null;
  const propsAlive = map?.propsAlive ?? null;
  const propsTotal = map?.propsTotal ?? null;
  const economy = map?.economy ?? undefined;

  // The total alone is not a reading — "of 75" with no count in front of it says nothing about
  // the run, so the pair collapses to a dash together rather than printing half of itself.
  const propsValue =
    propsAlive === null
      ? EM_DASH
      : propsTotal === null
        ? formatCount(propsAlive, locale)
        : `${formatCount(propsAlive, locale)}/${formatCount(propsTotal, locale)}`;

  return (
    <Panel data-testid="live-map" aria-label={t.liveMapTitle}>
      <div className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span data-testid="live-map-coord" className="text-[23px] font-bold text-ink leading-none">
              {coord}
            </span>
            {flavourName === null ? null : (
              <span data-testid="live-map-name" className="truncate text-[11px] text-muted">
                {flavourName}
              </span>
            )}
          </div>
          {map === null ? null : (
            <span data-testid="live-map-phase" className="text-[13px] font-bold text-muted tabular-nums whitespace-nowrap">
              {`#${String(map.phase)}`}
            </span>
          )}
        </div>

        <Reading
          label={t.liveMapHealthLabel}
          value={
            <span data-testid="live-map-health">{health === null ? EM_DASH : `${formatCount(healthPercent(health), locale)}%`}</span>
          }
        >
          <HealthBar fraction={health} />
        </Reading>

        <Reading label={t.liveMapPropsLabel} value={<span data-testid="live-map-props">{propsValue}</span>} />

        <div className="flex flex-col gap-2 border-t border-line/55 pt-3">
          <EstimateNote />
          <div className="grid grid-cols-3 gap-3">
            <EconomyFigure
              testId="live-map-xp-per-prop"
              label={t.liveMapXpPerPropLabel}
              value={economy?.xpPerProp}
              lang={lang}
              className="text-[15px] font-bold tabular-nums text-info"
            />
            <EconomyFigure
              testId="live-map-gold-per-prop"
              label={t.liveMapGoldPerPropLabel}
              value={economy?.averageGoldPerProp}
              lang={lang}
              className="text-[15px] font-bold tabular-nums text-gold"
            />
            <EconomyFigure
              testId="live-map-gold-per-clear"
              label={t.liveMapGoldPerClearLabel}
              value={economy?.averageGoldPerClear}
              lang={lang}
              className="text-[15px] font-bold tabular-nums text-gold"
            />
          </div>
        </div>
      </div>
    </Panel>
  );
}

/**
 * Marks the three figures below it as modelled. The measured gold/XP rates sit in the panel
 * immediately to the left, so without this the two sets of numbers read as the same kind of
 * reading — and they are not: these say what the map pays on average, not what it has paid.
 */
function EstimateNote() {
  const t = useCopy();
  return (
    <Tooltip.Provider>
      <Tooltip.Root>
        <Tooltip.Trigger
          type="button"
          data-testid="live-map-estimate-trigger"
          aria-label={`${t.liveMapEstimateNote}: ${t.liveMapEstimateBody}`}
          className="self-start border-0 bg-transparent p-0 text-[10.5px] uppercase tracking-[0.06em] text-muted underline decoration-dotted underline-offset-2 cursor-help hover:text-ink focus-visible:rounded-sm focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {t.liveMapEstimateNote}
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner sideOffset={6}>
            <Tooltip.Popup>
              <p className="m-0" data-testid="live-map-estimate-body">
                {t.liveMapEstimateBody}
              </p>
            </Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
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
  value: number | undefined;
  lang: Lang;
  className: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-[10.5px] uppercase tracking-[0.06em] text-muted whitespace-nowrap">{label}</span>
      <span data-testid={testId} className={className}>
        {value === undefined ? EM_DASH : formatCompactNumber(value, lang)}
      </span>
    </div>
  );
}
