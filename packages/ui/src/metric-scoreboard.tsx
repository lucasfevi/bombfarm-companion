import type { ReactNode } from 'react';
import { cn } from './cn';
import {
  metricScoreboardGridClass,
  metricScoreboardCellClass,
  metricScoreboardLabelClass,
  metricScoreboardRowClass,
  metricScoreboardDeltaPlaceholderClass,
  metricScoreboardValueRecipe,
  metricScoreboardDeltaRecipe,
} from './metric-scoreboard.recipe';

export type MetricScoreboardCell = {
  id: string;
  label: ReactNode;
  value: ReactNode;
  tone?: 'ink' | 'accent';
  delta?: ReactNode | null;
  deltaTone?: 'up' | 'down';
};

export type MetricScoreboardProps = {
  cells: readonly MetricScoreboardCell[];
  'aria-label': string;
  className?: string;
};

/** Equal-column KPI strip — value and delta share one baseline row. Promoted from `CompareMetricsStrip`. */
export function MetricScoreboard({ cells, 'aria-label': ariaLabel, className }: MetricScoreboardProps) {
  return (
    <div
      className={cn(metricScoreboardGridClass, className)}
      role="group"
      aria-label={ariaLabel}
    >
      {cells.map((cell) => (
        <div key={cell.id} className={metricScoreboardCellClass}>
          <span className={metricScoreboardLabelClass}>{cell.label}</span>
          <div className={metricScoreboardRowClass}>
            <strong className={metricScoreboardValueRecipe({ tone: cell.tone ?? 'ink' })}>
              {cell.value}
            </strong>
            {cell.delta != null ? (
              <span className={metricScoreboardDeltaRecipe({ deltaTone: cell.deltaTone ?? 'up' })}>
                {cell.delta}
              </span>
            ) : (
              <span className={metricScoreboardDeltaPlaceholderClass} aria-hidden>
                +0.0%
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
