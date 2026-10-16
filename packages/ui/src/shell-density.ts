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
 * All three widths are the room the bar actually has: the window minus the strip the caption
 * buttons claim (`WINDOW_CONTROLS_WIDTH` wherever the header draws them). Each was measured off
 * the rendered bar rather than picked: the brand, the tabs and the actions cluster are laid out
 * at their natural width and none of them shrinks, so the first pixel one of them loses is the
 * pixel they start overlapping on. Portuguese is the binding language; its tab words and action
 * labels are the longest either language puts in the bar.
 *
 * Brand 159 + 16 + nine worded tabs 686 + 12 + actions 390 (gear included) = 1263px of content.
 * The bar's content is 24px narrower than the room measured here (the shell gutter, less the
 * caption strip the bar already holds clear), and 16px more covers a font-rendering pass that
 * measures a few pixels wider: 1263 + 24 + 16 = 1303, so 1304px.
 *
 * That leaves the 1440px content cap 177px of room: a "Premium" tab (77px) and one short tab
 * (72px) with their 4px gaps still fit with the 16px margin (1436px). A tab past those two is a
 * conversation about this stage rather than a quiet addition.
 */
export const SHELL_ICON_TABS_WIDTH = 1304;

/**
 * The same sum with the tabs already down to glyphs: 159 + 16 + 390 + 12 + 390 = 967, so 1007px.
 * The glyph strip, with the active tab keeping its word (92px for "Ao vivo") beside eight
 * 32px glyphs, renders 390px.
 */
export const SHELL_BRAND_MARK_WIDTH = 1007;

/**
 * And with the brand down to its mark as well: 34 + 16 + 390 + 12 + 390 = 842, so 882px.
 *
 * The smallest window a player can drag to reaches this stage: the desktop's minimum
 * is 960px, which leaves 860px of bar after the caption inset, 22px under 882. At the minimum
 * window every secondary action sits behind the overflow button next to the gear (88px), so the
 * content is 34 + 16 + 390 + 12 + 88 = 540px, and 540 + 16 fits the 860px with 304px to spare.
 */
export const SHELL_ACTIONS_COLLAPSE_WIDTH = 882;

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
