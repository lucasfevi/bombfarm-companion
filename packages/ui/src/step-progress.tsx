import type { ReactNode } from 'react';

export type StepProgressProps = {
  label: string;
  steps: ReactNode[];
  /** The current step, 1-based; clamped into the range. */
  current: number;
};

const badgeClass: Record<'done' | 'current' | 'next', string> = {
  done: 'border-up bg-[color-mix(in_oklch,var(--up)_18%,var(--surface))] text-up',
  current: 'border-accent bg-accent text-accent-ink',
  next: 'border-line text-muted',
};

export function StepProgress({ label, steps, current }: StepProgressProps) {
  const active = Math.min(steps.length, Math.max(1, Math.floor(current) || 1));

  return (
    <ol aria-label={label} className="m-0 flex list-none items-center justify-center gap-2 p-0 text-xs">
      {steps.map((step, index) => {
        const position = index + 1;
        const state = position < active ? 'done' : position === active ? 'current' : 'next';
        return (
          <li
            key={index}
            data-step={state}
            {...(state === 'current' ? { 'aria-current': 'step' as const } : {})}
            className={`flex items-center gap-2 ${state === 'next' ? 'text-muted' : 'text-ink'}${state === 'current' ? ' font-bold' : ''}`}
          >
            <span
              aria-hidden="true"
              className={`inline-flex size-[22px] items-center justify-center rounded-full border font-mono text-[11px] font-semibold ${badgeClass[state]}`}
            >
              {position}
            </span>
            <span className="sr-only whitespace-nowrap sm:not-sr-only">{step}</span>
            {position < steps.length ? (
              <span aria-hidden="true" className={`h-px w-6 sm:w-12 ${position < active ? 'bg-up' : 'bg-line'}`}></span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
