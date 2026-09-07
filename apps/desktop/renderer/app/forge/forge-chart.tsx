'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ForgeStepEvent } from '@bombfarm/contracts';
import { cn } from '@bombfarm/ui';
import { useCopy, type Copy } from '../../lib/copy';
import {
  FORGE_CHART_FALLBACK_WIDTH,
  FORGE_CHART_HEIGHT,
  forgeChartGeometry,
  forgeChartWindow,
} from '../../lib/forge/forge-chart-geometry';
import { forgeLevel } from './forge-labels';

type Mark = Pick<ForgeStepEvent, 'kind' | 'outcome'>;

const OUTCOME_CLASS = { success: 'text-up', critical: 'text-accent', fail: 'text-down' } as const;

/** One colour per outcome, and a safe jump in the muted tone — it is a purchase, not a roll. */
export function forgeMarkClass(mark: Mark): string {
  return mark.kind === 'safe' ? 'text-muted' : OUTCOME_CLASS[mark.outcome];
}

export function forgeMarkLabel(mark: Mark, t: Copy): string {
  if (mark.kind === 'safe') return t.forgeMarkSafe;
  if (mark.outcome === 'critical') return t.forgeMarkCritical;
  return mark.outcome === 'success' ? t.forgeMarkSuccess : t.forgeMarkFail;
}

const DASH = '4 3';

/** The rendered width of the chart, followed as the window is resized — how many attempts the
 *  rolling window holds is a reading of the screen, not a constant. */
function useChartWidth(): { ref: (node: HTMLDivElement | null) => void; width: number } {
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(FORGE_CHART_FALLBACK_WIDTH);
  useEffect(() => {
    if (node === null || typeof ResizeObserver === 'undefined') return;
    const measure = () => {
      const measured = node.getBoundingClientRect().width;
      if (measured > 0) setWidth(measured);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, [node]);
  return { ref: setNode, width };
}

/** Opacity while a reader has asked for no motion, between the pulse's own two ends. */
const GHOST_STILL = 0.45;

export function ForgeChart({
  start,
  target,
  steps,
  pending,
}: {
  start: number;
  target: number;
  steps: readonly ForgeStepEvent[];
  pending: boolean;
}) {
  const t = useCopy();
  const { ref, width } = useChartWidth();
  const geometry = useMemo(
    () => forgeChartGeometry({ width, window: forgeChartWindow(width), start, target, steps, pending }),
    [width, start, target, steps, pending],
  );

  return (
    <div ref={ref} className="min-w-0">
      <svg
        data-testid="forge-chart"
        viewBox={`0 0 ${String(Math.round(width))} ${String(FORGE_CHART_HEIGHT)}`}
        height={FORGE_CHART_HEIGHT}
        className="block w-full"
        role="img"
        aria-label={t.forgeChartLabel}
      >
        <g className="text-line" stroke="currentColor" strokeWidth={1}>
          <line x1={geometry.left} x2={geometry.right} y1={geometry.axisY} y2={geometry.axisY} />
          {geometry.ticks.map((tick) => (
            <line key={tick.attempt} x1={tick.x} x2={tick.x} y1={geometry.axisY} y2={geometry.axisY + 3} />
          ))}
        </g>
        <g className="fill-current font-mono text-[9px] text-muted">
          {geometry.ticks.map((tick) => (
            <text key={tick.attempt} x={tick.x} y={geometry.axisY + 12} textAnchor="middle">
              {tick.attempt}
            </text>
          ))}
        </g>

        {geometry.floor ? (
          <g className="text-muted" stroke="currentColor">
            <line x1={geometry.left} x2={geometry.right} y1={geometry.floor.y} y2={geometry.floor.y} strokeDasharray={DASH} strokeWidth={1} />
            <text x={geometry.left - 3} y={geometry.floor.y + 3} textAnchor="end" stroke="none" className="fill-current font-mono text-[9px]">
              {forgeLevel(geometry.floor.level)}
            </text>
          </g>
        ) : null}
        <g className="text-accent" stroke="currentColor">
          <line x1={geometry.left} x2={geometry.right} y1={geometry.target.y} y2={geometry.target.y} strokeDasharray={DASH} strokeWidth={1} />
          <text x={geometry.left - 3} y={geometry.target.y + 3} textAnchor="end" stroke="none" className="fill-current font-mono text-[9px]">
            {forgeLevel(geometry.target.level)}
          </text>
        </g>

        <path d={geometry.path} fill="none" stroke="currentColor" strokeWidth={geometry.lineWidth} className="text-ink" />
        {geometry.points.map((point) => (
          <circle
            key={point.attempt}
            cx={point.x}
            cy={point.y}
            r={geometry.markRadius}
            fill="currentColor"
            className={cn(forgeMarkClass(point))}
            data-outcome={point.kind === 'safe' ? 'safe' : point.outcome}
            role="img"
            aria-label={forgeMarkLabel(point, t)}
          />
        ))}

        {/* The roll in flight, standing where it will land on the axis at the level it is leaving
            from. It and its stub pulse as one, and the real mark takes its place at the same x, so
            a settling roll reads as a fill-in rather than a blink. */}
        {geometry.ghost ? (
          <g
            data-testid="forge-chart-ghost"
            className="text-accent motion-safe:animate-forge-ghost"
            opacity={GHOST_STILL}
            stroke="currentColor"
            strokeWidth={geometry.lineWidth}
            fill="none"
          >
            <line x1={geometry.ghost.fromX} x2={geometry.ghost.x} y1={geometry.ghost.y} y2={geometry.ghost.y} strokeDasharray={DASH} />
            <circle cx={geometry.ghost.x} cy={geometry.ghost.y} r={geometry.markRadius} role="img" aria-label={t.forgeMarkPending} />
          </g>
        ) : null}
      </svg>
    </div>
  );
}
