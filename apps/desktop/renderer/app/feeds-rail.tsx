'use client';

/**
 * The status strip's rail of the four feeds the app keeps asking for — the account read, the PVP
 * standing, the price list, the update check — each as a small ring beside its name. The ring is
 * the time left until the feed refreshes itself: full the moment a read lands, draining to empty
 * as its clock runs down, so a glance says whether pressing is even worth it. A read in flight
 * spins; a landing snaps the ring full and lights its centre for a moment; a screen computed from
 * an older copy of the account draws the ring in the warn tone with a filled centre; a feed with
 * no clock of its own (the PVP standing) draws a dotted ring. No figures at rest — the age and the
 * countdown are the tooltip's.
 *
 * Each item is its own press. The button at the rail's end presses all four, one after another,
 * and is itself a ring that fills a quarter per step. The feeds the tab on show does not read are
 * drawn muted — present and pressable, but not what that screen's numbers came from.
 */
import { useEffect, useRef, useState } from 'react';
import { cn, Tooltip } from '@bombfarm/ui';
import { sub, useCopy, type Copy } from '../lib/copy';
import { accountReadRefusalText } from '../lib/account-read-labels';
import { formatAge, formatCapturedAt } from '../lib/format';
import { FEED_CYCLE_MS, feedAgeMs, feedMeter, feedNextInMs, feedsReadBy, type FeedId } from '../lib/feeds/feed-clock';
import type { FeedView, FeedsHook, RefreshAllState } from '../lib/feeds/use-feeds';

/** The ring drains over a minute on the account feed, so a two-second tick keeps it moving
 *  without costing anything. */
const CLOCK_TICK_MS = 2_000;
/** How long the centre stays lit after a read lands. */
const LANDED_MS = 700;

const RING_R = 6.5;
const RING_C = 2 * Math.PI * RING_R;

export type RingState = 'never' | 'fresh' | 'working' | 'late' | 'refused' | 'noclock';

/** The ring's one figure and its state — pure, so the test can read it without mounting. `left`
 *  is the fraction of the feed's clock still to run: 1 the moment a read lands, 0 when due. */
export function ringGeometry(feed: FeedView, now: number): { state: RingState; left: number | null } {
  const working = feed.busy || feed.readState.kind === 'working';
  const ageMs = feedAgeMs(feed.capturedAt, now);
  const meter = feedMeter(feed.id, ageMs);
  const left = meter === null ? null : 1 - meter;
  if (working) return { state: 'working', left };
  if (feed.outOfDate) return { state: 'late', left };
  if (feed.readState.kind === 'refused') return { state: 'refused', left };
  if (feed.capturedAt === null) return { state: 'never', left: null };
  if (FEED_CYCLE_MS[feed.id] === null) return { state: 'noclock', left: null };
  return { state: 'fresh', left };
}

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

function feedWhat(feed: FeedId, t: Copy): string {
  switch (feed) {
    case 'account':
      return t.feedsWhatAccount;
    case 'pvp':
      return t.feedsWhatPvp;
    case 'market':
      return t.feedsWhatPrices;
    case 'updates':
      return t.feedsWhatUpdates;
  }
}

/** The tooltip, top to bottom: the feed's name; what it is; where it stands; how it keeps itself
 *  fresh; why a press was refused; and, muted, what a click does — nothing while a read runs. */
export type FeedTip = { title: string; lines: string[]; action: string | null };

