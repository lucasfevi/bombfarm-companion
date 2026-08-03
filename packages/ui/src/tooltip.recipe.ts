import { cva, type VariantProps } from 'class-variance-authority';

/** Portaled tooltip surface — planner tokens; Motion owns enter/exit. */
export const tooltipPopupRecipe = cva(
  [
    'z-50 max-w-72 origin-[var(--transform-origin)] rounded-sm border bg-surface',
    'px-3 py-2.5 text-xs leading-[1.35] text-ink shadow-md outline-none',
  ].join(' '),
  {
    variants: {
      tone: {
        default: 'border-line',
        soft: 'border-[color-mix(in_oklch,var(--accent)_45%,var(--line))]',
        warn: 'border-[color-mix(in_oklch,var(--warn)_45%,var(--line))]',
      },
    },
    defaultVariants: { tone: 'default' },
  },
);

export type TooltipTone = NonNullable<VariantProps<typeof tooltipPopupRecipe>['tone']>;

export const tooltipPositionerClass = 'z-50';

export const tooltipArrowClass =
  'flex fill-surface stroke-[color-mix(in_oklch,var(--line)_90%,transparent)] stroke-1 data-[side=bottom]:-top-1 data-[side=top]:-bottom-1';

/** Rich status body (tab trust issues, etc.). */
export const tooltipStatusTitleClass =
  'm-0 mb-1.5 text-[12px] font-bold leading-snug tracking-[0.02em] text-ink';

export const tooltipStatusListClass =
  'm-0 list-disc py-0 pl-[18px] text-[11px] leading-[1.45] text-ink marker:text-warn';

export const tooltipStatusListSoftClass =
  'm-0 list-disc py-0 pl-[18px] text-[11px] leading-[1.45] text-ink marker:text-accent';
