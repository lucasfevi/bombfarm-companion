'use client';

import { useMemo } from 'react';
import type { ForgeStepEvent } from '@bombfarm/contracts';
import { cn } from '@bombfarm/ui';
import { useCopy, type Copy } from '../../lib/copy';
import { FORGE_CHART_BOX, forgeChartGeometry } from '../../lib/forge/forge-chart-geometry';
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

export function ForgeChart({ start, target, steps }: { start: number; target: number; steps: readonly ForgeStepEvent[] }) {
  const t = useCopy();
  const geometry = useMemo(() => forgeChartGeometry(start, target, steps), [start, target, steps]);

  return (
    <svg
      data-testid="forge-chart"
      viewBox={`0 0 ${String(FORGE_CHART_BOX.width)} ${String(FORGE_CHART_BOX.height)}`}
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

      <path d={geometry.path} fill="none" stroke="currentColor" strokeWidth={1.5} className="text-ink" />
      {geometry.points.map((point) => (
        <circle
          key={point.attempt}
          cx={point.x}
          cy={point.y}
          r={3}
          fill="currentColor"
          className={cn(forgeMarkClass(point))}
          data-outcome={point.kind === 'safe' ? 'safe' : point.outcome}
          role="img"
          aria-label={forgeMarkLabel(point, t)}
        />
      ))}
    </svg>
  );
}