export function feedWords(feed: FeedView, t: Copy, now: number): FeedTip {
  const ageMs = feedAgeMs(feed.capturedAt, now);
  const working = feed.busy || feed.readState.kind === 'working';
  const lines = [feedWhat(feed.id, t)];
  if (working) lines.push(t.feedsReadingNow);
  else if (feed.outOfDate) lines.push(t.feedsOutOfDate);
  else if (feed.capturedAt === null) lines.push(t.feedsNeverRead);
  else lines.push(sub(t.feedsLastRead, { age: formatCapturedAt(feed.capturedAt, t, now) }));
  const cycle = cycleText(feed.id, t);
  if (cycle === null) lines.push(t.feedsNoClock);
  else {
    const nextIn = feedNextInMs(feed.id, ageMs);
    lines.push(nextIn === null ? sub(t.feedsEveryUnread, { cycle }) : nextIn === 0 ? sub(t.feedsEveryDue, { cycle }) : sub(t.feedsEvery, { cycle, age: formatAge(nextIn, t) }));
  }
  if (feed.readState.kind === 'refused') lines.push(accountReadRefusalText(feed.readState.reason, t));
  return { title: feedName(feed.id, t), lines, action: working ? null : t.feedsClickToUpdate };
}

function Ring({ state, left, landed, tone }: { state: RingState; left: number | null; landed: boolean; tone?: 'accent' | 'up' }) {
  const arcClass = state === 'late' ? 'stroke-warn' : state === 'refused' ? 'stroke-line' : tone === 'accent' ? 'stroke-accent' : tone === 'up' ? 'stroke-up' : 'stroke-muted';
  return (
    <svg aria-hidden viewBox="0 0 16 16" className={cn('size-4', 'shrink-0', state === 'working' && 'motion-safe:animate-spin')} data-ring={state}>
      <circle cx="8" cy="8" r={RING_R} className="fill-none stroke-line" strokeWidth="2.2" />
      {state === 'noclock' ? (
        <circle cx="8" cy="8" r={RING_R} className="fill-none stroke-line" strokeWidth="2.2" strokeDasharray="2 3" />
      ) : state === 'working' ? (
        <circle cx="8" cy="8" r={RING_R} className="fill-none stroke-accent" strokeWidth="2.2" strokeDasharray="8 30" />
      ) : state === 'never' ? null : (
        <circle
          cx="8"
          cy="8"
          r={RING_R}
          className={cn('fill-none', arcClass, 'transition-[stroke-dashoffset]', 'duration-1000', 'ease-linear')}
          strokeWidth="2.2"
          strokeDasharray={RING_C}
          strokeDashoffset={RING_C * (1 - (left ?? 1))}
          transform="rotate(-90 8 8)"
        />
      )}
      {state === 'late' ? <circle cx="8" cy="8" r="2.5" className="fill-warn" /> : landed ? <circle cx="8" cy="8" r="2" className="fill-up" /> : null}
    </svg>
  );
}

