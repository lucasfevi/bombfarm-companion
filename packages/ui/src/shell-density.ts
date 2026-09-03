'use client';

import { useSyncExternalStore } from 'react';

/**
 * How much of itself the top bar can still show.
 *
 * - `full` — brand lockup, worded tabs, every action spelled out in the bar.
 * - `actions-collapsed` — the secondary actions move behind one overflow button. The tabs keep
 *   their words, which is the half of the bar a player navigates by.
 * - `icon-tabs` — the tabs become glyphs (the active one keeps its label, so the screen is still
 *   named) and the brand shrinks to its mark.
 */
export type ShellDensity = 'full' | 'actions-collapsed' | 'icon-tabs';

/**
 * Both widths are the room the bar actually has — the window minus the strip the OS caption
 * buttons claim, which is ~136px on Windows and none elsewhere — and both were measured off the
 * rendered bar rather than picked: the tabs and the actions cluster are laid out at their natural
 * width and neither shrinks, so the first pixel one of them loses is the pixel they start
 * overlapping on. Portuguese is the binding language; its tab words are the longest either
 * language puts in the pill.
 *
 * Brand 159 + tabs 446 + actions 340 + the padding and two gaps = 989px for the whole bar. The
 * margin above that absorbs a font-rendering pass that measures a few pixels wider.
 */
export const SHELL_ACTIONS_COLLAPSE_WIDTH = 1000;

/** The same sum with the actions already down to their one 38px button: 687px. */
export const SHELL_ICON_TABS_WIDTH = 700;

export function shellDensityFor(availableWidth: number): ShellDensity {
  if (availableWidth < SHELL_ICON_TABS_WIDTH) return 'icon-tabs';
  if (availableWidth < SHELL_ACTIONS_COLLAPSE_WIDTH) return 'actions-collapsed';
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
 * so React bails out of re-rendering for every pixel of a drag and only commits on the two
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
