import { describe, it, expect } from 'vitest';
import {
  metricScoreboardGridClass,
  metricScoreboardCellClass,
  metricScoreboardLabelClass,
  metricScoreboardRowClass,
  metricScoreboardDeltaPlaceholderClass,
  metricScoreboardValueRecipe,
  metricScoreboardDeltaRecipe,
} from '@bombfarm/ui/metric-scoreboard.recipe';

describe('MetricScoreboard recipe parity', () => {
  it('grid/cell/label/row constants match the frozen pre-split literals', () => {
    expect(metricScoreboardGridClass).toBe(
      'mt-3 grid grid-cols-1 gap-px overflow-hidden rounded-sm border border-line bg-line sm:grid-cols-2 lg:grid-cols-4',
    );
    expect(metricScoreboardCellClass).toBe(
      'flex min-h-[4.75rem] flex-col justify-center gap-1 bg-surface px-3.5 py-3 leading-none',
    );
    expect(metricScoreboardLabelClass).toBe(
      'text-[10px] font-bold tracking-[0.08em] text-muted uppercase',
    );
    expect(metricScoreboardRowClass).toBe('flex flex-wrap items-baseline gap-x-2 gap-y-0.5');
  });

  it('value recipe emits the frozen full class string per tone', () => {
    expect(metricScoreboardValueRecipe({ tone: 'ink' })).toBe(
      'font-mono text-xl font-semibold tabular-nums max-[720px]:text-lg text-ink',
    );
    expect(metricScoreboardValueRecipe({ tone: 'accent' })).toBe(
      'font-mono text-xl font-semibold tabular-nums max-[720px]:text-lg text-accent',
    );
  });

  it('delta recipe emits the frozen full class string per deltaTone', () => {
    expect(metricScoreboardDeltaRecipe({ deltaTone: 'up' })).toBe(
      'font-mono text-[11px] tabular-nums text-up',
    );
    expect(metricScoreboardDeltaRecipe({ deltaTone: 'down' })).toBe(
      'font-mono text-[11px] tabular-nums text-down',
    );
  });

  it('keeps the invisible +0.0% placeholder class for delta-less cells (no-layout-shift)', () => {
    expect(metricScoreboardDeltaPlaceholderClass).toBe('invisible font-mono text-[11px] tabular-nums');
  });
});
