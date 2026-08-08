'use client';

import type { ReactNode } from 'react';
import { cn } from '@bombfarm/ui';
import {
  metricScoreboardCellClass,
  metricScoreboardDeltaRecipe,
  metricScoreboardLabelClass,
  metricScoreboardRowClass,
  metricScoreboardValueRecipe,
} from '@bombfarm/ui/metric-scoreboard.recipe';

export function StepCell({
  label,
  value,
  delta,
  deltaTone,
}: {
  label: string;
  value: ReactNode;
  delta?: ReactNode | null;
  deltaTone?: 'up' | 'down';
}) {
  return (
    <div className={cn(metricScoreboardCellClass, 'items-center text-center')}>
      <span className={metricScoreboardLabelClass}>{label}</span>
      <div className={cn(metricScoreboardRowClass, 'justify-center')}>
        <strong className={metricScoreboardValueRecipe({ tone: 'ink' })}>{value}</strong>
        {delta != null ? (
          <span className={metricScoreboardDeltaRecipe({ deltaTone: deltaTone ?? 'up' })}>{delta}</span>
        ) : null}
      </div>
    </div>
  );
}
