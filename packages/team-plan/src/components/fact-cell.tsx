'use client';

import { memo } from 'react';
import {
  cn,
  metricScoreboardCellClass,
  metricScoreboardLabelClass,
  metricScoreboardRowClass,
  mutedClass,
} from '@bombfarm/ui';

const tagToneClass = {
  accent: 'text-accent',
  up: 'text-up',
  warn: 'text-warn',
} as const;

/**
 * A scoreboard cell for a fact rather than a figure — the phase a plan is about, the field load
 * it assumes. Sits beside `StepCell` in the same grid and shares its chrome; hand-memoised for
 * the same reason (the React Compiler does not run over a package a host transpiles).
 */
export const FactCell = memo(function FactCell({
  label,
  value,
  valueTone = 'ink',
  tag,
  tagTone = 'accent',
  note,
  testId,
}: {
  label: string;
  value: string;
  valueTone?: 'ink' | 'warn';
  tag?: string | null;
  tagTone?: keyof typeof tagToneClass;
  note?: string | null;
  testId?: string;
}) {
  return (
    <div className={cn(metricScoreboardCellClass, 'items-center text-center')} data-testid={testId}>
      <span className={metricScoreboardLabelClass}>{label}</span>
      <div className={cn(metricScoreboardRowClass, 'justify-center')}>
        <strong
          className={cn(
            'text-lg font-semibold tabular-nums max-[720px]:text-base',
            valueTone === 'warn' ? 'text-warn' : 'text-ink',
          )}
        >
          {value}
        </strong>
        {tag ? <span className={cn('text-[11px] font-semibold', tagToneClass[tagTone])}>{tag}</span> : null}
      </div>
      {note ? <p className={cn('m-0 leading-snug', mutedClass)}>{note}</p> : null}
    </div>
  );
});
