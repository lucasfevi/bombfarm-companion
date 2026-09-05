/**
 * The climb as a stepped line — horizontal to the call, then vertical to where the server put
 * the piece, never a diagonal — in a fixed viewBox the SVG scales to its width. Pure, no React
 * import; the component is a thin wrapper over what this returns.
 */
import type { ForgeCallKind, ForgeRollOutcome } from '@bombfarm/contracts';
import { FORGE_SAFE } from '@bombfarm/domain/forge';

export const FORGE_CHART_BOX = { width: 320, height: 120 } as const;
const PAD = { left: 28, right: 8, top: 10, bottom: 18 } as const;
/** The x axis never draws shorter than this many calls, so a short run does not fill the width. */
const MIN_ATTEMPTS = 10;
const TICK_EVERY = 10;

export type ForgeChartStep = {
  readonly attempt: number;
  readonly to: number;
  readonly outcome: ForgeRollOutcome;
  readonly kind: ForgeCallKind;
};

export type ForgeChartPoint = ForgeChartStep & { readonly x: number; readonly y: number };

export type ForgeChartGeometry = {
  readonly path: string;
  readonly points: readonly ForgeChartPoint[];
  readonly floor: { readonly y: number; readonly level: number } | null;
  readonly target: { readonly y: number; readonly level: number };
  readonly ticks: readonly { readonly x: number; readonly attempt: number }[];
  readonly axisY: number;
  readonly left: number;
  readonly right: number;
};

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

export function forgeChartGeometry(start: number, target: number, steps: readonly ForgeChartStep[]): ForgeChartGeometry {
  const levels = [start, target, ...steps.map((step) => step.to)];
  const lowest = Math.min(...levels);
  const highest = Math.max(lowest + 1, ...levels);
  const attempts = Math.max(MIN_ATTEMPTS, steps.length);

  const left = PAD.left;
  const right = FORGE_CHART_BOX.width - PAD.right;
  const top = PAD.top;
  const axisY = FORGE_CHART_BOX.height - PAD.bottom;

  const x = (attempt: number) => round(left + ((right - left) * attempt) / attempts);
  const y = (level: number) => round(axisY - ((axisY - top) * (level - lowest)) / (highest - lowest));

  const points = steps.map((step) => ({ ...step, x: x(step.attempt), y: y(step.to) }));
  const path = [`M${String(x(0))} ${String(y(start))}`, ...points.map((point) => `H${String(point.x)} V${String(point.y)}`)].join(' ');

  const ticks: { x: number; attempt: number }[] = [];
  for (let attempt = 0; attempt <= attempts; attempt += TICK_EVERY) ticks.push({ x: x(attempt), attempt });

  return {
    path,
    points,
    floor: FORGE_SAFE >= lowest && FORGE_SAFE <= highest ? { y: y(FORGE_SAFE), level: FORGE_SAFE } : null,
    target: { y: y(target), level: target },
    ticks,
    axisY,
    left,
    right,
  };
}
