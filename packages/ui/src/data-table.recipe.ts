import { cva, type VariantProps } from 'class-variance-authority';

const dataTableHeadFillClass = 'bg-[color-mix(in_oklch,var(--bg)_70%,var(--surface))]';

/**
 * Sticky `<thead>` bar — one stacking unit so body rows cannot paint through the
 * scrollport top or above column labels.
 */
export const dataTableHeadSectionClass = `sticky top-0 z-20 ${dataTableHeadFillClass}`;

/**
 * Sticky header chrome for dense DataTable heads — pinned inside a scrollable
 * {@link DataTable} root with a hue-mixed background and hairline drop shadow.
 * Upward shadow seals the 1px sticky gap `border-collapse` leaves at the scrollport top.
 */
export const dataTableHeadClass =
  `sticky top-0 z-20 whitespace-nowrap border-b border-line ${dataTableHeadFillClass} p-0 text-left font-semibold text-muted [box-shadow:0_1px_0_var(--line),0_-12px_0_color-mix(in_oklch,var(--bg)_70%,var(--surface))]`;

/** Shared inner pad/type for static and sortable column headers (keeps columns aligned). */
export const dataTableHeadInnerClass =
  'inline-flex w-full items-center gap-0.5 px-2 py-[7px] text-[10px] font-semibold tracking-[0.02em] uppercase';

/** Sortable header button — same pad as static heads + hover affordance. */
export const dataTableHeadButtonClass =
  'inline-flex w-full cursor-pointer items-center gap-0.5 rounded-none border-0 bg-transparent px-2 py-[7px] text-[10px] font-semibold tracking-[0.02em] uppercase hover:bg-[color-mix(in_oklch,var(--accent)_8%,transparent)]';

/** @deprecated Use {@link dataTableHeadButtonClass}. Kept for test parity aliases. */
export const sortableTableHeaderButtonClass = dataTableHeadButtonClass;

export const dataTableClass =
  'w-full border-separate border-spacing-0 text-xs [&_td]:border-line [&_td]:px-2 [&_td]:py-1.5 [&_td]:align-middle [&_td[data-roster-wrap]]:whitespace-normal';

export const dataTableCellRecipe = cva('border-line px-2 py-1.5 align-middle', {
  variants: {
    align: {
      left: 'text-left',
      center: 'text-center',
      right: 'text-right',
    },
    numeric: {
      true: 'font-mono tabular-nums',
      false: '',
    },
    nowrap: {
      true: 'whitespace-nowrap',
      false: '',
    },
  },
  defaultVariants: {
    align: 'left',
    numeric: false,
    nowrap: true,
  },
});

export type DataTableCellVariants = VariantProps<typeof dataTableCellRecipe>;

/** Inactive sort affordance — stacked chevrons (neither column is active). */
export const dataTableSortIdleIconClass =
  'inline-flex h-3 w-3 shrink-0 flex-col items-center justify-center text-muted opacity-45';
