'use client';

import type { ReactNode } from 'react';
import { Icon, Tooltip, cn } from '@bombfarm/ui';

export const setupFieldLabelClass =
  'flex h-4 items-center gap-1 text-[11px] leading-none font-bold tracking-[0.03em] text-muted uppercase';

const infoTriggerClass =
  'inline-flex cursor-help items-center border-0 bg-transparent p-0 text-muted hover:text-ink focus-visible:rounded-sm focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

/**
 * A bare info glyph that carries a sentence on hover — the Live screen's staleness marker, drawn
 * beside a label instead of a figure. Needs a `Tooltip.Provider` above it.
 */
export function InfoTip({ label, tip }: { label: string; tip: string }) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger type="button" aria-label={`${label}: ${tip}`} className={infoTriggerClass}>
        <Icon name="information-circle" size="xs" />
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Positioner sideOffset={6}>
          <Tooltip.Popup>
            <p className="m-0 max-w-64 text-[11px] leading-snug">{tip}</p>
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

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
