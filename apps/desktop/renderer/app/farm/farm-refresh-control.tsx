'use client';

/**
 * The board's one refresh affordance, always mounted beside the board's heading — never a banner
 * that appears once the numbers have already gone out of date. Two states, one control: the age
 * of the board on screen, or the fact that the live account has moved past it.
 *
 * The age keeps itself current on its own interval. Nothing here recomputes anything: the board
 * only ever moves on `onRefresh`, which is the screen's own single recompute path.
 */
import { useEffect, useState } from 'react';
import { Button } from '@bombfarm/ui';
import { sub, useCopy } from '../../lib/copy';
import { formatCapturedAt } from '../../lib/format';

/** The shortest bucket `formatCapturedAt` prints is a minute, so a quarter of one is fast enough
 *  to make "just now" turn over promptly and slow enough to cost nothing. */
const AGE_TICK_MS = 15_000;

export function FarmRefreshControl({
  computedAt,
  stale,
  busy,
  onRefresh,
}: {
  computedAt: string;
  stale: boolean;
  busy: boolean;
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

  return (
    <span data-testid="farm-refresh-control" className="flex items-baseline gap-2">
      <span
        data-testid="farm-refresh-age"
        className={stale ? 'text-[11px] text-warn' : 'text-[11px] text-muted'}
      >
        {stale ? t.farmRefreshStale : sub(t.farmRefreshedAge, { age: formatCapturedAt(computedAt, t, now) })}
      </span>
      <Button
        type="button"
        variant="text"
        className="min-w-20 text-right"
        data-testid="farm-refresh"
        disabled={busy}
        aria-busy={busy}
        onClick={onRefresh}
      >
        {busy ? t.farmRefreshBusy : t.farmRefresh}
      </Button>
    </span>
  );
}
