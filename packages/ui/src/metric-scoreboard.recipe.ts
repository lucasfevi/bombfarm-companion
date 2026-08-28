import { cva } from 'class-variance-authority';

/**
 * MetricScoreboard chrome — parity with the former inline `CompareMetricsStrip`
 * (`features/planner/components/build-column.tsx`). Fixed layout bundles
 * plus two cva recipes whose variants emit full class strings (empty `base`),
 * per the design-system convention for differing-base variants.
 */
export const metricScoreboardGridClass =
  'mt-3 grid grid-cols-1 gap-px overflow-hidden rounded-sm border border-line bg-line sm:grid-cols-2 lg:grid-cols-4';

export const metricScoreboardCellClass =
  'flex min-h-[4.75rem] flex-col justify-center gap-1 bg-surface px-3.5 py-3 leading-none';

export const metricScoreboardLabelClass =
  'text-[10px] font-bold tracking-[0.08em] text-muted uppercase';

export const metricScoreboardRowClass = 'flex flex-wrap items-baseline gap-x-2 gap-y-0.5';

export const metricScoreboardDeltaPlaceholderClass = 'invisible font-mono text-[11px] tabular-nums';

export const metricScoreboardValueRecipe = cva('', {
  variants: {
    tone: {
      ink: 'font-mono text-xl font-semibold tabular-nums max-[720px]:text-lg text-ink',
      accent: 'font-mono text-xl font-semibold tabular-nums max-[720px]:text-lg text-accent',
    },
  },
  defaultVariants: { tone: 'ink' },
});

export const metricScoreboardDeltaRecipe = cva('', {
  variants: {
    deltaTone: {
      up: 'font-mono text-[11px] tabular-nums text-up',
      down: 'font-mono text-[11px] tabular-nums text-down',
    },
  },
  defaultVariants: { deltaTone: 'up' },
});
