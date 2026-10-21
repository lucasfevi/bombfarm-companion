import { ChartFrame } from './chart-frame';
import { barXs, buildChartModel, round, yFor, type ChartProps, type ChartSeries } from './chart-model';

export type BarChartProps = Omit<ChartProps, 'series'> & {
  /** One series; a bar chart has no way to lay several side by side. */
  series: readonly [ChartSeries];
};

const MAX_BAR_WIDTH = 40;
const SLOT_FILL = 0.6;
const MAX_RADIUS = 4;

/** Square at the foot, rounded at the top, so the bar still sits flat on the baseline. */
function barPath(x: number, width: number, top: number, bottom: number): string {
  const radius = round(Math.min(MAX_RADIUS, width / 2, bottom - top));
  const right = round(x + width);
  return [
    `M${String(x)} ${String(bottom)}`,
    `V${String(round(top + radius))}`,
    `A${String(radius)} ${String(radius)} 0 0 1 ${String(round(x + radius))} ${String(top)}`,
    `H${String(round(right - radius))}`,
    `A${String(radius)} ${String(radius)} 0 0 1 ${String(right)} ${String(round(top + radius))}`,
    `V${String(bottom)}`,
    'Z',
  ].join(' ');
}

/**
 * Bar chart over a fixed coordinate space. Server-safe, like the line chart. A zero reading is a
 * 1px baseline in the line colour, so it reads as "measured, nothing" rather than as a missing bar.
 */
export function BarChart({ series: input, labels, width: chartWidth, height, tickCount, ...frame }: BarChartProps) {
  const model = buildChartModel({ series: input, labels, width: chartWidth, height, tickCount });
  const xs = barXs(model);
  const { box } = model;
  const slot = (box.right - box.left) / Math.max(model.count, 1);
  const width = round(Math.min(MAX_BAR_WIDTH, slot * SLOT_FILL));
  const series = model.series[0];

  return (
    <ChartFrame model={model} xs={xs} {...frame}>
      <g data-chart-series={0}>
        {series?.values.map((value, index) => {
          const center = xs[index];
          if (value === null || center === undefined) return null;
          const x = round(center - width / 2);
          if (value === 0) {
            return <rect key={index} x={x} y={box.bottom - 1} width={width} height="1" fill="var(--color-line)" />;
          }
          return <path key={index} d={barPath(x, width, yFor(model, value), box.bottom)} fill={series.color} />;
        })}
      </g>
    </ChartFrame>
  );
}
