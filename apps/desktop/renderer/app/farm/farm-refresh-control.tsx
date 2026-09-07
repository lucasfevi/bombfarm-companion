'use client';

/**
 * The board's one refresh affordance, always mounted over the board's heading line — never a
 * banner that appears once the numbers have already gone out of date. Two states, one control:
 * the age of the ACCOUNT the board was computed from, or the fact that the live account has moved
 * past it.
 *
 * The press both re-solves the board and asks the app to go and read the account, so the button
 * is working while EITHER is in flight, and a read that never started says so beside the button —
 * to its left, where a line of any length leaves the button where the reader last saw it.
 *
 * The age is the account read's, never the calculation's. Those coincide while the app is reading
 * the game normally and diverge without limit when it is not, and dating the line by the
 * calculation meant every press of this button reset it to "just now" over numbers that had not
 * moved for hours. A button that certifies freshness it did not obtain is worse than no button.
 *
 * The age sits under the button rather than beside it so the button keeps one fixed position
 * while the line beneath it changes wording, width and tone.
 *
 * The age keeps itself current on its own interval. Nothing here recomputes anything: the board
 * only ever moves on `onRefresh`, which is the screen's own single recompute path.
 */
import { useEffect, useState } from 'react';
import { Button, cn } from '@bombfarm/ui';
import { sub, useCopy, type Copy } from '../../lib/copy';
import { accountReadRefusalText } from '../../lib/account-read-labels';
import type { AccountReadRequestState } from '../../lib/account/use-account-read-request';
import { formatCapturedAt } from '../../lib/format';

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
export function farmRefreshAgeLine(
  capturedAt: string | null,
  stale: boolean,
  t: Copy,
  now: number,
): string {
  if (stale) return t.farmRefreshStale;
  if (capturedAt === null) return '';
  return sub(t.farmRefreshedAge, { age: formatCapturedAt(capturedAt, t, now) });
}

export function FarmRefreshControl({
  capturedAt,
  stale,
  busy,
  readState,
  onRefresh,
}: {
  capturedAt: string | null;
  stale: boolean;
  busy: boolean;
  readState: AccountReadRequestState;
  onRefresh: () => void;
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

  return (
    <span data-testid="farm-refresh-control" className="flex items-start justify-end gap-2">
      {readState.kind === 'refused' ? (
        <span
          data-testid="farm-refresh-refusal"
          className="text-warn max-w-52 pt-1.5 text-right text-[11px] leading-snug"
        >
          {accountReadRefusalText(readState.reason, t)}
        </span>
      ) : null}
      <span className="flex flex-col items-end gap-0.5">
        <Button
          type="button"
          variant="primary"
          className="min-w-20"
          data-testid="farm-refresh"
          disabled={working}
          aria-busy={working}
          onClick={onRefresh}
        >
          {working ? t.farmRefreshBusy : t.farmRefresh}
        </Button>
        <span
          data-testid="farm-refresh-age"
          className={cn('text-[11px] leading-none', stale ? 'text-warn' : 'text-muted')}
        >
          {farmRefreshAgeLine(capturedAt, stale, t, now)}
        </span>
      </span>
    </span>
  );
}
