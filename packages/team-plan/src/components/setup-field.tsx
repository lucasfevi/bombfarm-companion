'use client';

import type { ReactNode } from 'react';
import { InfoTip, cn } from '@bombfarm/ui';

export const setupFieldLabelClass =
  'flex h-4 items-center gap-1 text-[11px] leading-none font-bold tracking-[0.03em] text-muted uppercase';

/**
 * One field of the search setup bar: a bold label with its explanation behind an info glyph, and
 * the control underneath. A tooltip rather than a paragraph so the bar stays one control tall; a
 * field whose hint changes with its state passes the current sentence.
 *
 * No `<label>` element: every control here already carries its own accessible name, and a
 * tooltip trigger inside a label would be a second interactive element the label swallows.
 */
export function SetupField({
  label,
  hint,
  className,
  testId,
  children,
}: {
  label: string;
  hint: string;
  className?: string;
  testId?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-[3px]', className)} data-setup-field data-testid={testId}>
      <div className={setupFieldLabelClass}>
        <span>{label}</span>
        <InfoTip label={label} tip={hint} />
      </div>
      <div data-setup-control>{children}</div>
    </div>
  );
}
