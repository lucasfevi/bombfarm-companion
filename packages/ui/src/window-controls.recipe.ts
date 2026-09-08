/**
 * The caption cluster. `-webkit-app-region: no-drag` is applied by `AppShell` around the slot
 * rather than here, so this stays a presentational control that a non-draggable surface can also
 * render.
 */
export const windowControlsClass = 'flex shrink-0 items-center gap-0.5';

/**
 * One caption button. 28px square — the size the compact Live window's close control already
 * uses, so the two windows draw the same control rather than two sizes of it.
 *
 * The width the cluster claims is fixed by this: three buttons, two gaps, and the gap that
 * separates it from the actions beside it. `WINDOW_CONTROLS_WIDTH` is that sum, and the shell's
 * density thresholds are measured against it — a change to either number has to move both.
 */
export const windowControlButtonClass = [
  'grid size-7 shrink-0 place-items-center rounded-sm border-0 bg-transparent p-0',
  'text-muted transition-colors',
  // An ink wash, not `bg-bg-2`: every named surface token below the header's own `--surface` is
  // darker than it, so a hover drawn from one sinks the button into the bar instead of lifting it
  // out. Same construction the design system's destructive icon button already uses.
  'hover:bg-[color-mix(in_oklch,var(--ink)_10%,transparent)] hover:text-ink',
  'focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-accent',
].join(' ');

/**
 * Close keeps the hover the other two have and tints the mark instead of flooding the button —
 * Windows floods its own close button red, but that red is the OS's signal on the OS's chrome,
 * and repainting a corner of our own header in a colour the app uses nowhere else reads as an
 * error state on the window rather than as a control under the cursor.
 */
export const windowControlCloseClass =
  'hover:bg-[color-mix(in_oklch,var(--down)_14%,transparent)] hover:text-down';

/** Buttons (3 x 28) + their gaps (2 x 2) + the gap to the actions cluster (12). */
export const WINDOW_CONTROLS_WIDTH = 100;
