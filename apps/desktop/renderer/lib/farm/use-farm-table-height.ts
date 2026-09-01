'use client';

/**
 * How tall the ranking table's scrollport may be in THIS window.
 *
 * The web planner scrolls a full-width page and can afford the fixed height the table was built
 * with. This shell cannot: its window goes down to 640px tall, where that fixed scrollport is
 * taller than everything the player can see at once, so the table gets a scrollbar inside a
 * scrollbar and the rows below the fold are unreachable without fighting both.
 *
 * The budget is the window, minus the shell chrome the table can never occupy, and it is never
 * allowed to exceed the height the web renders at — a large monitor gets the same table the web
 * planner has, not a 40-row one.
 */
import { useEffect, useState } from 'react';

/**
 * Title bar, nav rail padding and the page gutter the board sits inside, plus enough of a gap
 * that the row above the table's top edge stays visible — a scrollport flush with the fold reads
 * as the end of the page.
 */
const SHELL_CHROME_PX = 168;

/** The web planner's height, and this app's ceiling. */
export const MAX_TABLE_SCROLLPORT_PX = 614;

/** Roughly six rows. Below this the table stops being a table. */
export const MIN_TABLE_SCROLLPORT_PX = 200;

export function tableScrollportHeightFor(windowHeightPx: number): number {
  return Math.max(
    MIN_TABLE_SCROLLPORT_PX,
    Math.min(MAX_TABLE_SCROLLPORT_PX, Math.round(windowHeightPx - SHELL_CHROME_PX)),
  );
}

/**
 * Re-read on every window resize, so dragging the window taller grows the table with it. Seeded
 * with the ceiling rather than a measurement: this module is also evaluated during the static
 * export build, where there is no window, and a first paint at the web's own height is the
 * closest thing to "no opinion yet".
 */
export function useFarmTableHeight(): number {
  const [heightPx, setHeightPx] = useState(MAX_TABLE_SCROLLPORT_PX);

  useEffect(() => {
    const measure = () => {
      setHeightPx(tableScrollportHeightFor(window.innerHeight));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('resize', measure);
    };
  }, []);

  return heightPx;
}
