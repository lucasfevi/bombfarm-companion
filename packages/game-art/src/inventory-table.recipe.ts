/**
 * A body row. `contain-intrinsic-size` is the 32px item icon plus the cell's own 6px of vertical
 * padding, which is also the height the table's window math starts from before it measures a real
 * row; `auto` lets the browser keep the real height once the row has rendered. It covers the band
 * of overscan the window keeps mounted either side of the visible rows — the rows beyond that
 * band are not in the document at all.
 *
 * The rule sits on the cells rather than the row: `dataTableClass` uses the separated border
 * model, where a border declared on a `<tr>` is not painted at all.
 */
export const inventoryTableRowClass =
  '[&>*]:border-b [&>*]:border-line/60 [content-visibility:auto] [contain-intrinsic-size:auto_46px] motion-safe:transition-colors motion-safe:duration-[120ms] hover:bg-[color-mix(in_oklch,var(--ink)_5%,var(--surface))]';

/**
 * The kind header that opens each `<tbody>`. Deliberately not sticky: the column head above it
 * already is, and two stacked sticky bars leave the shorter one half-covering the taller.
 */
export const inventoryTableGroupHeaderClass =
  'border-b border-line bg-[color-mix(in_oklch,var(--bg)_60%,var(--surface))] px-2 py-1.5 text-left text-[10px] font-semibold tracking-[0.02em] uppercase text-ink';

export const inventoryTableGroupCountClass = 'ml-2 font-normal tabular-nums text-muted';

/** The row a picker screen is currently planning against. A tint rather than a border: a border
 *  would move every other row by a pixel as the selection walks down the list. */
export const inventoryTableSelectedRowClass = 'bg-[color-mix(in_oklch,var(--accent)_14%,var(--surface))]';

export const inventoryTableGoldClass = 'inline-flex items-center gap-1';

/** Every cell with nothing in it gets the same mark, so a blank column reads as "none" rather
 *  than as a rendering gap. */
export const inventoryTableBlankClass = 'text-muted';

export const inventoryTableHeroClass = 'flex min-w-0 items-center gap-1.5';

export const inventoryTableHeroNameClass = 'min-w-0 truncate font-semibold';

export const inventoryTableActionButtonClass =
  'inline-flex cursor-pointer items-center justify-center rounded-sm border-0 bg-transparent p-1 text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

export const inventoryTableToolbarClass = 'flex flex-wrap items-center gap-2 pb-3';

export const inventoryTableResultCountClass = 'shrink-0 text-xs tabular-nums text-muted';

export const inventoryTableSkippedNoteClass = 'pt-3 text-xs text-muted';
