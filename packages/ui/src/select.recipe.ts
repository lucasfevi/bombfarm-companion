import { cva, type VariantProps } from 'class-variance-authority';

/**
 * Select field chrome — Base UI trigger + portal popup (not native `<option>`).
 * Trigger matches `Num`: bordered shell, left chevron affix on `bg-bg-2`.
 */

export const selectFieldRecipe = cva(
  'inline-flex w-full min-w-0 items-stretch overflow-hidden rounded-sm border border-line bg-bg text-ink outline-none select-none data-[popup-open]:border-accent focus-visible:border-accent',
  {
    variants: {
      size: {
        default: 'min-h-[34px] text-[13px]',
        compact: 'min-h-[26px] text-[11px]',
      },
    },
    defaultVariants: { size: 'default' },
  },
);

export type SelectSize = NonNullable<VariantProps<typeof selectFieldRecipe>['size']>;

export const selectAffixClass =
  'flex w-5 shrink-0 items-center justify-center border-r border-line bg-bg-2 text-muted pointer-events-none';

export const selectValueClass =
  'flex min-w-0 flex-1 items-center truncate px-1.5 py-1 text-left text-ink';

export const selectPositionerClass = 'z-50 outline-none';

export const selectPopupClass =
  'max-h-[min(16rem,var(--available-height))] min-w-[var(--anchor-width)] origin-[var(--transform-origin)] overflow-y-auto rounded-sm border border-line bg-surface py-1 text-ink shadow-[0_8px_24px_color-mix(in_oklch,var(--bg)_80%,transparent)] outline-none';

export const selectItemClass =
  'flex cursor-pointer items-center gap-2 px-2.5 py-1.5 text-[13px] text-ink outline-none select-none data-[highlighted]:bg-[color-mix(in_oklch,var(--accent)_18%,var(--surface))] data-[highlighted]:text-accent data-[disabled]:cursor-not-allowed data-[disabled]:opacity-40';

export const selectItemCompactClass =
  'flex cursor-pointer items-center gap-2 px-2 py-1 text-[11px] text-ink outline-none select-none data-[highlighted]:bg-[color-mix(in_oklch,var(--accent)_18%,var(--surface))] data-[highlighted]:text-accent data-[disabled]:cursor-not-allowed data-[disabled]:opacity-40';
