'use client';

import { useEffect, useState } from 'react';
import type { AccountReadRefusal } from '@bombfarm/contracts';
import { Button, cn, Tooltip } from '@bombfarm/ui';
import { sub, useCopy } from '../../lib/copy';
import { formatCapturedAt } from '../../lib/format';
import { forgeRefreshRefusalText } from './forge-labels';

const AGE_TICK_MS = 15_000;

/** What the press is doing: nothing yet, a read in flight, or a read that never started and the
 *  reason it did not. */
export type ForgeRefreshState =
  | { kind: 'idle' }
  | { kind: 'working' }
  | { kind: 'refused'; reason: AccountReadRefusal };

/**
 * The control that goes and reads the account, and the three things a reader needs to judge it.
 * That the pinned read has fallen behind the live one is shouted above the button, because it is
 * the reason to press it. How old the read is hangs off the button as a tooltip instead: it is
 * worth an answer when asked for and not worth a line of the screen otherwise. And a press that
 * started no read says why, beside the button — every press this screen can make ends in one of
 * these three, and a button that answers a press with nothing is what the reader reads as broken.
 */
export function ForgeRefresh({
  capturedAt,
  stale,
  state,
  onRefresh,
}: {
  capturedAt: string | null;
  stale: boolean;
  state: ForgeRefreshState;
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

  const working = state.kind === 'working';
  const button = (
    <Button
      type="button"
      variant="default"
      data-testid="forge-refresh"
      onClick={onRefresh}
      disabled={working}
      className={cn(stale && !working && 'border-warn')}
    >
      {working ? t.forgeRefreshWorking : t.farmRefresh}
    </Button>
  );

  return (
    <div className="flex items-end justify-end gap-3">
      {state.kind === 'refused' ? (
        <span data-testid="forge-refresh-refusal" className="text-warn pb-1.5 text-xs leading-snug">
          {forgeRefreshRefusalText(state.reason, t)}
        </span>
      ) : null}
      <div className="flex flex-col items-end gap-1.5">
        {stale ? (
          <span
            data-testid="forge-stale-label"
            className="text-[10px] leading-none font-bold tracking-[0.06em] text-warn uppercase"
          >
            {t.farmRefreshStale}
          </span>
        ) : null}
        {capturedAt === null ? (
          button
        ) : (
          <Tooltip.Provider delay={200} closeDelay={80}>
            <Tooltip.Root>
              <Tooltip.Trigger render={button} />
              <Tooltip.Portal>
                <Tooltip.Positioner sideOffset={6}>
                  <Tooltip.Popup>
                    <p data-testid="forge-read-age" className="m-0">
                      {sub(t.accountReadAge, { age: formatCapturedAt(capturedAt, t, now) })}
                    </p>
                  </Tooltip.Popup>
                </Tooltip.Positioner>
              </Tooltip.Portal>
            </Tooltip.Root>
          </Tooltip.Provider>
        )}
      </div>
    </div>
  );
}
