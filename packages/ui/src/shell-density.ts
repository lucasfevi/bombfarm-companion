'use client';

import { useSyncExternalStore } from 'react';

/**
 * How much of itself the top bar can still show, in the order it gives things up.
 *
 * - `full` — brand lockup, worded tabs, every action spelled out in the bar.
 * - `icon-tabs` — the tabs become glyphs (the active one keeps its label, so the screen is still
 *   named). A tab word stands in for a glyph the player learns once; an action behind a menu costs
 *   a click every time it is used, so the tabs go first and the actions stay controls.
 * - `brand-mark` — the brand shrinks to its mark, taking the product name, the suite tag and the
 *   flavor badge with it. This is where the smallest window a player can drag to sits.
 * - `actions-collapsed` — the secondary actions move behind one overflow button. Everything that
 *   can give way has.
 */
export type ShellDensity = 'full' | 'icon-tabs' | 'brand-mark' | 'actions-collapsed';

/**
 * All three widths are the room the bar actually has — the window minus the strip the OS caption
 * buttons claim, which is ~136px on Windows and none elsewhere — and all three were measured off
 * the rendered bar rather than picked: the brand, the tabs and the actions cluster are laid out at
 * their natural width and none of them shrinks, so the first pixel one of them loses is the pixel
 * they start overlapping on. Portuguese is the binding language; its tab words and its action
 * labels are the longest either language puts in the bar.
 *
 * Brand 159 + worded tabs 512 + actions 340 + the two gaps = 1040px of content, and the bar's
 * content is 24px narrower than the room measured here (the shell gutter, less the caption strip
 * the bar already holds clear) — so 1064px, with six tabs. The margin above that absorbs a
 * font-rendering pass that measures a few pixels wider.
 */
export const SHELL_ICON_TABS_WIDTH = 1080;

/** The same sum with the tabs already down to glyphs: 159 + 351 + 340 + gaps = 878, so 902px. */
export const SHELL_BRAND_MARK_WIDTH = 920;

/**
 * And with the brand down to its mark as well: 34 + 351 + 340 + gaps = 753, so 777px.
 *
 * No window reaches this today — the desktop's own minimum is 960px, which leaves 824px of bar
 * after the caption inset, and that is the stage above. It is kept because the sum it comes from
 * is not fixed: every tab added pushes all three widths up, and a seventh destination brings this
 * one inside the range a window can be dragged to.
 */
export const SHELL_ACTIONS_COLLAPSE_WIDTH = 800;

export function shellDensityFor(availableWidth: number): ShellDensity {
  if (availableWidth < SHELL_ACTIONS_COLLAPSE_WIDTH) return 'actions-collapsed';
  if (availableWidth < SHELL_BRAND_MARK_WIDTH) return 'brand-mark';
  if (availableWidth < SHELL_ICON_TABS_WIDTH) return 'icon-tabs';
  return 'full';
}

function subscribe(onStoreChange: () => void): () => void {
  window.addEventListener('resize', onStoreChange);
  return () => {
    window.removeEventListener('resize', onStoreChange);
  };
}

/**
 * The live density of the window this renderer is drawn in. Returns a string rather than a width
 * so React bails out of re-rendering for every pixel of a drag and only commits on the three
 * transitions that change what is on screen.
 *
 * `overlayInset` is the room the OS caption buttons already took — see `SHELL_ICON_TABS_WIDTH`.
 * The server snapshot is `full` because a prerendered static export has no window to measure; the
 * desktop's own header is empty until the first IPC answer arrives, well after hydration, so
 * nothing is ever painted at the wrong density.
 */
export function useShellDensity(overlayInset = 0): ShellDensity {
  return useSyncExternalStore(
    subscribe,
    () => shellDensityFor(window.innerWidth - overlayInset),
    () => 'full' as const,
  );
}
