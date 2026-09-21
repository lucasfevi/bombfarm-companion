'use client';

/**
 * The game connection at the status strip's left end: a dot and a word. Connected — a green dot
 * that pulses, the one motion in the strip that is always on, beside the word. Stale — a steady
 * amber dot, the word, and the age beside it. Not running — a hollow dot and a muted word. No
 * meter, because the game is not polled on a clock; it is the upstream every feed is read from.
 *
 * The Live tab's corner dot reads from the same status through {@link liveTabMark}, so the two
 * can never disagree.
 *
 * The dot sits a pixel above the line box's centre: the word is capitals, whose ink sits high in
 * the box over the descender space they never use, so centring the boxes leaves the dot's ink a
 * pixel below the letters' (measured on the launched app, 2026-09-20).
 */
import type { AppNavItemMark } from '@bombfarm/ui';
import { cn, Tooltip } from '@bombfarm/ui';
import type { GameStatusInfo } from '@bombfarm/contracts';
import { sub, useCopy, type Copy } from '../lib/copy';
import { formatAge } from '../lib/format';

export type GameWords = { word: string; age: string | null; tip: string; tone: AppNavItemMark['tone'] | null };

export function gameWords(status: GameStatusInfo | null, t: Copy): GameWords {
  if (status === null) return { word: t.gameConnecting, age: null, tip: t.shellLoadingLabel, tone: null };
  switch (status.status) {
    case 'connected':
      return { word: t.gameConnected, age: null, tip: t.liveStatusLiveLabel, tone: 'up' };
    case 'stale': {
      const age = status.staleAgeMs === undefined ? null : formatAge(status.staleAgeMs, t);
      return { word: t.gameStale, age, tip: age === null ? t.gameFeedStaleNoAgeTip : sub(t.gameFeedStaleTip, { age }), tone: 'warn' };
    }
    case 'not_running':
      return { word: t.gameNotRunning, age: null, tip: t.gameFeedNotRunningTip, tone: 'muted' };
  }
}

/** What the Live tab's corner dot says: the game's own state, in the game cell's own words. */
export function liveTabMark(status: GameStatusInfo | null, t: Copy): AppNavItemMark | undefined {
  const words = gameWords(status, t);
  return words.tone === null ? undefined : { tone: words.tone, label: words.tip };
}

export function GameFeed({ status }: { status: GameStatusInfo | null }) {
  const t = useCopy();
  const { word, age, tip, tone } = gameWords(status, t);
  const dotClass = tone === 'up' ? cn('bg-up', 'motion-safe:animate-pulse') : tone === 'warn' ? 'bg-warn' : cn('bg-transparent', 'shadow-[inset_0_0_0_1.5px_var(--line)]');
  const wordClass = tone === 'up' ? 'text-ink' : tone === 'warn' ? 'text-warn' : 'text-muted';

  return (
    <Tooltip.Provider delay={200} closeDelay={80}>
      <Tooltip.Root>
        <Tooltip.Trigger
          render={
            <span
              role="status"
              data-testid="game-feed"
              data-game={status?.status ?? 'loading'}
              className={cn('inline-flex', 'cursor-default', 'items-center', 'gap-2', 'py-1')}
            >
              <span aria-hidden data-testid="game-feed-dot" className={cn('relative', '-top-px', 'size-[7px]', 'shrink-0', 'rounded-full', dotClass)} />
              <span data-testid="game-feed-value" className={cn('text-[10px]', 'leading-none', 'font-semibold', 'tracking-[0.06em]', 'uppercase', wordClass)}>
                {word}
              </span>
              {age !== null ? (
                <span data-testid="game-feed-age" className={cn('font-mono', 'text-[10.5px]', 'leading-none', 'tabular-nums', 'text-warn')}>
                  {age}
                </span>
              ) : null}
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
