import type { ReactNode } from 'react';
import { ChartGrid } from './chart-grid';
import { ChartLegend } from './chart-legend';
import { ChartPointer } from './chart-pointer';
import type { ChartDetailRow, ChartModel, ChartPartial, ChartProps } from './chart-model';
import { cn } from './cn';
import { Disclosure } from './disclosure';

export type ChartFrameProps = Pick<
  ChartProps,
  'ariaLabel' | 'empty' | 'formatValue' | 'legend' | 'maxXLabels' | 'table' | 'details' | 'partial' | 'className'
> & {
  model: ChartModel;
  /** The x of each data index. */
  xs: readonly number[];
  /** The marks, drawn over the grid. */
  children: ReactNode;
};

const DEFAULT_MAX_X_LABELS = 7;
const MISSING = '—';

function visibleLabelIndexes(count: number, maxLabels: number): ReadonlySet<number> {
  const every = Math.max(1, Math.ceil(count / Math.max(1, maxLabels)));
  const shown = new Set<number>();
  for (let index = count - 1; index >= 0; index -= every) shown.add(index);
  return shown;
}

/** The x label, with the caller's in-progress copy after it for an index still in progress. */
function labelFor(model: ChartModel, partial: ChartPartial | undefined, index: number): string {
  const label = model.labels[index] ?? '';
  return partial !== undefined && index >= partial.from ? `${label} ${partial.label}` : label;
}

function detailColumnsOf(details: ChartProps['details']): readonly string[] {
  const labels = new Set<string>();
  details?.forEach((rows) => rows?.forEach((row) => labels.add(row.label)));
  return [...labels];
}

function tooltipFor(
  model: ChartModel,
  index: number,
  format: (value: number) => string,
  partial?: ChartPartial,
  rows?: readonly ChartDetailRow[],
): ReactNode {
  return (
    <>
      <div className="mb-0.5 text-bg/70">{labelFor(model, partial, index)}</div>
      {model.series.map((entry) => {
        const value = entry.values[index];
        return (
          <div key={entry.label} className="flex items-center gap-1.5">
            <span aria-hidden className="block h-[3px] w-3 rounded-full" style={{ background: entry.color }} />
            <span>{entry.label}</span>
            <span className="ml-auto pl-3 font-semibold">
              {value === null || value === undefined ? MISSING : format(value)}
            </span>
          </div>
        );
      })}
      {rows?.map((row, rowIndex) => (
        <div key={rowIndex} className="flex items-center gap-1.5 text-bg/80">
          <span aria-hidden className="block w-3" />
          <span>{row.label}</span>
          <span className="ml-auto pl-3 font-semibold">{row.value}</span>
        </div>
      ))}
    </>
  );
}

/**
 * The part every chart shares: the fixed-viewBox SVG with its grid and x labels, the legend, the
 * table fallback and the pointer island. All of it is plain markup computed from props, so the
 * first render on the server is the complete chart.
 */
export function ChartFrame({
  model,
  xs,
  ariaLabel,
  empty,
  formatValue = String,
  legend,
  maxXLabels = DEFAULT_MAX_X_LABELS,
  table,
  details,
  partial,
  className,
  children,
}: ChartFrameProps) {
  if (!model.hasData) return <p className={cn('m-0 text-[13px] text-muted', className)}>{empty}</p>;

  const { box } = model;
  const shown = visibleLabelIndexes(model.count, maxXLabels);
  const showLegend = legend ?? model.series.length > 1;
  const detailColumns = table?.detailColumns === true ? detailColumnsOf(details) : [];

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {showLegend ? <ChartLegend items={model.series} /> : null}
      <div className="relative">
        <svg
          viewBox={`0 0 ${String(box.width)} ${String(box.height)}`}
          role="img"
          aria-label={ariaLabel}
          className="block h-auto w-full"
        >
          <ChartGrid model={model} formatValue={formatValue} />
          {children}
          {xs.map((x, index) =>
            shown.has(index) ? (
              <text key={index} x={x} y={box.bottom + 16} textAnchor="middle" className="fill-muted font-mono text-[10.5px]">
                {model.labels[index] ?? ''}
              </text>
            ) : null,
          )}
        </svg>
        <ChartPointer
          width={box.width}
          height={box.height}
          plotTop={box.top}
          plotBottom={box.bottom}
          xs={xs}
          tooltips={xs.map((_, index) => tooltipFor(model, index, formatValue, partial, details?.[index]))}
          ariaLabel={ariaLabel}
        />
      </div>
      {table === undefined ? null : (
        <Disclosure summary={table.summary}>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs tabular-nums">
              <thead>
                <tr>
                  <th scope="col" className="px-2 py-1 text-left font-semibold text-muted">
                    {table.labelHeading}
                  </th>
                  {model.series.map((entry) => (
                    <th key={entry.label} scope="col" className="px-2 py-1 text-right font-semibold text-muted">
                      {entry.label}
                    </th>
                  ))}
                  {detailColumns.map((heading) => (
                    <th key={heading} scope="col" className="px-2 py-1 text-right font-semibold text-muted">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {xs.map((_, index) => (
                  <tr key={index} className="border-t border-line/70">
                    <th scope="row" className="px-2 py-1 text-left font-normal">
                      {labelFor(model, partial, index)}
                    </th>
                    {model.series.map((entry) => {
                      const value = entry.values[index];
                      return (
                        <td key={entry.label} className="px-2 py-1 text-right">
                          {value === null || value === undefined ? MISSING : formatValue(value)}
                        </td>
                      );
                    })}
                    {detailColumns.map((heading) => (
                      <td key={heading} className="px-2 py-1 text-right">
                        {details?.[index]?.find((row) => row.label === heading)?.value ?? MISSING}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Disclosure>
      )}
    </div>
  );
}
