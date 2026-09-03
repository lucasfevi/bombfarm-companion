/**
 * Root — viewport-height flex column: sticky header, `<main>` as the sole scroll region, then a
 * slim status strip. Same product shape as the web's `AppShellInner` + `SiteHeader` (top bar, no
 * left rail) rather than the desktop's former icon-rail sidebar.
 *
 * `overflow-hidden` states the invariant the rest of this file is written around — nothing outside
 * `<main>` may ever give the window something to scroll. It clips nothing today (the three rows
 * add up to exactly the viewport), so its whole job is to make a future header or status-strip
 * overflow show up as clipped chrome rather than as a second scrollbar. Dialogs and tooltips are
 * portalled to `<body>`, outside this element, so it cannot cut them off.
 */
export const appShellRootClass = 'flex h-dvh flex-col overflow-hidden bg-bg text-ink font-sans';

/**
 * Top bar — the web's `site-header.tsx` chrome minus the two things that only make sense there.
 * `sticky` is inert in this shell (the root is a viewport-height column and `<main>` is the only
 * scroll region, so nothing ever scrolls under the header), and a backdrop blur has nothing to
 * blur for the same reason. Both would put this element on its own compositing layer, which the
 * OS drags when `draggable` is on — enough to make the window stutter and snap while moving.
 */
export const appShellHeaderClass =
  'relative flex min-h-top shrink-0 items-center justify-between gap-3 border-b border-line bg-surface px-4 py-2.5';

/** Brand row — mark beside the lockup, same shape as the web's `SiteHeader` `<Link>`. */
export const appShellBrandRowClass = 'flex shrink-0 items-center gap-2.5';

/** Brand lockup — name over an uppercase tag, styled like the web's `SiteHeader` brand block. */
export const appShellBrandClass = 'flex flex-col justify-center whitespace-nowrap';
export const appShellBrandNameClass = 'text-[13px] leading-1.1 font-bold text-ink';
export const appShellBrandTagClass = 'text-[11px] font-semibold tracking-wide text-muted uppercase';

/**
 * The flavor badge. Its own chip beside the lockup rather than the lockup's second line, which
 * belongs to the suite tag: the tag says which product this is and never changes, the badge says
 * which build of it you are running and is absent on a release.
 */
export const appShellFlavorBadgeClass =
  'shrink-0 rounded-sm border border-line bg-bg-2 px-1.5 py-0.5 text-[10px] font-bold tracking-[0.06em] text-muted uppercase';

export const appShellActionsClass = 'flex shrink-0 items-center gap-2';

/**
 * Sits behind the header's content; the content wrappers are positioned so they paint above it.
 * `right-0` is the default rather than an omission: an inline `right` only narrows it to clear the
 * OS caption buttons, and without a right edge to start from the strip would collapse to no width
 * at all — a header with nothing to grab — whenever that inset is unknown.
 */
export const appShellDragStripClass = 'absolute top-0 right-0 bottom-0 left-0';

/**
 * `min-h-0` lets this flex child actually shrink so `overflow-y-auto` scrolls instead of growing
 * the viewport — the window itself must never scroll. A flex column so the inner measure can claim
 * the height with `flex-1` rather than a percentage: a `height: 100%` child of this box is pinned
 * to the viewport while its own content is taller, and the excess escapes to the document, which
 * then scrolls behind the one scrollbar this element is supposed to own.
 *
 * `relative` is what actually holds that second scrollbar shut, and it is load-bearing rather than
 * decorative. `sr-only` is `position: absolute`, so every screen-reader label in the tree resolves
 * its containing block to the nearest positioned ancestor — with none, that is the initial
 * containing block, which no `overflow` on this element or above it can clip. A long enough list
 * pushes those labels past the viewport, the document grows to reach them, and a second scrollbar
 * appears beside this one. Making this element the containing block brings them back inside the
 * only box allowed to scroll.
 */
export const appShellMainClass = 'relative flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-6';

/**
 * The measure. Caps and centres the content while the scrollbar stays on `<main>` at the window
 * edge, so a wide window grows the background rather than the panels. `flex-1` on a flex child
 * whose `min-height` is `auto` fills the viewport when the content is short and grows past it when
 * the content is tall — which is what lets one rule serve both a full-height tab that scrolls
 * inside itself and a tall tab that scrolls `<main>`.
 */
export const appShellMainInnerClass = 'mx-auto flex w-full max-w-desktop flex-1 flex-col';

export const appShellStatusBarClass =
  'flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-t border-line px-6 py-1 text-sm';
