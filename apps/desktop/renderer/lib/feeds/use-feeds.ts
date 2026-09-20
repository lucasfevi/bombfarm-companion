'use client';

/**
 * The strip's view of the four feeds: what each was last read, what its press is doing, and the
 * press itself — plus "refresh all", which runs the four presses one after another and moves on
 * past a refusal. Sequence rather than fan-out: the account and PVP reads share the game server's
 * pacing gate, so presses fired together would only queue behind each other there.
 *
 * The account feed speaks for the screen on show when that screen computes from a copy of its
 * own (Farm, Forge, Optimizer register one): its age is that copy's, "out of date" is that copy's
 * lag behind the live account, and its press is the screen's own — adopt the live account, then
 * ask main to read. Every other screen follows the live account, so the feed falls back to the
 * live read's age and a plain read.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { UpdateStatus } from '@bombfarm/contracts';
import { oldestCaptureOf } from '../account/account-facts';
import { useAccountReadRequest } from '../account/use-account-read-request';
import { useAccountView } from '../account/use-account-view';
import { usePvpHistory } from '../pvp/use-pvp-history';
import { usePvpRefresh } from '../pvp/use-pvp-refresh';
import { useMarketSnapshot } from '../market/use-market-snapshot';
import { useScreenRefresh } from '../refresh/screen-refresh-store';
import { FEED_IDS, type FeedId } from './feed-clock';
import { useMarketCheck } from './use-market-check';
import { useUpdateCheck, type FeedPressState } from './use-update-check';

export type FeedView = {
  readonly id: FeedId;
  readonly capturedAt: string | null;
  /** The account feed only: the screen on show computed from a copy the live account has moved
   *  past. Its press recomputes as well as reads. */
  readonly outOfDate: boolean;
  /** The screen on show is recomputing — the account feed only. */
  readonly busy: boolean;
  readonly readState: FeedPressState;
  readonly request: () => void;
};

export type RefreshAllState = { readonly running: false } | { readonly running: true; readonly step: number; readonly total: number };

export type FeedsHook = {
  readonly feeds: readonly FeedView[];
  readonly refreshAll: () => void;
  readonly all: RefreshAllState;
};

function followsLiveAccount(): void {}

/** Longer than any press's own working ceiling (the account read's 10 s floor, the market check's
 *  15 s), so this fires only for a press whose state never moved at all. */
const STEP_CEILING_MS = 20_000;
const STEP_POLL_MS = 500;

/**
 * What the sequence does with the step it is on. A step is pressed once; then it waits until the
 * press has settled — its state no longer working — and moves on. A press that never started (a
 * refusal) settles at once; one that started settles when its push lands or its own ceiling
 * passes, and a press whose state never moved at all is left behind once overdue.
 */
export function sequenceDecision(readState: FeedPressState, pressed: boolean, overdue: boolean): 'press' | 'wait' | 'advance' {
  if (!pressed) return 'press';
  if (readState.kind === 'working' && !overdue) return 'wait';
  return 'advance';
}

export function useFeeds({
  activeTabId,
  updateStatus,
  onUpdateCheck,
}: {
  activeTabId: string;
  updateStatus: UpdateStatus | null;
  onUpdateCheck: () => Promise<UpdateStatus | null>;
}): FeedsHook {
  const screen = useScreenRefresh(activeTabId);
  const account = useAccountView();
  const live = account.status === 'loaded' ? account.view : null;
  const liveRead = useAccountReadRequest(followsLiveAccount);

  const pvp = usePvpHistory();
  const pvpRefresh = usePvpRefresh();

  const { state: market } = useMarketSnapshot();
  const marketCheck = useMarketCheck();

  const updateCheck = useUpdateCheck(updateStatus, onUpdateCheck);

  const feeds = useMemo<FeedView[]>(
    () => [
      screen === null
        ? {
            id: 'account',
            capturedAt: live === null ? null : oldestCaptureOf(live.payload),
            outOfDate: false,
            busy: false,
            readState: liveRead.state,
            request: liveRead.request,
          }
        : {
            id: 'account',
            capturedAt: screen.capturedAt,
            outOfDate: screen.stale,
            busy: screen.busy,
            readState: screen.readState,
            request: screen.onRefresh,
          },
      {
        id: 'pvp',
        capturedAt: pvp.status === 'ready' ? (pvp.history.standing?.capturedAt ?? null) : null,
        outOfDate: false,
        busy: false,
        readState: pvpRefresh.state,
        request: pvpRefresh.request,
      },
      {
        id: 'market',
        capturedAt: market.view?.checkedUtc ?? null,
        outOfDate: false,
        busy: false,
        readState: marketCheck.state,
        request: marketCheck.request,
      },
      {
        id: 'updates',
        capturedAt: updateStatus?.lastCheckedAt ?? null,
        outOfDate: false,
        busy: false,
        readState: updateCheck.state,
        request: updateCheck.request,
      },
    ],
    [screen, live, liveRead, pvp, pvpRefresh, market.view, marketCheck, updateStatus?.lastCheckedAt, updateCheck],
  );

  // The sequence: a step is requested once, waited on until its press settles, then the next. A
  // press whose state never moves (a check main answers at once, with nothing to push) would
  // otherwise leave the effect with nothing to wake it, so a running sequence also polls, and
  // no step outlives the ceiling however its state reads.
  const [step, setStep] = useState<number | null>(null);
  const [tick, setTick] = useState(0);
  const requestedStep = useRef<number | null>(null);
  const stepStartedAt = useRef(0);
  const feedsRef = useRef(feeds);
  feedsRef.current = feeds;

  useEffect(() => {
    if (step === null) return;
    const feed = feedsRef.current[step];
    if (feed === undefined) {
      setStep(null);
      return;
    }
    const decision = sequenceDecision(feed.readState, requestedStep.current === step, Date.now() - stepStartedAt.current > STEP_CEILING_MS);
    if (decision === 'press') {
      requestedStep.current = step;
      stepStartedAt.current = Date.now();
      feed.request();
      return;
    }
    if (decision === 'wait') return;
    setStep(step + 1 < FEED_IDS.length ? step + 1 : null);
  }, [step, feeds, tick]);

  useEffect(() => {
    if (step === null) return;
    const timer = window.setInterval(() => {
      setTick((n) => n + 1);
    }, STEP_POLL_MS);
    return () => {
      window.clearInterval(timer);
    };
  }, [step]);

  const refreshAll = useCallback(() => {
    if (step !== null) return;
    requestedStep.current = null;
    setStep(0);
  }, [step]);

  const all: RefreshAllState = step === null ? { running: false } : { running: true, step, total: FEED_IDS.length };

  return { feeds, refreshAll, all };
}
