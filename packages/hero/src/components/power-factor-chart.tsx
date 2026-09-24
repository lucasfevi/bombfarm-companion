'use client';

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import {
  gamePower,
  gamePowerAxisValue,
  type GamePowerAxis,
  type GamePowerInput,
  type GamePowerPoint,
} from '@bombfarm/domain/game-power';
import { cn, formatNumber } from '@bombfarm/ui';
import { sub, type HeroCopy, type Lang } from '../copy';
import {
  axisFraction,
  axisValueAtFraction,
  clampToAxis,
  formatAxisTick,
  formatPowerFigure,
  groupCoincidentMarkers,
  isGuideKey,
  markLabelAnchor,
  placeStripLabels,
  stripRowCount,
  powerPointMarkers,
  powerPointsLegend,
  powerAxisSpec,
  powerChartSeries,
  powerReading,
  powerReadoutText,
  steppedGuide,
  type MarkLabelAnchor,
  type PointDelta,
  type PowerAxisSpec,
} from '../model/power-breakdown';

const tickLabelClass = 'pointer-events-none absolute font-mono text-[10px] leading-none whitespace-nowrap text-muted tabular-nums';
const markLabelClass = 'pointer-events-none absolute text-[10px] leading-none text-muted';
/** One strip row: the 10px label type set solid, with a little air below it. */
const STRIP_ROW_PX = 12;
const dotClass = 'pointer-events-none absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full';
const focusRingClass =
  'focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

const LABEL_ANCHOR_CLASS: Record<MarkLabelAnchor, string> = {
  start: 'pl-1',
  center: '-translate-x-1/2',
  end: '-translate-x-full pr-1',
};

type Plot = { readonly spec: PowerAxisSpec; readonly yMax: number };

function plotX(plot: Plot, x: number): number {
  return axisFraction(plot.spec, x) * 100;
}

function plotY(plot: Plot, power: number): number {
  return 100 - (power / plot.yMax) * 100;
}

