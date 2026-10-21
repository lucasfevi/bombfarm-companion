import { ChartFrame } from './chart-frame';
import { buildChartModel, lineXs, yFor, type ChartModel, type ChartProps, type ResolvedSeries } from './chart-model';

export type LineChartProps = ChartProps & {
  /** Shades the body under each line, in the series colour at 20%. */
  fill?: boolean;
};

interface Point {
  readonly x: number;
  readonly y: number;
}

function segmentsOf(model: ChartModel, xs: readonly number[], series: ResolvedSeries): readonly (readonly Point[])[] {
  const segments: Point[][] = [];
  let current: Point[] | null = null;
  series.values.forEach((value, index) => {
    const x = xs[index];
    if (value === null || x === undefined) {
      current = null;
      return;
    }
    if (current === null) {
      current = [];
      segments.push(current);
    }
    current.push({ x, y: yFor(model, value) });
  });
  return segments;
}

function lineFor(segment: readonly Point[]): string {
  return segment.map((point, index) => `${index === 0 ? 'M' : 'L'}${String(point.x)} ${String(point.y)}`).join(' ');
}

function areaFor(segment: readonly Point[], bottom: number): string {
  const first = segment[0];
  const last = segment[segment.length - 1];
  if (first === undefined || last === undefined) return '';
  return `${lineFor(segment)} L${String(last.x)} ${String(bottom)} L${String(first.x)} ${String(bottom)} Z`;
}

/**
 * Line chart over a fixed coordinate space. Server-safe: every path is computed from the props, so
 * the first render is the whole graphic. A `null` reading breaks the line instead of being bridged,
 * and a reading with neighbours on neither side is drawn as a dot so it is not lost.
 */
export function LineChart({ fill = false, series, labels, width, height, tickCount, ...frame }: LineChartProps) {
  const model = buildChartModel({ series, labels, width, height, tickCount });
  const xs = lineXs(model);
  const bottom = model.box.bottom;

  return (
    <ChartFrame model={model} xs={xs} {...frame}>
      {model.series.map((series, seriesIndex) => {
        const segments = segmentsOf(model, xs, series);
        const end = segments[segments.length - 1]?.at(-1);
        return (
          <g key={seriesIndex} data-chart-series={seriesIndex}>
            {fill
              ? segments.map((segment, index) =>
                  segment.length < 2 ? null : (
                    <path
                      key={`area-${String(index)}`}
                      d={areaFor(segment, bottom)}
                      fill={`color-mix(in srgb, ${series.color} 20%, transparent)`}
                      stroke="none"
                    />
                  ),
                )
              : null}
            {segments.map((segment, index) =>
              segment.length < 2 ? (
                segment[0] === end ? null : (
                  <circle key={`dot-${String(index)}`} cx={segment[0]?.x} cy={segment[0]?.y} r="2.5" fill={series.color} />
                )
              ) : (
                <path
                  key={`line-${String(index)}`}
                  d={lineFor(segment)}
                  fill="none"
                  stroke={series.color}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ),
            )}
            {end === undefined ? null : (
              <circle cx={end.x} cy={end.y} r="4" fill={series.color} stroke="var(--color-surface)" strokeWidth="2" />
            )}
          </g>
        );
      })}
    </ChartFrame>
  );
}
