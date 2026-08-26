/**
 * Root — viewport-height flex column: sticky header, `<main>` as the sole scroll region, then a
 * slim status strip. Same product shape as the web's `AppShellInner` + `SiteHeader` (top bar, no
 * left rail) rather than the desktop's former icon-rail sidebar.
 */
export const appShellRootClass = 'flex h-dvh flex-col bg-bg text-ink font-sans';

/**
 * Top bar — the web's `site-header.tsx` chrome minus the two things that only make sense there.
 * `sticky` is inert in this shell (the root is a viewport-height column and `<main>` is the only
 * scroll region, so nothing ever scrolls under the header), and a backdrop blur has nothing to
 * blur for the same reason. Both would put this element on its own compositing layer, which the
 * OS drags when `draggable` is on — enough to make the window stutter and snap while moving.
 */
export const appShellHeaderClass =
  'relative flex min-h-top shrink-0 items-center justify-between gap-3 border-b border-line bg-surface px-4 py-2.5';

/** Brand lockup — name over an uppercase tag, styled like the web's `SiteHeader` brand block. */
export const appShellBrandClass = 'flex flex-col justify-center';
export const appShellBrandNameClass = 'text-[13px] leading-1.1 font-bold text-ink';
export const appShellBrandTagClass = 'text-[11px] font-semibold tracking-wide text-muted uppercase';

export const appShellActionsClass = 'flex shrink-0 items-center gap-2';

/** Sits behind the header's content; the content wrappers are positioned so they paint above it. */
export const appShellDragStripClass = 'absolute top-0 bottom-0 left-0';

/** `min-h-0` lets this flex child actually shrink so `overflow-y-auto` scrolls instead of growing
 *  the viewport — the window itself must never scroll. */
export const appShellMainClass = 'min-h-0 flex-1 overflow-y-auto px-6 py-6';

export const appShellStatusBarClass =
  'flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-t border-line px-6 py-1 text-sm';
