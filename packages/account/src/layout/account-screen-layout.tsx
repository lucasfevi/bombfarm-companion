import type { ReactNode } from 'react';
import { cn } from '@bombfarm/ui';

export interface AccountScreenLayoutProps {
  /** What the account could sell — the widest region, and the one with columns of its own. */
  holdings: ReactNode;
  /** Who the account is: four short read-only facts. */
  identity: ReactNode;
  house: ReactNode;
  tree: ReactNode;
  /**
   * One line under the summary row, for a host that has something to say about the whole read —
   * the desktop dates its account capture here. Deliberately NOT inside a column: anything stacked
   * under one panel makes that column taller than its neighbour, and the two panels stop lining up
   * at the bottom. Omitted by a host with nothing to add, and then nothing is rendered.
   */
  meta?: ReactNode;
  className?: string;
}

/**
 * Where the Account screen's four regions sit, for both apps at once.
 *
 * Each app connects its own panels and drops the ones it could not read; this owns nothing but the
 * grid, so the two screens cannot drift into two arrangements of the same four things.
 *
 * Holdings and identity share the first row. Holdings takes the remaining width rather than half of
 * it, because it lays three columns out inside itself and an even split would fold them back into a
 * stack; identity is capped so it stops growing once its longest fact fits unabbreviated. Both rows
 * collapse to a stack as the measure narrows — the desktop window resizes down to a small width and
 * the planner is read on narrow viewports.
 *
 * Side-by-side panels are the SAME HEIGHT. One that stops short of its neighbour reads as
 * unfinished rather than as brief. The stretch has to reach the panel itself, not just the grid
 * cell, because the panel is the thing carrying the border — hence `flex-1` on the slot's child.
 */
export function AccountScreenLayout({
  holdings,
  identity,
  house,
  tree,
  meta,
  className,
}: AccountScreenLayoutProps) {
  return (
    <div data-testid="account-screen" className={cn('flex min-w-0 flex-col gap-2.5', className)}>
      <div
        data-testid="account-screen-summary"
        className="grid min-w-0 grid-cols-1 items-stretch gap-2.5 min-[960px]:grid-cols-[minmax(0,1fr)_minmax(19rem,23rem)]"
      >
        {/* Both slots pass the stretch to their panel, so the equal-height rule holds whichever
            side turns out to be taller — a panel grows only when there is free height to take. */}
        <div data-testid="account-screen-holdings" className="flex min-w-0 flex-col [&>*]:flex-1">
          {holdings}
        </div>
        <div data-testid="account-screen-identity" className="flex min-w-0 flex-col [&>*]:flex-1">
          {identity}
        </div>
      </div>
      {meta == null ? null : (
        <div data-testid="account-screen-meta" className="min-w-0">
          {meta}
        </div>
      )}
      <div
        data-testid="account-screen-panels"
        className="grid min-w-0 grid-cols-1 gap-2.5 min-[720px]:grid-cols-2"
      >
        {house}
        {tree}
      </div>
    </div>
  );
}
