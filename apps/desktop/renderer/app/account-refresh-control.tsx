'use client';

/**
 * The app's one refresh affordance, drawn by the shell's refresh bar under the top bar for the
 * tab on screen, whether or not its numbers have gone out of date. One icon button, and one line
 * to its left that says the age of the ACCOUNT the screen was computed from, that the live
 * account has moved past it, or — for as long as it stands — why a press started no read. Only
 * that line's words change between states; the control keeps one height, and the button keeps
 * its place at the right edge.
 *
 * The age is the account read's, never the calculation's. Those coincide while the app is reading
 * the game normally and diverge without limit when it is not, and dating the line by the
 * calculation meant every press of this button reset it to "just now" over numbers that had not
 * moved for hours. A button that certifies freshness it did not obtain is worse than no button.
 *
 * The age keeps itself current on its own interval. Nothing here recomputes anything: the screen
 * only ever moves on `onRefresh`, which is the screen's own single recompute path.
 */
import { useEffect, useState } from 'react';
import { Button, cn, Icon, Tooltip } from '@bombfarm/ui';
import { sub, useCopy, type Copy } from '../lib/copy';
import { accountReadRefusalText } from '../lib/account-read-labels';
import type { AccountReadRequestState } from '../lib/account/use-account-read-request';
import { formatCapturedAt } from '../lib/format';

/** The shortest bucket `formatCapturedAt` prints is a minute, so a quarter of one is fast enough
 *  to make "just now" turn over promptly and slow enough to cost nothing. */
const AGE_TICK_MS = 15_000;

/**
 * Pure, and exported so the rule is testable without mounting: this project's Vitest run is
 * node-environment with `renderToStaticMarkup`, so a line only reachable through an interval
 * would be a line nothing drives.
 *
 * An account with no readable capture time says nothing rather than borrowing the clock. Empty is
 * the honest answer there — "just now" over an unknown age is the exact failure this line already
 * had once.
 */
export function accountRefreshAgeLine(
  capturedAt: string | null,
  stale: boolean,
  t: Copy,
  now: number,
): string {
  if (stale) return t.farmRefreshStale;
  if (capturedAt === null) return '';
  return sub(t.farmRefreshedAge, { age: formatCapturedAt(capturedAt, t, now) });
}

export function AccountRefreshControl({
  capturedAt,
  stale,
  busy,
  readState,
  onRefresh,
  ageLine,
}: {
  capturedAt: string | null;
  stale: boolean;
  busy: boolean;
  readState: AccountReadRequestState;
  onRefresh: () => void;
  /** The line beside the button, when the thing refreshed is not the account read: given the
   *  same relative age the default line prints. */
  ageLine?: (age: string) => string;
}) {
  const t = useCopy();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, AGE_TICK_MS);
    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const working = busy || readState.kind === 'working';
  const age =
    ageLine !== undefined && capturedAt !== null && !stale
      ? ageLine(formatCapturedAt(capturedAt, t, now))
      : accountRefreshAgeLine(capturedAt, stale, t, now);
  const refused = readState.kind === 'refused';
  const lineClass = cn('text-[11px]', 'leading-none', 'tabular-nums', 'whitespace-nowrap', stale || refused ? 'text-warn' : 'text-muted');

  return (
    <span data-testid="account-refresh-control" className="inline-flex items-center justify-end gap-1.5">
      {refused ? (
        <span data-testid="account-refresh-refusal" className={lineClass}>
          {accountReadRefusalText(readState.reason, t)}
        </span>
      ) : (
        <span data-testid="account-refresh-age" className={lineClass}>
          {age}
        </span>
      )}
      <Tooltip.Provider delay={200} closeDelay={80}>
        <Tooltip.Root>
          <Tooltip.Trigger
            render={
              <Button
                type="button"
                variant="icon-action"
                aria-label={t.farmRefresh}
                data-testid="account-refresh"
                disabled={working}
                aria-busy={working}
                onClick={onRefresh}
              >
                <Icon name="arrow-path" size="sm" data-icon="arrow-path" className={cn(working && 'motion-safe:animate-spin')} />
              </Button>
            }
          />
          <Tooltip.Portal>
            <Tooltip.Positioner sideOffset={6}>
              <Tooltip.Popup data-testid="account-refresh-tip">
                <p className="m-0">{t.farmRefresh}</p>
                {age === '' ? null : <p className="m-0">{age}</p>}
              </Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
      </Tooltip.Provider>
    </span>
  );
}
