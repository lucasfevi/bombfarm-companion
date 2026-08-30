import { cn } from './cn';

const VIEWBOX_WIDTH = 100;
/** Half the stroke width, in viewBox units. `vector-effect="non-scaling-stroke"` keeps the stroke
 *  2 device pixels wide however far the box is stretched, so one unit of headroom at each edge is
 *  what stops a run at the extremes from being sliced in half by the viewBox. */
const STROKE_PAD = 1;
const DEFAULT_HEIGHT = 44;

export type SparklineProps = {
  /** Oldest first. `null` is a slot with no reading — the line breaks across it rather than
   *  drawing a straight run through it, which would invent readings that were never taken. A
   *  genuine zero is not a gap and must be passed as `0`. */
  values: readonly (number | null)[];
  ariaLabel: string;
  height?: number;
  /** The line and its fill are drawn in `currentColor`, so the tone comes from a text colour on
   *  the caller (`className="text-gold"`) rather than from a variant here. */
  className?: string;
};

interface Point {
  readonly x: number;
  readonly y: number;
}

/** Two decimals is finer than any device pixel this is drawn at, and keeps the emitted path short
 *  and byte-identical across runs. */
function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * The y domain runs from zero to the tallest reading, never from the smallest — a window whose
 * readings sit between 900k and 1m is a flat stretch, and a floor at the minimum would redraw it
 * as a mountain range. An all-zero (or empty) window has no scale at all and lies flat on the
 * baseline.
 */
function pointsFor(values: readonly (number | null)[], height: number): readonly (Point | null)[] {
  const readings = values.filter((value): value is number => value !== null);
  const max = readings.length === 0 ? 0 : Math.max(...readings);
  const bottom = height - STROKE_PAD;
  const span = bottom - STROKE_PAD;
  const lastIndex = values.length - 1;
  return values.map((value, index) => {
    if (value === null) return null;
    const x = lastIndex <= 0 ? VIEWBOX_WIDTH / 2 : (index / lastIndex) * VIEWBOX_WIDTH;
    const y = max <= 0 ? bottom : bottom - (value / max) * span;
    return { x: round(x), y: round(y) };
  });
}

function runsOf(points: readonly (Point | null)[]): readonly (readonly Point[])[] {
  const runs: Point[][] = [];
  let current: Point[] | null = null;
  for (const point of points) {
    if (point === null) {
      current = null;
      continue;
    }
    if (current === null) {
      current = [];
      runs.push(current);
    }
    current.push(point);
  }
  return runs;
}

function lineFor(run: readonly Point[]): string {
  return run.map((point, index) => `${index === 0 ? 'M' : 'L'}${String(point.x)} ${String(point.y)}`).join(' ');
}

/** Closed back down to the baseline rather than to the run's own lowest point, so the shaded body
 *  reads as "how much", which is what a rate against a zero floor means. */
function areaFor(run: readonly Point[], height: number): string | null {
  const first = run[0];
  const last = run[run.length - 1];
  if (first === undefined || last === undefined || run.length < 2) return null;
  const bottom = height - STROKE_PAD;
  return `${lineFor(run)} L${String(last.x)} ${String(bottom)} L${String(first.x)} ${String(bottom)} Z`;
}

/**
 * Sparkline primitive — a bare trend line for a series of readings, sized by its container rather
 * than by its own aspect ratio (`preserveAspectRatio="none"` plus a non-scaling stroke), so it
 * takes whatever width the layout has left and contributes none of its own.
 *
 * An empty or all-`null` series still draws its baseline at full height: a panel that dropped the
 * chart entirely would be shorter than the same panel a tick later.
 */
export function Sparkline({ values, ariaLabel, height = DEFAULT_HEIGHT, className }: SparklineProps) {
  const runs = runsOf(pointsFor(values, height));
  const baseline = height - STROKE_PAD;

  return (
    <svg
      data-sparkline
      role="img"
      aria-label={ariaLabel}
      viewBox={`0 0 ${String(VIEWBOX_WIDTH)} ${String(height)}`}
      width="100%"
      height={height}
      preserveAspectRatio="none"
      className={cn('block', className)}
    >
      <line
        x1="0"
        y1={baseline}
        x2={VIEWBOX_WIDTH}
        y2={baseline}
        stroke="var(--line)"
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />
      {runs.map((run) => {
        const area = areaFor(run, height);
        return area === null ? null : (
          <path key={`area-${String(run[0]?.x ?? 0)}`} d={area} fill="currentColor" fillOpacity="0.13" stroke="none" />
        );
      })}
      {runs.map((run) => (
        <path
          key={`line-${String(run[0]?.x ?? 0)}`}
          d={lineFor(run)}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}
