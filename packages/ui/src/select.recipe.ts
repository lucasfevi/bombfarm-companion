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

/** A multi-select row: the checkbox sits ahead of the label, so the labels stay in one column. */
export const selectCheckItemClass = 'gap-2';

/**
 * The popup's header row. Sticky against the popup's own scroll, so the caption and the clear
 * action stay reachable on a list long enough to scroll — the popup caps at 16rem.
 */
export const selectPopupHeaderClass =
  'sticky top-0 z-10 -mt-1 mb-1 flex items-center justify-between gap-3 border-b border-line bg-surface px-2.5 pt-2 pb-1.5';

export const selectPopupHeaderLabelClass =
  'truncate text-[10px] font-semibold tracking-wide text-muted uppercase';

export const selectPopupHeaderActionClass =
  'shrink-0 cursor-pointer border-0 bg-transparent p-0 text-[11px] font-semibold text-accent underline-offset-2 hover:underline focus-visible:underline focus-visible:outline-none';

/**
 * An option's trailing node. `ml-auto` rather than a grid column: the label is a Base UI
 * `ItemText` whose width the popup does not control, and a fixed column would truncate it.
 */
export const selectItemTrailingClass =
  'ml-auto shrink-0 pl-3 font-mono text-[11px] tabular-nums text-muted';

/** The checkbox itself. Base UI's `ItemIndicator` renders only when the item is selected, so the
 *  box is drawn here and the tick inside it. */
export const selectCheckboxClass =
  'grid size-3.5 shrink-0 place-items-center rounded-[3px] border border-line text-accent-ink [[data-selected]_&]:border-accent [[data-selected]_&]:bg-accent';
