'use client';

/**
 * The status strip's rail of the four feeds the app keeps asking for — the account read, the PVP
 * standing, the price list, the update check — each as a name over a mono age, with a hairline
 * meter under it that fills towards the feed's next automatic refresh. The meter is the one thing
 * this strip can say that a timestamp cannot: how soon the feed will refresh itself, and so
 * whether pressing is even worth it. A feed with no clock of its own (the PVP standing) draws a
 * dotted line instead.
 *
 * Each item is its own press. The button at the rail's end presses all four, one after another,
 * and counts the steps while it runs.
 */
import { useEffect, useState } from 'react';
import { Button, cn, Icon, Tooltip } from '@bombfarm/ui';
import { sub, useCopy, type Copy } from '../lib/copy';
import { accountReadRefusalText } from '../lib/account-read-labels';
import { formatAge, formatCapturedAt } from '../lib/format';
import { FEED_CYCLE_MS, feedAgeMs, feedMeter, feedNextInMs, type FeedId } from '../lib/feeds/feed-clock';
import type { FeedView, FeedsHook } from '../lib/feeds/use-feeds';

/** The meter fills over a minute on the account feed, so a five-second tick keeps it moving
 *  without costing anything; the age text's shortest bucket is a minute anyway. */
const CLOCK_TICK_MS = 5_000;

function feedName(feed: FeedId, t: Copy): string {
  switch (feed) {
    case 'account':
      return t.feedsAccount;
    case 'pvp':
      return t.feedsPvp;
    case 'market':
      return t.feedsPrices;
    case 'updates':
      return t.feedsUpdates;
  }
}

/** Every clock here is whole minutes — the shortest is the account's sixty seconds. */
function cycleText(feed: FeedId, t: Copy): string | null {
  const cycle = FEED_CYCLE_MS[feed];
  return cycle === null ? null : sub(t.feedsCycleMinutes, { n: Math.round(cycle / 60_000) });
}

/** The words for one item, pure so the test can read them without mounting: the line under the
 *  name, and the tooltip's second and third sentences. */
export function feedWords(feed: FeedView, t: Copy, now: number): { line: string; late: boolean; tip: string[] } {
  const ageMs = feedAgeMs(feed.capturedAt, now);
  const working = feed.busy || feed.readState.kind === 'working';
  const line = working
    ? t.feedsReading
    : feed.readState.kind === 'refused'
      ? accountReadRefusalText(feed.readState.reason, t)
      : feed.outOfDate
        ? t.farmRefreshStale
        : feed.capturedAt === null
          ? t.feedsNotYet
          : formatCapturedAt(feed.capturedAt, t, now);
  // Age alone is never amber: a feed that has run past its clock is drawn with a full meter, in
  // the same muted tone — only a screen computed from a copy the live account has moved past, or
  // a press that started nothing, is a state worth the warn tone.
  const late = feed.outOfDate || feed.readState.kind === 'refused';
  const tip = [sub(t.feedsRefreshOne, { feed: feedName(feed.id, t) })];
  const cycle = cycleText(feed.id, t);
  if (cycle === null) tip.push(t.feedsNoClock);
  else {
    tip.push(sub(t.feedsEvery, { cycle }));
    const nextIn = feedNextInMs(feed.id, ageMs);
    if (nextIn !== null) tip.push(nextIn === 0 ? t.feedsNextDue : sub(t.feedsNextIn, { age: formatAge(nextIn, t) }));
  }
  return { line, late, tip };
}

