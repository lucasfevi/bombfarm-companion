'use client';

import { useEffect, useState } from 'react';
import { Button, cn, Tooltip } from '@bombfarm/ui';
import { sub, useCopy } from '../../lib/copy';
import { formatCapturedAt } from '../../lib/format';

const AGE_TICK_MS = 15_000;

/**
 * The control that adopts a newer read, and the two things a reader needs to judge it. That the
 * pinned read has fallen behind the live one is shouted above the button, because it is the reason
 * to press it. How old the read is hangs off the button as a tooltip instead: it is worth an
 * answer when asked for and not worth a line of the screen otherwise.
 */
export function ForgeRefresh({
  capturedAt,
  stale,
  onRefresh,
}: {
  capturedAt: string | null;
  stale: boolean;
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

  const button = (
    <Button
      type="button"
      variant="default"
      data-testid="forge-refresh"
      onClick={onRefresh}
      className={cn(stale && 'border-warn')}
    >
      {t.farmRefresh}
    </Button>
  );

  return (
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
  );
}
