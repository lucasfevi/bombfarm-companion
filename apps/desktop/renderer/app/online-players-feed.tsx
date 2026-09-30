'use client';

/**
 * The players online in the game right now, beside the game connection at the status strip's
 * left: a small word and the count. Nothing is drawn until a fresh reading is in hand and again
 * once it goes stale, so the cell is never a zero standing in for "unknown".
 */
import { cn, Tooltip } from '@bombfarm/ui';
import { useCopy, useLocale } from '../lib/copy';
import { formatCount } from '../lib/format';
import { useOnlinePlayers } from '../lib/online-players/use-online-players';

export function OnlinePlayersFeed() {
  const t = useCopy();
  const { locale } = useLocale();
  const reading = useOnlinePlayers();
  if (reading === null) return null;

  return (
    <Tooltip.Provider delay={200} closeDelay={80}>
      <Tooltip.Root>
        <Tooltip.Trigger
          render={
            <span data-testid="online-players-feed" className={cn('inline-flex', 'cursor-default', 'items-center', 'gap-1.5', 'border-l', 'border-line', 'py-1', 'pl-2.5')}>
              <span className={cn('text-[10px]', 'leading-none', 'font-semibold', 'tracking-[0.06em]', 'uppercase', 'text-muted')}>{t.onlinePlayersLabel}</span>
              <span data-testid="online-players-value" className={cn('font-mono', 'text-[10.5px]', 'leading-none', 'tabular-nums', 'text-ink')}>
                {formatCount(reading.players, locale)}
              </span>
            </span>
          }
        />
        <Tooltip.Portal>
          <Tooltip.Positioner side="top" sideOffset={6}>
            <Tooltip.Popup data-testid="online-players-tip">
              <p className="m-0">{t.onlinePlayersTip}</p>
            </Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
