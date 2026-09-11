'use client';

import { memo } from 'react';
import {
  cn,
  metricScoreboardCellClass,
  metricScoreboardDeltaRecipe,
  metricScoreboardLabelClass,
  metricScoreboardRowClass,
  metricScoreboardValueRecipe,
} from '@bombfarm/ui';
import type { Lang } from '@bombfarm/hero/copy';
import { AbbreviatedNumber } from './abbreviated-number';

/**
 * One cell per waterfall step, re-rendered with the panel. `memo()` here is load-bearing, not
 * redundant: this package is transpiled by each host's own bundler, so the React Compiler never
 * runs over it — only a hand boundary protects a sibling cell from re-rendering when another
 * step's own value changes. `objective`/`delta` are primitives rather than the `ReactNode`s the
 * web version passed, so the shallow prop compare this depends on is real.
 */
export const StepCell = memo(function StepCell({
  label,
  objective,
  delta,
  deltaTone,
  lang,
}: {
  label: string;
  objective: number;
  delta: number | null;
  deltaTone?: 'up' | 'down';
  lang: Lang;
}) {
  return (
    <div className={cn(metricScoreboardCellClass, 'items-center text-center')}>
      <span className={metricScoreboardLabelClass}>{label}</span>
      <div className={cn(metricScoreboardRowClass, 'justify-center')}>
        <strong className={metricScoreboardValueRecipe({ tone: 'ink' })}>
          <AbbreviatedNumber value={objective} lang={lang} />
        </strong>
        {delta != null ? (
          <span className={metricScoreboardDeltaRecipe({ deltaTone: deltaTone ?? 'up' })}>
            <AbbreviatedNumber value={delta} lang={lang} signed />
          </span>
        ) : null}
      </div>
    </div>
  );
});
