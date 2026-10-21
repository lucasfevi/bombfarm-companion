import { yFor, type ChartModel } from './chart-model';

export type ChartGridProps = {
  model: ChartModel;
  formatValue?: (value: number) => string;
};

/** Horizontal rules at each tick of the y axis, with the tick value at the left edge. Zero is
 *  the baseline and is drawn in the stronger line colour. */
export function ChartGrid({ model, formatValue = String }: ChartGridProps) {
  const { box, scale } = model;
  return (
    <g data-chart-grid>
      {scale.ticks.map((tick) => {
        const y = yFor(model, tick);
        return (
          <g key={tick}>
            <line
              x1={box.left}
              x2={box.right}
              y1={y}
              y2={y}
              stroke={tick === 0 ? 'var(--color-line)' : 'var(--color-chart-grid)'}
              strokeWidth="1"
            />
            <text x={box.left - 8} y={y + 3.5} textAnchor="end" className="fill-muted font-mono text-[10.5px]">
              {formatValue(tick)}
            </text>
          </g>
        );
      })}
    </g>
  );
}
