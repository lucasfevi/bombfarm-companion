'use client';

/**
 * The game as the zeroth feed, at the status strip's left end: a small-caps GAME over a mono
 * value — `live`, `stale 3m`, `not running` — in the same grammar as the feeds rail at the
 * right, and nothing else. No meter, because the game is not polled on a clock; it is the
 * upstream every other feed is read from. The word carries the state and colour only underlines
 * the two that want attention; the tooltip says the same thing in a sentence.
 *
 * The Live tab's corner dot reads from the same status through {@link liveTabMark}, so the two
 * can never disagree.
 */
import type { AppNavItemMark } from '@bombfarm/ui';
import { cn, Tooltip } from '@bombfarm/ui';
import type { GameStatusInfo } from '@bombfarm/contracts';
import { sub, useCopy, type Copy } from '../lib/copy';
import { formatAge } from '../lib/format';

/** A value that is not there yet — before main has answered once. Punctuation, so the same in
 *  both languages. */
const NONE = '—';

export function gameWords(status: GameStatusInfo | null, t: Copy): { value: string; tip: string; tone: AppNavItemMark['tone'] | null } {
  if (status === null) return { value: NONE, tip: t.shellLoadingLabel, tone: null };
  switch (status.status) {
    case 'connected':
      return { value: t.gameFeedLive, tip: t.liveStatusLiveLabel, tone: 'up' };
    case 'stale': {
      const age = status.staleAgeMs === undefined ? null : formatAge(status.staleAgeMs, t);
      return {
        value: age === null ? t.gameFeedStaleNoAge : sub(t.gameFeedStale, { age }),
        tip: age === null ? t.gameFeedStaleNoAgeTip : sub(t.gameFeedStaleTip, { age }),
        tone: 'warn',
      };
    }
    case 'not_running':
      return { value: t.gameFeedNotRunning, tip: t.gameFeedNotRunningTip, tone: 'muted' };
  }
}

/** What the Live tab's corner dot says: the game's own state, in the game cell's own words. */
export function liveTabMark(status: GameStatusInfo | null, t: Copy): AppNavItemMark | undefined {
  const words = gameWords(status, t);
  return words.tone === null ? undefined : { tone: words.tone, label: words.tip };
}

export function GameFeed({ status }: { status: GameStatusInfo | null }) {
  const t = useCopy();
  const { value, tip, tone } = gameWords(status, t);
  const valueTone = tone === 'warn' ? 'text-warn' : tone === 'muted' ? 'text-dim' : 'text-muted';

  return (
    <Tooltip.Provider delay={200} closeDelay={80}>
      <Tooltip.Root>
        <Tooltip.Trigger
          render={
            <span
              role="status"
              data-testid="game-feed"
              data-game={status?.status ?? 'loading'}
              className={cn('flex', 'min-w-[88px]', 'cursor-default', 'flex-col', 'gap-[3px]', 'py-0.5', 'leading-none')}
            >
              <span className="flex items-baseline justify-between gap-2.5">
                <span className={cn('text-[10px]', 'font-semibold', 'tracking-[0.06em]', 'uppercase', 'text-muted')}>{t.gameFeedLabel}</span>
                <span data-testid="game-feed-value" className={cn('font-mono', 'text-[11px]', 'tabular-nums', 'whitespace-nowrap', valueTone)}>
                  {value}
                </span>
              </span>
              {/* The rail's meter row, kept as height so the two ends of the strip share a baseline. */}
              <span aria-hidden className="h-0.5" />
            </span>
          }
        />
        <Tooltip.Portal>
          <Tooltip.Positioner side="top" sideOffset={6}>
            <Tooltip.Popup data-testid="game-feed-tip">
              <p className="m-0">{tip}</p>
            </Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
