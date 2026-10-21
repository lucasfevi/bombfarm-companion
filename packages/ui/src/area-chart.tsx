import { LineChart, type LineChartProps } from './line-chart';

export type AreaChartProps = Omit<LineChartProps, 'fill'>;

/** A line chart with the body under each line shaded. */
export function AreaChart(props: AreaChartProps) {
  return <LineChart {...props} fill />;
}
