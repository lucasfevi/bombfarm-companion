/** Dialog shell backdrop — dark scrim behind import / confirm dialogs. */
export const dialogBackdropClass =
  'fixed inset-0 z-40 bg-[color-mix(in_oklch,black_55%,transparent)]';

/** Dialog shell popup — byte-for-byte from former `import-heroes-dialog.tsx`. */
export const dialogPopupClass =
  'fixed top-1/2 left-1/2 z-[41] flex max-h-[min(85vh,900px)] w-[min(92vw,760px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden border border-line bg-surface p-4 pb-0';

/** The scrolling middle of a popup: takes the height the head and footer leave and scrolls
 *  inside it, so a long body never pushes the footer past the popup's edge. */
export const dialogBodyClass = 'min-h-0 flex-1 overflow-y-auto';

/** The popup's bottom band for its actions. The popup itself ends with no bottom padding, so the
 *  footer supplies its own and reaches the popup's edges to rule a full-width line. */
export const dialogFooterClass =
  '-mx-4 mt-3 flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-line bg-surface px-4 py-3';
