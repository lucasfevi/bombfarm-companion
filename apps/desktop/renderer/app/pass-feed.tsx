'use client';

/**
 * The time left on the Pass, beside the players count at the status strip's left. Drawn only
 * while the account holds an active Pass.
 */
import { cn, Tooltip } from '@bombfarm/ui';
import { useCopy } from '../lib/copy';
import { usePassCountdown } from '../lib/pass/use-pass-countdown';

export function PassFeed() {
  const t = useCopy();
  const remaining = usePassCountdown();
  if (remaining === null) return null;

  return (
    <Tooltip.Provider delay={200} closeDelay={80}>
      <Tooltip.Root>
        <Tooltip.Trigger
          render={
            <span data-testid="pass-feed" className={cn('inline-flex', 'cursor-default', 'items-center', 'gap-1.5', 'border-l', 'border-line', 'py-1', 'pl-2.5')}>
              <span className={cn('text-[10px]', 'leading-none', 'font-semibold', 'tracking-[0.06em]', 'uppercase', 'text-muted')}>{t.passFeedLabel}</span>
              <span data-testid="pass-feed-value" className={cn('font-mono', 'text-[10.5px]', 'leading-none', 'tabular-nums', 'text-ink')}>
                {remaining}
              </span>
            </span>
          }
        />
        <Tooltip.Portal>
          <Tooltip.Positioner side="top" sideOffset={6}>
            <Tooltip.Popup data-testid="pass-feed-tip">
              <p className="m-0">{t.passFeedTip}</p>
            </Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
