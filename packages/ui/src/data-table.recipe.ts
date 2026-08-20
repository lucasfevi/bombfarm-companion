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
  'flex w-full items-center gap-0.5 px-2 py-[7px] text-[10px] font-semibold tracking-[0.02em] uppercase';

/**
 * Sortable header button — same pad as static heads. The button keeps its own natural,
 * label-driven height (a percentage height can't resolve against a `<th>` stretched taller by a
 * *sibling* cell — e.g. one carrying a sprite icon — since the cell's specified height stays
 * `auto` even once the row visually stretches it). `before:` is the full-cell affordance instead:
 * an absolutely positioned layer whose containing block skips the (non-positioned) button and
 * resolves against the sticky `<th>` itself, so the hover wash, the bottom accent rule, and the
 * focus ring always cover the real cell — short header or tall. Browsers attribute pointer
 * events over a pseudo-element to its host element, so the click/hover target grows with it too.
 * `-z-10` keeps it under the label/icon so an icon header's own hover target (e.g. a tooltip
 * trigger) stays reachable. The focus ring spells out `outline-style` as an arbitrary property
 * rather than the bare `outline` utility — `cn()`'s tailwind-merge groups bare `outline` with
 * `outline-<width>` as one conflict, so combined with `outline-2` (added below) the merge would
 * silently drop whichever comes first, leaving `outline-style` unset and the ring invisible.
 */
export const dataTableHeadButtonClass =
  'flex w-full cursor-pointer items-center gap-0.5 rounded-none border-0 bg-transparent px-2 py-[7px] text-[10px] font-semibold tracking-[0.02em] uppercase before:absolute before:inset-0 before:-z-10 before:content-[\'\'] motion-safe:before:transition-[background-color,box-shadow] motion-safe:before:duration-[120ms] motion-safe:before:ease-out hover:before:bg-[color-mix(in_oklch,var(--accent)_8%,transparent)] hover:before:shadow-[inset_0_-2px_0_color-mix(in_oklch,var(--accent)_55%,transparent)] focus-visible:before:outline-2 focus-visible:before:[outline-style:solid] focus-visible:before:-outline-offset-2 focus-visible:before:outline-accent';

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