function linePath(plot: Plot, points: readonly GamePowerPoint[]): string {
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${String(plotX(plot, point.x))} ${String(plotY(plot, point.power))}`)
    .join(' ');
}

/** A whole-level axis holds each level's Power until the next level, then steps. */
function stairPath(plot: Plot, points: readonly GamePowerPoint[]): string {
  return points
    .map((point, index) =>
      index === 0
        ? `M${String(plotX(plot, point.x))} ${String(plotY(plot, point.power))}`
        : `H${String(plotX(plot, point.x))} V${String(plotY(plot, point.power))}`,
    )
    .join(' ');
}

function VerticalMark({ x, className, dashed }: { x: number; className: string; dashed?: boolean }) {
  return (
    <line
      x1={x}
      x2={x}
      y1={0}
      y2={100}
      className={className}
      strokeWidth={1}
      strokeDasharray={dashed ? '3 3' : undefined}
      vectorEffect="non-scaling-stroke"
    />
  );
}

/**
 * Power across one statistic, every other statistic held at the hero's own value.
 *
 * The curve, the "now" mark and the guide's readout all come from one curve function, so the
 * point the guide sits on is the point the readout prints. The plot is a slider: hover or drag
 * moves the guide, and the arrow keys step it (Page keys by ten steps, Home and End to the ends).
 */
export function PowerFactorChart({
  input,
  axis,
  axisLabel,
  pointDelta,
  t,
  lang,
}: {
  input: GamePowerInput;
  axis: GamePowerAxis;
  axisLabel: string;
  /** The pipeline's per-point gains; `null` draws no +10 / +50 markers. */
  pointDelta: PointDelta | null;
  t: HeroCopy;
  lang: Lang;
}) {
  const spec = useMemo(() => powerAxisSpec(input, axis, pointDelta), [input, axis, pointDelta]);
  const markers = useMemo(() => powerPointMarkers(input, spec, pointDelta), [input, spec, pointDelta]);
  const series = useMemo(() => powerChartSeries(input, spec), [input, spec]);
  const plot: Plot = { spec, yMax: series.yMax };
  const plotRef = useRef<HTMLDivElement | null>(null);
  const [guide, setGuide] = useState<number | null>(null);
  const [plotWidth, setPlotWidth] = useState<number | null>(null);

  useEffect(() => {
    const plotElement = plotRef.current;
    if (!plotElement || typeof ResizeObserver === 'undefined') return;
    const measure = () => setPlotWidth(plotElement.getBoundingClientRect().width);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(plotElement);
    return () => observer.disconnect();
  }, []);

  const now = gamePowerAxisValue(input, axis);
  const nowOnAxis = Math.min(spec.hi, Math.max(spec.lo, now));
  const nowPower = gamePower(input);
  const stripLabels = placeStripLabels(
    [
      { id: 'now', fraction: axisFraction(spec, nowOnAxis), text: t.heroDetailPowerNow },
      ...groupCoincidentMarkers(markers).map(({ marker, label }) => ({
        id: String(marker.points),
        fraction: axisFraction(spec, marker.x),
        text: `+${label.split(' ').join('')}`,
      })),
    ],
    plotWidth,
  );
  const reading = powerReading(input, spec, guide ?? now);
  const readout = powerReadoutText(reading, axisLabel, spec, lang, t);
  const path = spec.integer ? stairPath : linePath;

  const guideAtPointer = (clientX: number) => {
    const rect = plotRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return;
    setGuide(axisValueAtFraction(spec, (clientX - rect.left) / rect.width));
  };
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    guideAtPointer(event.clientX);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const key = event.key;
    if (!isGuideKey(key)) return;
    event.preventDefault();
    setGuide((current) => steppedGuide(spec, current ?? clampToAxis(spec, now), key));
  };

  return (
    <figure className="m-0 flex min-w-0 flex-col gap-1" data-power-chart={axis}>
      <figcaption className="text-[11px] font-bold tracking-[0.06em] text-muted uppercase">{axisLabel}</figcaption>
      <div className="grid grid-cols-[3rem_minmax(0,1fr)] gap-x-1.5">
        <span aria-hidden="true" />
        {/* Its own strip above the plot: inside, the curve can run under it wherever it sits. */}
        <div className="relative" style={{ height: `${String(stripRowCount(stripLabels) * STRIP_ROW_PX)}px` }}>
          {stripLabels.map((label) => (
            <span
              key={label.id}
              {...(label.id === 'now'
                ? { 'data-testid': 'power-now-label' }
                : { 'data-testid': 'power-marker-label', 'data-points': label.id })}
              data-anchor={label.anchor}
              data-row={label.row}
              className={cn(markLabelClass, LABEL_ANCHOR_CLASS[label.anchor], label.id !== 'now' && 'text-gold')}
              style={{ left: `${String(label.fraction * 100)}%`, top: `${String(label.row * STRIP_ROW_PX)}px` }}
            >
              {label.text}
            </span>
          ))}
        </div>
        <div className="relative" aria-hidden="true" data-testid="power-y-ticks">
          {series.yTicks.map((tick) => (
            <span
              key={tick}
              data-tick={tick}
              className={cn(tickLabelClass, 'right-0 -translate-y-1/2')}
              style={{ top: `${String(plotY(plot, tick))}%` }}
            >
              {formatPowerFigure(tick)}
            </span>
          ))}
        </div>
        <div
          ref={plotRef}
          role="slider"
          tabIndex={0}
          aria-label={sub(t.heroDetailPowerChart, { stat: axisLabel })}
          aria-valuemin={spec.lo}
          aria-valuemax={spec.hi}
          aria-valuenow={reading.x}
          aria-valuetext={readout}
          onPointerDown={onPointerDown}
          onPointerMove={(event) => guideAtPointer(event.clientX)}
          onPointerLeave={() => setGuide(null)}
          onKeyDown={onKeyDown}
          className={cn('relative h-36 w-full cursor-crosshair touch-none rounded-sm select-none', focusRingClass)}
        >
          <svg
            className="absolute inset-0 size-full overflow-visible"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {series.yTicks.map((tick) => (
              <line
                key={tick}
                x1={0}
                x2={100}
                y1={plotY(plot, tick)}
                y2={plotY(plot, tick)}
                className="stroke-line opacity-40"
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
                data-gridline={tick}
              />
            ))}
            <line x1={0} x2={100} y1={100} y2={100} className="stroke-line" strokeWidth={1} vectorEffect="non-scaling-stroke" />
            <line
              x1={0}
              x2={0}
              y1={0}
              y2={100}
              className="stroke-line"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
              data-testid="power-y-axis"
            />
            {spec.cap !== null ? <VerticalMark x={plotX(plot, spec.cap)} className="stroke-down" dashed /> : null}
            <VerticalMark x={plotX(plot, nowOnAxis)} className="stroke-muted" dashed />
            {series.cappedCrit.length > 0 ? (
              <path
                d={path(plot, series.cappedCrit)}
                fill="none"
                className="stroke-gold opacity-60"
                strokeWidth={1.5}
                strokeDasharray="5 4"
                vectorEffect="non-scaling-stroke"
                data-series="capped-crit"
              />
            ) : null}
            <path
              d={path(plot, series.solid)}
              fill="none"
              className="stroke-gold"
              strokeWidth={2}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              data-series="measured"
            />
            {series.extrapolated.length > 0 ? (
              <path
                d={path(plot, series.extrapolated)}
                fill="none"
                className="stroke-gold"
                strokeWidth={2}
                strokeDasharray="5 4"
                vectorEffect="non-scaling-stroke"
                data-series="extrapolated"
              />
            ) : null}
            {guide !== null ? <VerticalMark x={plotX(plot, guide)} className="stroke-ink" /> : null}
          </svg>
          {spec.cap !== null ? (
            <span
              className={cn(markLabelClass, 'bottom-1 -translate-x-full pr-1 text-down')}
              style={{ left: `${String(plotX(plot, spec.cap))}%` }}
            >
              {t.heroDetailPowerCap}
            </span>
          ) : null}
          <span
            className={cn(dotClass, 'bg-muted')}
            style={{ left: `${String(plotX(plot, nowOnAxis))}%`, top: `${String(plotY(plot, nowPower))}%` }}
          />
          {markers.map((marker) => (
            <span
              key={marker.points}
              data-testid="power-marker"
              data-points={marker.points}
              data-at-cap={marker.atCap ? 'true' : undefined}
              className={cn(dotClass, 'size-2.5 border-2 border-gold bg-bg')}
              style={{ left: `${String(plotX(plot, marker.x))}%`, top: `${String(plotY(plot, marker.reading.power))}%` }}
            />
          ))}
          {guide !== null ? (
            <span
              data-testid="power-guide-point"
              className={cn(dotClass, 'bg-gold ring-2 ring-bg')}
              style={{ left: `${String(plotX(plot, guide))}%`, top: `${String(plotY(plot, reading.power))}%` }}
            />
          ) : null}
        </div>
        <span aria-hidden="true" />
        <div className="relative mt-1 h-3" aria-hidden="true" data-testid="power-x-ticks">
          {spec.ticks.map((tick) => (
            <span
              key={tick}
              data-tick={tick}
              className={cn(tickLabelClass, 'top-0', LABEL_ANCHOR_CLASS[markLabelAnchor(axisFraction(spec, tick))])}
              style={{ left: `${String(plotX(plot, tick))}%` }}
            >
              {formatAxisTick(axis, tick, lang)}
            </span>
          ))}
        </div>
      </div>
      <p className="m-0 font-mono text-[11px] leading-snug text-ink tabular-nums" aria-live="polite" data-testid="power-readout">
        {readout}
      </p>
      {markers.length > 0 ? (
        <p className="m-0 font-mono text-[11px] leading-snug text-muted tabular-nums" data-testid="power-points-legend">
          {powerPointsLegend(markers, lang, t)}
        </p>
      ) : null}
      {reading.cappedCritPower !== null ? (
        <p className="m-0 font-mono text-[11px] leading-snug text-muted tabular-nums" data-testid="power-readout-capped">
          {sub(t.heroDetailPowerReadoutCapped, { power: formatPowerFigure(reading.cappedCritPower) })}
        </p>
      ) : null}
      {spec.cappedCritLine ? <p className="m-0 text-[10px] text-muted">{t.heroDetailPowerCappedLegend}</p> : null}
      {reading.extrapolated && spec.checkedMax !== null ? (
        <p className="m-0 text-[11px] leading-snug text-warn" data-testid="power-readout-extrapolated">
          {sub(t.heroDetailPowerExtrapolated, { pct: `${formatNumber(spec.checkedMax, lang, 2)}%` })}
        </p>
      ) : null}
    </figure>
  );
}
