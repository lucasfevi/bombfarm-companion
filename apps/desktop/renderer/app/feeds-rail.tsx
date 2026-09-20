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
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { cn, Tooltip } from '@bombfarm/ui';
import { sub, useCopy, type Copy } from '../lib/copy';
import { accountReadRefusalText } from '../lib/account-read-labels';
import type { FeedRefusal } from '../lib/feeds/use-update-check';
import { formatAge, formatCapturedAt } from '../lib/format';
import { FEED_CYCLE_MS, feedAgeMs, feedMeter, feedNextInMs, feedsReadBy, type FeedId } from '../lib/feeds/feed-clock';
import type { FeedView, FeedsHook, RefreshAllState } from '../lib/feeds/use-feeds';

/** The tooltip's countdown ticks only while the tooltip is open; the rail itself never ticks. */
const TIP_TICK_MS = 1_000;
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

/**
 * The tooltip: the feed's name, with where it stands at the top right ("Last read 2m ago",
 * "Not read yet", "Reading now…"); what the feed is; a note when something is wrong — the screen
 * computed from an older copy, or why a press was refused; and, muted and last, what a click does
 * with the countdown to the next automatic read beside it — no countdown for a feed with no
 * clock, no click line while a read runs.
 */
export type FeedTip = {
  title: string;
  status: string;
  what: string;
  note: string | null;
  action: string | null;
  /** "next in 37s", "due now", or nothing: the countdown beside the click line. */
  next: string | null;
};

function feedRefusalText(reason: FeedRefusal, t: Copy): string {
  switch (reason) {
    case 'updates_off':
      return t.feedsUpdatesOff;
    case 'updates_busy':
      return t.feedsUpdatesBusy;
    default:
      return accountReadRefusalText(reason, t);
  }
}

export function feedWords(feed: FeedView, t: Copy, now: number): FeedTip {
  const ageMs = feedAgeMs(feed.capturedAt, now);
  const working = feed.busy || feed.readState.kind === 'working';
  const status = working ? t.feedsReadingNow : feed.capturedAt === null ? t.feedsNeverRead : sub(t.feedsLastRead, { age: formatCapturedAt(feed.capturedAt, t, now) });
  const cycle = cycleText(feed.id, t);
  const what = cycle === null ? `${feedWhat(feed.id, t)} · ${t.feedsNoClock}` : `${feedWhat(feed.id, t)} · ${sub(t.feedsEvery, { cycle })}`;
  const note = feed.outOfDate ? t.feedsOutOfDate : feed.readState.kind === 'refused' ? feedRefusalText(feed.readState.reason, t) : null;
  const nextIn = feedNextInMs(feed.id, ageMs);
  const next = nextIn === null ? null : nextIn === 0 ? t.feedsNextDue : sub(t.feedsNextIn, { age: formatAge(nextIn, t) });
  return { title: feedName(feed.id, t), status, what, note, action: working ? null : t.feedsClickToUpdate, next };
}

/** How the arc moves. A feed's ring drains on the browser's own clock — the animation runs the
 *  feed's whole cycle, started `spentMs` in — so the rail renders once per read and never ticks.
 *  The all-button's ring steps, so it transitions between the values it is handed. */
type ArcMotion = { kind: 'drain'; cycleMs: number; spentMs: number } | { kind: 'step' };

function arcStyle(motion: ArcMotion, left: number): CSSProperties {
  if (motion.kind === 'step') return { strokeDashoffset: RING_C * (1 - left) };
  return {
    ['--feed-ring-circumference' as string]: String(RING_C),
    animationName: 'feed-drain',
    animationDuration: `${String(motion.cycleMs)}ms`,
    animationDelay: `-${String(motion.spentMs)}ms`,
    animationTimingFunction: 'linear',
    animationFillMode: 'forwards',
  };
}

function Ring({ state, left, landed, tone, motion }: { state: RingState; left: number | null; landed: boolean; tone?: 'accent' | 'up'; motion: ArcMotion }) {
  const arcClass = state === 'late' ? 'stroke-warn' : state === 'refused' ? 'stroke-line' : tone === 'accent' ? 'stroke-accent' : tone === 'up' ? 'stroke-up' : 'stroke-muted';
  const centre = state === 'late' ? { r: 2.5, className: 'fill-warn' } : landed ? { r: 2, className: 'fill-up' } : null;
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
          className={cn('fill-none', arcClass, motion.kind === 'step' && 'transition-[stroke-dashoffset]', 'duration-1000', 'ease-linear')}
          strokeWidth="2.2"
          strokeDasharray={RING_C}
          style={arcStyle(motion, left ?? 1)}
          transform="rotate(-90 8 8)"
        />
      )}
      {centre ? <circle cx="8" cy="8" r={centre.r} className={centre.className} /> : null}
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

/** The ring's drain, from the feed's clock and the age already spent; a step for a feed with
 *  no arc to drain. */
export function ringMotion(feed: FeedView, now: number): ArcMotion {
  const cycleMs = FEED_CYCLE_MS[feed.id];
  const ageMs = feedAgeMs(feed.capturedAt, now);
  if (cycleMs === null || ageMs === null) return { kind: 'step' };
  return { kind: 'drain', cycleMs, spentMs: Math.min(ageMs, cycleMs) };
}

/** The tooltip's words, re-read every second for as long as the tooltip is open — a closed
 *  tooltip is not mounted, so nothing ticks at rest. */
function FeedTipBody({ feed, t }: { feed: FeedView; t: Copy }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, TIP_TICK_MS);
    return () => {
      window.clearInterval(timer);
    };
  }, []);
  const tip = feedWords(feed, t, now);
  return (
    <>
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-[13px] font-semibold text-ink">{tip.title}</span>
        <span data-testid={`feed-${feed.id}-tip-status`} className="text-[11px] text-muted">
          {tip.status}
        </span>
      </div>
      {tip.action ? (
        <p className="m-0 text-[11px] text-muted">
          {tip.action}
          {tip.next ? (
            <span className={cn('font-mono', 'tabular-nums')}>
              {' · '}
              {tip.next}
            </span>
          ) : null}
        </p>
      ) : null}
      <p className="m-0 mt-1.5">{tip.what}</p>
      {tip.note ? <p className={cn('m-0', 'mt-1', feed.outOfDate ? 'text-warn' : 'text-muted')}>{tip.note}</p> : null}
    </>
  );
}

function FeedItem({ feed, t, muted }: { feed: FeedView; t: Copy; muted: boolean }) {
  // Read once per render, and the item renders only when the feed moves: the ring's drain from
  // here on is the browser's, and the tooltip keeps its own clock while open.
  const now = Date.now();
  const { state, left } = ringGeometry(feed, now);
  const landed = useLanded(feed.capturedAt);
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
            aria-label={sub(t.feedsRefreshOne, { feed: feedName(feed.id, t) })}
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
            <Ring state={state} left={left} landed={landed} motion={ringMotion(feed, now)} />
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
          <Tooltip.Popup data-testid={`feed-${feed.id}-tip`} className="min-w-64">
            <FeedTipBody feed={feed} t={t} />
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
  const [justFinished, setJustFinished] = useState(false);
  const wasRunning = useRef(all.running);

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
            <FeedItem key={feed.id} feed={feed} t={t} muted={(all.running && index > all.step) || !relevant.includes(feed.id)} />
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
                <Ring state="fresh" left={justFinished ? 1 : refreshAllFill(all)} landed={false} tone={justFinished ? 'up' : 'accent'} motion={{ kind: 'step' }} />
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
