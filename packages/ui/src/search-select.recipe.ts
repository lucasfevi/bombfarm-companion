/**
 * Search-select chrome — the `Select` trigger and popup, plus the search row that turns the popup
 * into something you can type into. Every shared piece is imported from `select.recipe.ts` rather
 * than restated, so the two controls cannot drift into looking like different fields.
 */

/** The search row is a fixed sibling of the scrolling list, the way the multi-select header is. */
export const searchSelectSearchRowClass =
  'flex shrink-0 items-center gap-2 border-b border-line px-2.5 py-1.5';

export const searchSelectInputClass =
  'w-full min-w-0 border-0 bg-transparent p-0 text-[13px] text-ink outline-none placeholder:text-muted';

/** Both the empty state and the "more matches than fit" note. */
export const searchSelectNoteClass = 'shrink-0 px-2.5 py-2 text-[12px] text-muted';

/** A wide list of coordinates reads badly at the trigger's own width. */
export const searchSelectPopupClass = 'min-w-[max(var(--anchor-width),15rem)]';
