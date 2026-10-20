'use client';

import { useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { cn } from './cn';

export type ChartPointerProps = {
  /** The chart's coordinate space; the layer maps the pointer into it from the rendered size. */
  width: number;
  height: number;
  /** Top and bottom of the plot, which the crosshair spans. */
  plotTop: number;
  plotBottom: number;
  /** The x of each data index, precomputed where the chart was drawn. */
  xs: readonly number[];
  /** The tooltip content for each data index. */
  tooltips: readonly ReactNode[];
  ariaLabel: string;
};

function nearestIndex(xs: readonly number[], x: number): number | null {
  let best: number | null = null;
  let bestDistance = Infinity;
  xs.forEach((candidate, index) => {
    const distance = Math.abs(candidate - x);
    if (distance < bestDistance) {
      best = index;
      bestDistance = distance;
    }
  });
  return best;
}

const TOOLTIP_CLASS =
  'pointer-events-none absolute z-[2] rounded-sm bg-ink px-2 py-1.5 text-xs leading-[1.35] whitespace-nowrap text-bg tabular-nums';

/**
 * The chart's only client code: a transparent layer over the plot that follows the pointer (or the
 * arrow keys) to the nearest data index, draws the crosshair there and shows that index's tooltip.
 * The SVG under it is complete without it, so a chart that has not hydrated yet is still a chart.
 */
export function ChartPointer({ width, height, plotTop, plotBottom, xs, tooltips, ariaLabel }: ChartPointerProps) {
  const [active, setActive] = useState<number | null>(null);
  const activeX = active === null ? undefined : xs[active];
  const tooltip = active === null ? undefined : tooltips[active];

  function follow(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    setActive(nearestIndex(xs, ((event.clientX - rect.left) / rect.width) * width));
  }

  function step(event: KeyboardEvent<HTMLDivElement>) {
    const last = xs.length - 1;
    if (last < 0) return;
    const moves: Record<string, number | null> = {
      ArrowLeft: active === null ? last : Math.max(0, active - 1),
      ArrowRight: active === null ? 0 : Math.min(last, active + 1),
      Home: 0,
      End: last,
      Escape: null,
    };
    if (!(event.key in moves)) return;
    event.preventDefault();
    setActive(moves[event.key] ?? null);
  }

  return (
    <>
      <svg
        aria-hidden
        viewBox={`0 0 ${String(width)} ${String(height)}`}
        className="pointer-events-none absolute inset-0 block h-full w-full"
      >
        {activeX === undefined ? null : (
          <line
            data-chart-crosshair
            x1={activeX}
            x2={activeX}
            y1={plotTop}
            y2={plotBottom}
            stroke="var(--color-muted)"
            strokeDasharray="2 3"
          />
        )}
      </svg>
      {activeX === undefined || tooltip === undefined ? null : (
        <div
          data-chart-tooltip
          className={cn(TOOLTIP_CLASS, activeX / width > 0.6 ? '-ml-3 -translate-x-full' : 'ml-3')}
          style={{ left: `${String((activeX / width) * 100)}%`, top: `${String((plotTop / height) * 100)}%` }}
        >
          {tooltip}
        </div>
      )}
      <div
        data-chart-plot
        role="group"
        tabIndex={0}
        aria-label={ariaLabel}
        className="absolute inset-0 touch-pan-y rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        onPointerMove={follow}
        onPointerDown={follow}
        onPointerLeave={() => {
          setActive(null);
        }}
        onPointerCancel={() => {
          setActive(null);
        }}
        onBlur={() => {
          setActive(null);
        }}
        onKeyDown={step}
      />
    </>
  );
}