function FeedItem({ feed, t, now, waiting }: { feed: FeedView; t: Copy; now: number; waiting: boolean }) {
  const { line, late, tip } = feedWords(feed, t, now);
  const working = feed.busy || feed.readState.kind === 'working';
  const meter = feedMeter(feed.id, feedAgeMs(feed.capturedAt, now));
  const lineTone = late ? 'text-warn' : working ? 'text-ink' : 'text-muted';
  const testIds = feed.id === 'account' ? { button: 'account-refresh', line: 'account-refresh-age' } : { button: `feed-${feed.id}-refresh`, line: `feed-${feed.id}-age` };

  return (
    <Tooltip.Root>
      <Tooltip.Trigger
        render={
          <button
            type="button"
            data-testid={testIds.button}
            data-feed={feed.id}
            data-state={working ? 'working' : late ? 'late' : 'fresh'}
            aria-label={tip[0]}
            aria-busy={working}
            disabled={working}
            onClick={feed.request}
            className={cn(
              'flex',
              'min-w-[88px]',
              'cursor-pointer',
              'flex-col',
              'gap-[3px]',
              'border-0',
              'border-l',
              'border-line',
              'bg-transparent',
              'px-2.5',
              'py-0.5',
              'text-left',
              'first:border-l-0',
              'hover:[&_[data-feed-age]]:text-ink',
              'disabled:cursor-default',
              'focus-visible:rounded-sm',
              'focus-visible:[outline-style:solid]',
              'focus-visible:outline-2',
              'focus-visible:outline-offset-1',
              'focus-visible:outline-accent',
              waiting && 'opacity-55',
            )}
          >
            <span className="flex items-baseline justify-between gap-2.5 leading-none">
              <span className={cn('text-[10px]', 'font-semibold', 'tracking-[0.06em]', 'uppercase', late ? 'text-warn' : 'text-muted')}>{feedName(feed.id, t)}</span>
              <span data-feed-age data-testid={testIds.line} className={cn('font-mono', 'text-[11px]', 'tabular-nums', 'whitespace-nowrap', lineTone)}>
                {line}
              </span>
            </span>
            {meter === null && !working ? (
              <span aria-hidden className="h-0 border-t border-dotted border-line" />
            ) : (
              <span aria-hidden className="h-0.5 overflow-hidden rounded-px bg-line">
                <span
                  className={cn('block', 'h-full', late ? 'bg-warn' : working ? 'bg-accent' : 'bg-muted', working && 'motion-safe:animate-pulse')}
                  style={{ width: `${String(Math.round((working ? 1 : (meter ?? 0)) * 100))}%` }}
                />
              </span>
            )}
          </button>
        }
      />
      <Tooltip.Portal>
        <Tooltip.Positioner side="top" sideOffset={6}>
          <Tooltip.Popup data-testid={`feed-${feed.id}-tip`}>
            {tip.map((sentence, index) => (
              <p key={index} className="m-0">
                {sentence}
              </p>
            ))}
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

export function FeedsRail({ feeds, refreshAll, all }: FeedsHook) {
  const t = useCopy();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, CLOCK_TICK_MS);
    return () => {
      window.clearInterval(timer);
    };
  }, []);

  return (
    <Tooltip.Provider delay={200} closeDelay={80}>
      <div data-testid="feeds-rail" data-running={all.running} className="flex items-center gap-2">
        <div className="flex items-stretch">
          {feeds.map((feed, index) => (
            <FeedItem key={feed.id} feed={feed} t={t} now={now} waiting={all.running && index > all.step} />
          ))}
        </div>
        <Tooltip.Root>
          <Tooltip.Trigger
            render={
              <Button
                type="button"
                variant="icon-action"
                aria-label={t.feedsRefreshAll}
                data-testid="feeds-refresh-all"
                disabled={all.running}
                aria-busy={all.running}
                onClick={refreshAll}
              >
                <Icon name="arrow-path" size="sm" data-icon="arrow-path" className={cn(all.running && 'motion-safe:animate-spin')} />
              </Button>
            }
          />
          <Tooltip.Portal>
            <Tooltip.Positioner side="top" sideOffset={6}>
              <Tooltip.Popup>
                <p className="m-0">{t.feedsRefreshAll}</p>
              </Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
        {all.running ? (
          <span data-testid="feeds-refresh-all-step" className="font-mono text-[11px] tabular-nums text-muted">
            {sub(t.feedsRefreshAllStep, { step: all.step + 1, total: all.total })}
          </span>
        ) : null}
      </div>
    </Tooltip.Provider>
  );
}
