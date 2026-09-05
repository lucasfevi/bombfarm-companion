/**
 * The climb as a stepped line — horizontal to the call, then vertical to where the server put
 * the piece, never a diagonal — inside a rolling window of the most recent attempts. Pure, no
 * React import; the component is a thin wrapper that measures its width and draws what this
 * returns. Coordinates are the measured CSS pixels, so a 9px label is 9px on screen.
 */
import type { ForgeCallKind, ForgeRollOutcome } from '@bombfarm/contracts';
import { FORGE_SAFE } from '@bombfarm/domain/forge';

export const FORGE_CHART_HEIGHT = 120;
/** What the first paint draws at, before the wrapper has measured itself. */
export const FORGE_CHART_FALLBACK_WIDTH = 560;
const PAD = { left: 28, right: 8, top: 10, bottom: 18 } as const;
/** The x axis never draws shorter than this many calls, so a short run does not fill the width. */
const MIN_SPAN = 10;
/** Every attempt the window holds gets at least this much x, so marks never come to touch. */
const MARK_SPACING = 12;
const WINDOW = { min: 24, max: 90 } as const;
const MARK_RADIUS = { of: 0.2, min: 1.6, max: 3.6 } as const;
const LINE_WIDTH = { of: 0.06, min: 0.9, max: 1.8 } as const;
const TICK_STEPS = [10, 20, 50] as const;
const WIDEST_TICK_STEP = 50;
/** Three mono digits at 9px, plus the space either side that keeps two labels apart. */
const MIN_TICK_GAP = 28;

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
  readonly markRadius: number;
  readonly lineWidth: number;
};

export type ForgeChartInput = {
  readonly width: number;
  readonly window: number;
  readonly start: number;
  readonly target: number;
  readonly steps: readonly ForgeChartStep[];
};

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

/** How many attempts a chart this wide can hold without crowding its marks. */
export function forgeChartWindow(width: number): number {
  const plot = width - PAD.left - PAD.right;
  if (!Number.isFinite(plot) || plot <= 0) return WINDOW.min;
  return clamp(Math.floor(plot / MARK_SPACING), WINDOW.min, WINDOW.max);
}

function tickEvery(spacing: number): number {
  return TICK_STEPS.find((step) => step * spacing >= MIN_TICK_GAP) ?? WIDEST_TICK_STEP;
}

export function forgeChartGeometry({ width, window: held, start, target, steps }: ForgeChartInput): ForgeChartGeometry {
  const kept = clamp(Math.floor(held), 1, Number.MAX_SAFE_INTEGER);
  const dropped = Math.max(0, steps.length - kept);
  const shown = steps.slice(dropped);
  /** The level the piece stood on before the window's first attempt, so the first segment of the
   *  line is a real transition rather than a gap. */
  const entryLevel = steps[dropped - 1]?.to ?? start;
  const entryAttempt = (shown[0]?.attempt ?? 1) - 1;
  const span = Math.max(Math.min(MIN_SPAN, kept), shown.length);

  const levels = [entryLevel, target, ...shown.map((step) => step.to)];
  const lowest = Math.min(...levels);
  const highest = Math.max(lowest + 1, ...levels);

  const left = PAD.left;
  const right = Math.max(left + MIN_TICK_GAP, width - PAD.right);
  const top = PAD.top;
  const axisY = FORGE_CHART_HEIGHT - PAD.bottom;
  const spacing = (right - left) / span;

  const x = (attempt: number) => round(left + spacing * (attempt - entryAttempt));
  const y = (level: number) => round(axisY - ((axisY - top) * (level - lowest)) / (highest - lowest));

  const points = shown.map((step) => ({ ...step, x: x(step.attempt), y: y(step.to) }));
  const path = [`M${String(x(entryAttempt))} ${String(y(entryLevel))}`, ...points.map((point) => `H${String(point.x)} V${String(point.y)}`)].join(
    ' ',
  );

  const every = tickEvery(spacing);
  const ticks: { x: number; attempt: number }[] = [];
  for (let attempt = Math.ceil(entryAttempt / every) * every; attempt <= entryAttempt + span; attempt += every) {
    ticks.push({ x: x(attempt), attempt });
  }

  return {
    path,
    points,
    floor: FORGE_SAFE >= lowest && FORGE_SAFE <= highest ? { y: y(FORGE_SAFE), level: FORGE_SAFE } : null,
    target: { y: y(target), level: target },
    ticks,
    axisY,
    left,
    right,
    markRadius: round(clamp(spacing * MARK_RADIUS.of, MARK_RADIUS.min, MARK_RADIUS.max)),
    lineWidth: round(clamp(spacing * LINE_WIDTH.of, LINE_WIDTH.min, LINE_WIDTH.max)),
  };
}