/** True for a moment after `capturedAt` moves — the landing the ring lights its centre for. */
function useLanded(capturedAt: string | null): boolean {
  const [landed, setLanded] = useState(false);
  const previous = useRef(capturedAt);
  useEffect(() => {
    if (previous.current === capturedAt) return;
    const wasRead = previous.current !== null;
    previous.current = capturedAt;
    if (!wasRead || capturedAt === null) return;
    setLanded(true);
    const timer = window.setTimeout(() => {
      setLanded(false);
    }, LANDED_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [capturedAt]);
  return landed;
}

function FeedItem({ feed, t, now, muted }: { feed: FeedView; t: Copy; now: number; muted: boolean }) {
  const { state, left } = ringGeometry(feed, now);
  const landed = useLanded(feed.capturedAt);
  const tip = feedWords(feed, t, now);
  const working = state === 'working';
  const testId = feed.id === 'account' ? 'account-refresh' : `feed-${feed.id}-refresh`;

  return (
    <Tooltip.Root>
      <Tooltip.Trigger
        render={
          <button
            type="button"
            data-testid={testId}
            data-feed={feed.id}
            data-state={state}
            data-muted={muted}
            aria-label={sub(t.feedsRefreshOne, { feed: tip.title })}
            aria-busy={working}
            disabled={working}
            onClick={feed.request}
            className={cn(
              'inline-flex',
              'cursor-pointer',
              'items-center',
              'gap-1.5',
              'border-0',
              'border-l',
              'border-line',
              'bg-transparent',
              'px-2.5',
              'py-1',
              'first:border-l-0',
              'transition-opacity',
              'hover:opacity-100',
              'disabled:cursor-default',
              'focus-visible:rounded-sm',
              'focus-visible:[outline-style:solid]',
              'focus-visible:outline-2',
              'focus-visible:outline-offset-1',
              'focus-visible:outline-accent',
              muted && 'opacity-40',
            )}
          >
            <Ring state={state} left={left} landed={landed} />
            <span className={cn('text-[10px]', 'leading-none', 'font-semibold', 'tracking-[0.06em]', 'uppercase', state === 'late' ? 'text-warn' : 'text-muted')}>{feedName(feed.id, t)}</span>
            {state === 'refused' ? (
              <span data-testid={`feed-${feed.id}-word`} className={cn('font-mono', 'text-[10px]', 'leading-none', 'text-muted', 'opacity-70')}>
                {t.feedsRefused}
              </span>
            ) : null}
          </button>
        }
      />
      <Tooltip.Portal>
        <Tooltip.Positioner side="top" sideOffset={6}>
          <Tooltip.Popup data-testid={`feed-${feed.id}-tip`}>
            <p className="m-0 font-semibold">{tip.title}</p>
            {tip.lines.map((sentence, index) => (
              <p key={index} className="m-0">
                {sentence}
              </p>
            ))}
            {tip.action ? <p className="m-0 mt-1 text-muted">{tip.action}</p> : null}
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

/** The all-button's ring fills a quarter per step and is full while the last step runs. */
export function refreshAllFill(all: RefreshAllState): number {
  return all.running ? (all.step + 0.5) / all.total : 0;
}

export function FeedsRail({ feeds, refreshAll, all, activeTabId }: FeedsHook & { activeTabId: string }) {
  const t = useCopy();
  const relevant = feedsReadBy(activeTabId);
  const [now, setNow] = useState(() => Date.now());
  const [justFinished, setJustFinished] = useState(false);
  const wasRunning = useRef(all.running);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, CLOCK_TICK_MS);
    return () => {
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const finished = wasRunning.current && !all.running;
    wasRunning.current = all.running;
    if (!finished) return undefined;
    setJustFinished(true);
    const timer = window.setTimeout(() => {
      setJustFinished(false);
    }, LANDED_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [all.running]);

  return (
    <Tooltip.Provider delay={200} closeDelay={80}>
      <div data-testid="feeds-rail" data-running={all.running} className="flex items-center gap-2">
        {/* Muted: a feed this tab does not read, or a step the running sequence has not reached. */}
        <div className="flex items-stretch">
          {feeds.map((feed, index) => (
            <FeedItem key={feed.id} feed={feed} t={t} now={now} muted={(all.running && index > all.step) || !relevant.includes(feed.id)} />
          ))}
        </div>
        <Tooltip.Root>
          <Tooltip.Trigger
            render={
              <button
                type="button"
                aria-label={t.feedsRefreshAll}
                data-testid="feeds-refresh-all"
                disabled={all.running}
                aria-busy={all.running}
                onClick={refreshAll}
                className={cn(
                  'inline-flex',
                  'cursor-pointer',
                  'items-center',
                  'gap-1.5',
                  'rounded-sm',
                  'border',
                  'border-line',
                  'bg-transparent',
                  'px-1.5',
                  'py-0.5',
                  'text-muted',
                  'hover:border-accent',
                  'hover:text-accent',
                  'disabled:cursor-default',
                  'focus-visible:[outline-style:solid]',
                  'focus-visible:outline-2',
                  'focus-visible:outline-offset-1',
                  'focus-visible:outline-accent',
                )}
              >
                <Ring state="fresh" left={justFinished ? 1 : refreshAllFill(all)} landed={false} tone={justFinished ? 'up' : 'accent'} />
                {all.running ? (
                  <span data-testid="feeds-refresh-all-step" className="font-mono text-[11px] tabular-nums">
                    {sub(t.feedsRefreshAllStep, { step: all.step + 1, total: all.total })}
                  </span>
                ) : null}
              </button>
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
      </div>
    </Tooltip.Provider>
  );
}
