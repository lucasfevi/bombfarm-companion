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
 * All three widths are the room the bar actually has — the window minus the strip the caption
 * buttons claim, which is `WINDOW_CONTROLS_WIDTH` wherever the header draws them — and all three were measured off
 * the rendered bar rather than picked: the brand, the tabs and the actions cluster are laid out at
 * their natural width and none of them shrinks, so the first pixel one of them loses is the pixel
 * they start overlapping on. Portuguese is the binding language; its tab words and its action
 * labels are the longest either language puts in the bar.
 *
 * Brand 159 + worded tabs 868 + actions 340 + the two gaps = 1396px of content, and the bar's
 * content is 24px narrower than the room measured here (the shell gutter, less the caption strip
 * the bar already holds clear) — so 1420px, with eleven tabs. The strip was re-rendered at its
 * real geometry in the binding language rather than estimated from a word length: 777.7px worded
 * with ten tabs and 863.7px with "Coleções" in (82px of tab and a 4px gap).
 *
 * A worded tab pads 10px a side, trimmed from 12px when the eleventh tab arrived. At 12px the
 * same strip rendered 817.7px with ten tabs and 907.7px with eleven, which fills the bar's
 * 1440px content cap (the shell's measure) with about 4px to spare — so any font pass measuring a
 * few pixels wider would have overlapped the tabs and the actions at every wide window. At 10px
 * the strip leaves 44px of that cap to spare, and 1436px adds a 16px margin above the sum for a
 * font-rendering pass that measures a few pixels wider. The padding is the nav recipe's, so the
 * web header's tabs sit 2px closer to their edges too. A twelfth worded tab
 * (some 86px) would not fit the cap at all, so the next tab is a conversation about this stage
 * rather than a quiet addition.
 */
export const SHELL_ICON_TABS_WIDTH = 1436;

/**
 * The same sum with the tabs already down to glyphs: 159 + 527 + 340 + gaps = 1054, so 1078px.
 *
 * A glyph tab costs the same whatever its word, so the eleventh adds 36px here against 86px
 * above — a 16px glyph between two 8px paddings and the 4px gap, read off how the compact tab is
 * drawn. The active tab keeps its word there and shares the worded tab's padding, so the trim
 * took 4px off this sum (a ten-glyph strip with one worded tab rendered 463.6px at 12px and
 * 459.6px at 10px, eleven tabs).
 */
export const SHELL_BRAND_MARK_WIDTH = 1096;

/**
 * And with the brand down to its mark as well: 34 + 527 + 340 + gaps = 929, so 953px.
 *
 * The smallest window a player can drag to reaches this stage: the desktop's minimum is 960px,
 * which leaves 860px of bar after the caption inset, and that is 116px inside this one — the
 * eighth tab brought it inside the range a window can be dragged to, and the ninth, tenth and
 * eleventh moved it further in. At the minimum window every secondary action sits behind the
 * overflow button; the tabs and the brand mark still fit.
 */
export const SHELL_ACTIONS_COLLAPSE_WIDTH = 976;

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
 * `captionInset` is the room the caption buttons already took — see `SHELL_ICON_TABS_WIDTH`.
 * The server snapshot is `full` because a prerendered static export has no window to measure; the
 * desktop's own header is empty until the first IPC answer arrives, well after hydration, so
 * nothing is ever painted at the wrong density.
 */
export function useShellDensity(captionInset = 0): ShellDensity {
  return useSyncExternalStore(
    subscribe,
    () => shellDensityFor(window.innerWidth - captionInset),
    () => 'full' as const,
  );
}
