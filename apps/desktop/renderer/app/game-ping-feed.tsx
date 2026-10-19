'use client';

/**
 * The round trip to the game's server, right of the game connection at the status strip's left:
 * a small word and the milliseconds. A dash stands in while no check has landed or the last one
 * failed, so a blank never reads as a fast connection.
 */
import { cn, Tooltip } from '@bombfarm/ui';
import { useCopy } from '../lib/copy';
import { useGamePing } from '../lib/game-ping/use-game-ping';

const SLOW_MS = 500;

export function GamePingFeed() {
  const t = useCopy();
  const latencyMs = useGamePing();
  const slow = latencyMs !== null && latencyMs >= SLOW_MS;

  return (
    <Tooltip.Provider delay={200} closeDelay={80}>
      <Tooltip.Root>
        <Tooltip.Trigger
          render={
            <span data-testid="game-ping-feed" className={cn('inline-flex', 'cursor-default', 'items-center', 'gap-1.5', 'border-l', 'border-line', 'py-1', 'pl-2.5')}>
              <span className={cn('text-[10px]', 'leading-none', 'font-semibold', 'tracking-[0.06em]', 'uppercase', 'text-muted')}>{t.gamePingLabel}</span>
              <span
                data-testid="game-ping-value"
                className={cn('font-mono', 'text-[10.5px]', 'leading-none', 'tabular-nums', slow ? 'text-warn' : latencyMs === null ? 'text-muted' : 'text-ink')}
              >
                {latencyMs === null ? '—' : `${String(latencyMs)} ms`}
              </span>
            </span>
          }
        />
        <Tooltip.Portal>
          <Tooltip.Positioner side="top" sideOffset={6}>
            <Tooltip.Popup data-testid="game-ping-tip">
              <p className="m-0">{latencyMs === null ? t.gamePingUnreachableTip : t.gamePingTip}</p>
            </Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
