import type { ComponentPropsWithoutRef } from 'react';
import { chipRecipe, type ChipVariant } from './chip.recipe';
import { cn } from './cn';

export type ActionChipTone = 'active' | 'muted' | 'warn';

export type ActionChipProps = Omit<ComponentPropsWithoutRef<'button'>, 'children'> & {
  tone?: ActionChipTone;
  /** Caller-supplied, already-translated text — i18n stays out of the design system. */
  label: string;
};

const TONE_VARIANT: Record<ActionChipTone, ChipVariant> = {
  active: 'small-active',
  muted: 'small-muted',
  warn: 'small-warn',
};

/**
 * ActionChip — `StatusChip`'s pill, as a control. Same `chipRecipe` tones and the same decorative
 * dot, so a clickable chip and a reported one sit in the same strip without looking like two
 * different systems.
 *
 * `chipSmallBase` is written for a chip trailing a label, so it carries `cursor-default` and a
 * leading margin; both are overridden here rather than in every caller, since neither is true of
 * a control that stands on its own.
 */
export function ActionChip({ tone = 'active', label, className, ...props }: ActionChipProps) {
  return (
    <button
      type="button"
      className={cn(
        chipRecipe({ variant: TONE_VARIANT[tone] }),
        'ml-0 inline-flex cursor-pointer items-center gap-1.5',
        'focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        className,
      )}
      {...props}
    >
      <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-current" />
      {label}
    </button>
  );
}
