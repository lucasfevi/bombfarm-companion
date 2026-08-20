import { cva, type VariantProps } from 'class-variance-authority';

/**
 * DeltaTable chrome. `table-fixed` + the `<colgroup>` widths below are what keep every column the
 * same width down every row — nothing in a cell (a long label, a locked-row glyph) can widen or
 * narrow a column, and no row can end up taller than its neighbours because of it.
 */
export const deltaTableClass = 'w-full table-fixed border-collapse text-[11px]';

export const deltaTableLabelColClass = 'w-[48%]';
export const deltaTableNumericColClass = 'w-[17.34%]';

export const deltaTableHeadRowClass = 'text-[10px] tracking-[0.03em] text-muted uppercase';
export const deltaTableHeadCellClass = 'py-1 pr-1 text-left font-normal';
export const deltaTableHeadNumericCellClass = 'py-1 pl-2 text-right font-normal';

export const deltaTableRowRecipe = cva('border-t border-line/50', {
  variants: {
    /**
     * A row the change never touches, dimmed so the rows that DO move carry the eye.
     *
     * The muted TOKEN, not an opacity: `statListMutedRowClass`'s `opacity-45` is the repo's
     * usual "present but not live" treatment, but applied to ink-coloured table text it drops
     * below the WCAG AA contrast floor and axe fails every story that renders such a row.
     * `text-muted` is the same de-emphasis one step lighter, and it already passes on this very
     * table's header row.
     */
    unaffected: { true: 'text-muted', false: '' },
  },
  defaultVariants: { unaffected: false },
});
export const deltaTableLabelCellClass = 'py-1 pr-1 text-left align-middle font-normal';
export const deltaTableLabelInnerClass =
  'flex items-center gap-1 overflow-hidden text-ellipsis whitespace-nowrap';
export const deltaTableNumericCellClass = 'py-1 pl-2 text-right align-middle font-mono tabular-nums';

export const deltaTableDeltaRecipe = cva(
  'py-1 pl-2 text-right align-middle font-mono tabular-nums',
  {
    variants: {
      tone: {
        up: 'text-up',
        down: 'text-down',
        flat: '',
      },
    },
    defaultVariants: { tone: 'flat' },
  },
);

export type DeltaTableDeltaTone = NonNullable<VariantProps<typeof deltaTableDeltaRecipe>['tone']>;

export const deltaTableLockButtonClass =
  'inline-flex size-3.5 shrink-0 items-center justify-center rounded-full text-muted hover:text-ink focus-visible:outline-2 focus-visible:[outline-style:solid] focus-visible:outline-accent';
