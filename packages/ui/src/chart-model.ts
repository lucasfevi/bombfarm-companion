import { niceScale, type NiceScale } from './chart-scale';

export const DEFAULT_CHART_WIDTH = 640;
export const DEFAULT_CHART_HEIGHT = 230;
export const DEFAULT_TICK_COUNT = 4;

export type ChartSeries = {
  label: string;
  /** Oldest first, one per x position. `null` is a slot with no reading: a line breaks across it
   *  and a bar is left out. Negative readings are unsupported and draw as zero; a value that is
   *  not a finite number is read as `null`. */
  values: readonly (number | null)[];
  /** Any CSS colour. Defaults to the series token for the series' position. */
  color?: string;
};

export type ChartTable = {
  /** The disclosure's summary line. */
  summary: string;
  /** The heading of the first column, the one holding each x label. */
  labelHeading: string;
  /** Also lists the `details` rows, one extra column per detail label (in order of first
   *  appearance), after the series columns. */
  detailColumns?: boolean;
};

/** An extra tooltip row for one data index: not drawn, only read. The value is pre-formatted. */
export type ChartDetailRow = {
  label: string;
  value: string;
};

/** Marks the data from index `from` onward as still in progress. */
export type ChartPartial = {
  /** The first in-progress index; the last index alone is `labels.length - 1`. */
  from: number;
  /** The caller's copy for the marker, such as "(in progress)". Shown by the tooltip and table. */
  label: string;
};

export type ChartProps = {
  series: readonly ChartSeries[];
  /** One label per x position, thinned on the axis to what fits. */
  labels: readonly string[];
  /** Names the chart for assistive tech; the same text labels the keyboard-focusable plot. */
  ariaLabel: string;
  /** Shown instead of the chart when no series has a reading to draw. */
  empty: string;
  /** Formats the axis ticks and the tooltip values. Defaults to the plain number. */
  formatValue?: (value: number) => string;
  /** The fixed coordinate space. The SVG scales to its container; these set its proportions. */
  width?: number;
  height?: number;
  /** Intervals the y axis is aimed at. */
  tickCount?: number;
  /** The most x labels drawn; the rest are dropped evenly, newest kept. */
  maxXLabels?: number;
  /** Draw the legend. Defaults to on when there is more than one series. */
  legend?: boolean;
  /** Extra tooltip rows per data index (`details[i]` belongs to index `i`), shown under the series
   *  rows and, with `table.detailColumns`, as table columns. They are never drawn on the plot. */
  details?: readonly (readonly ChartDetailRow[] | undefined)[];
  /** Marks a trailing range as in progress: lines and areas draw the stretch into it dashed, and
   *  the tooltip and table add `label` to each of its x labels. */
  partial?: ChartPartial;
  /** Keeps the y axis on whole numbers, for counts: no 2.5 or 0.5 steps. */
  integerTicks?: boolean;
  /** Adds a disclosure holding the data as a table, for reading it without the graphic. */
  table?: ChartTable;
  className?: string;
};

export type ChartBox = {
  readonly width: number;
  readonly height: number;
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
};

export type ResolvedSeries = {
  readonly label: string;
  readonly color: string;
  readonly values: readonly (number | null)[];
};

export type ChartModel = {
  readonly box: ChartBox;
  readonly count: number;
  readonly scale: NiceScale;
  readonly series: readonly ResolvedSeries[];
  readonly labels: readonly string[];
  readonly hasData: boolean;
};

const PAD_LEFT = 44;
const PAD_RIGHT = 24;
const PAD_TOP = 12;
const PAD_BOTTOM = 26;

const SERIES_TOKENS = [
  'var(--color-series-1)',
  'var(--color-series-2)',
  'var(--color-series-3)',
  'var(--color-series-4)',
] as const;

export function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export function chartBox(width: number, height: number): ChartBox {
  return { width, height, left: PAD_LEFT, right: width - PAD_RIGHT, top: PAD_TOP, bottom: height - PAD_BOTTOM };
}

/** The token for a series' position. A fifth series wraps to the first colour. */
export function seriesColor(index: number, override?: string): string {
  return override ?? SERIES_TOKENS[index % SERIES_TOKENS.length] ?? SERIES_TOKENS[0];
}

function reading(value: number | null | undefined): number | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return Math.max(0, value);
}

export type ChartModelInput = {
  series: readonly ChartSeries[];
  labels: readonly string[];
  width?: number | undefined;
  height?: number | undefined;
  tickCount?: number | undefined;
  integerTicks?: boolean | undefined;
};

export function buildChartModel(props: ChartModelInput): ChartModel {
  const box = chartBox(props.width ?? DEFAULT_CHART_WIDTH, props.height ?? DEFAULT_CHART_HEIGHT);
  const series = props.series.map((entry, index) => ({
    label: entry.label,
    color: seriesColor(index, entry.color),
    values: entry.values.map(reading),
  }));
  const count = series.reduce((widest, entry) => Math.max(widest, entry.values.length), 0);
  const readings = series.flatMap((entry) => entry.values.filter((value): value is number => value !== null));
  const peak = readings.reduce((top, value) => Math.max(top, value), 0);
  return {
    box,
    count,
    scale: niceScale(peak, props.tickCount ?? DEFAULT_TICK_COUNT, props.integerTicks === true),
    series,
    labels: props.labels,
    hasData: readings.length > 0,
  };
}

export function yFor(model: ChartModel, value: number): number {
  const { box, scale } = model;
  return round(box.bottom - (Math.min(value, scale.max) / scale.max) * (box.bottom - box.top));
}

/** Points sit on the tick marks, first and last at the plot edges; a lone point is centred. */
export function lineXs(model: ChartModel): readonly number[] {
  const { box, count } = model;
  return Array.from({ length: count }, (_, index) =>
    round(count <= 1 ? (box.left + box.right) / 2 : box.left + (index / (count - 1)) * (box.right - box.left)),
  );
}

/** Bars sit in equal slots, centred in each. */
export function barXs(model: ChartModel): readonly number[] {
  const { box, count } = model;
  const slot = (box.right - box.left) / Math.max(count, 1);
  return Array.from({ length: count }, (_, index) => round(box.left + (index + 0.5) * slot));
}
