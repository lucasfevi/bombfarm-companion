import type { ReactNode } from 'react';
import { cn } from '@bombfarm/ui';

export interface AccountScreenLayoutProps {
  /** What the account could sell — the widest region, and the one with columns of its own. */
  holdings: ReactNode;
  /** Who the account is: four short read-only facts. */
  identity: ReactNode;
  house: ReactNode;
  tree: ReactNode;
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
 * stack; identity is four short facts and is capped so it stops growing once it is readable. Both
 * rows collapse to a stack as the measure narrows — the desktop window resizes down to a small
 * width and the planner is read on narrow viewports.
 */
export function AccountScreenLayout({
  holdings,
  identity,
  house,
  tree,
  className,
}: AccountScreenLayoutProps) {
  return (
    <div data-testid="account-screen" className={cn('flex min-w-0 flex-col gap-2.5', className)}>
      <div
        data-testid="account-screen-summary"
        className="grid min-w-0 grid-cols-1 items-start gap-2.5 min-[960px]:grid-cols-[minmax(0,1fr)_minmax(15rem,18rem)]"
      >
        <div data-testid="account-screen-holdings" className="flex min-w-0 flex-col gap-2.5">
          {holdings}
        </div>
        <div data-testid="account-screen-identity" className="min-w-0">
          {identity}
        </div>
      </div>
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
