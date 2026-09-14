'use client';

/**
 * The Optimizer screen — the roster gear and points planner, drawn entirely from
 * `@bombfarm/team-plan/components`. This file is the connector, the way `app/farm/farm-view.tsx`
 * is the Farm board's: nothing here is drawn that the package draws.
 *
 * Nothing here recomputes on a live tick. The inputs are built from the account as it stood when
 * the tab opened, and the only things that move it are an explicit Refresh or the tab re-opening
 * against a changed account or Farm phase — see `lib/optimizer/optimizer-snapshot-store.ts`. A
 * snapshot the live account has moved past is LABELLED and left alone; an unlabelled stale number
 * is the failure this screen exists to avoid.
 *
 * Every compute is scheduled off the paint, so the frame BEFORE it — the loading state on a first
 * open, the setup panel and scope board already in hand on a refresh — is committed and visible
 * rather than skipped over by a main thread that then blocks.
 *
 * The hand memoisation in `optimizer-screen.tsx` is load-bearing: the desktop renderer does not
 * enable the React Compiler, and a freshly-allocated prop bag reaches the plan's results section.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Banner, EmptyState, colClass } from '@bombfarm/ui';
import { scheduleAfterPaint } from '@bombfarm/farm';
import { sub, useCopy } from '../../lib/copy';
import { useAccountView } from '../../lib/account/use-account-view';
import { useAccountReadRequest } from '../../lib/account/use-account-read-request';
import { settledSnapshot } from '../../lib/optimizer/optimizer-snapshot-store';
import { useOptimizerSnapshot } from '../../lib/optimizer/use-optimizer-snapshot';
import { DEFAULT_OPTIMIZER_VIEW, loadOptimizerView, saveOptimizerView, type OptimizerView } from '../../lib/optimizer/optimizer-view-storage';
import { OptimizerScreen } from './optimizer-screen';

export function OptimizerView() {
  const t = useCopy();
  const account = useAccountView();
  const {
    state,
    planState,
    stale,
    hasAccount,
    runner,
    open,
    refresh,
    startRun,
    resolveRun,
    applyPlan,
    clearPlan,
    openHeroes,
  } = useOptimizerSnapshot();

  const [controls, setControls] = useState<OptimizerView>(DEFAULT_OPTIMIZER_VIEW);
  const [storageReady, setStorageReady] = useState(false);

  useEffect(() => {
    setControls(loadOptimizerView());
    setStorageReady(true);
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    saveOptimizerView(controls);
  }, [storageReady, controls]);

  // `open` is re-created whenever the LIVE account moves, which is every few seconds. Read
  // through a ref so the effect below is not woken by a tick it must not act on.
  const openRef = useRef(open);
  useEffect(() => {
    openRef.current = open;
  }, [open]);

  const openedRef = useRef(false);
  useEffect(() => {
    if (!storageReady || !hasAccount) return;
    if (openedRef.current) return;
    openedRef.current = true;
    scheduleAfterPaint(() => {
      openRef.current();
    });
  }, [storageReady, hasAccount]);

  // Re-solving alone would answer the press from the account the renderer already holds, which
  // the background cycle need not have moved since the snapshot last took it. So the press also
  // asks main to go and read — and re-takes the snapshot either way, because the tab can be
  // behind an account that is already committed even when no new read is allowed to start.
  const adoptLive = useCallback(() => {
    scheduleAfterPaint(() => {
      refresh();
    });
  }, [refresh]);
  const { state: readState, request: onRefresh } = useAccountReadRequest(adoptLive);

  const settled = settledSnapshot(state);
  const busy = state.status === 'computing';

  if (account.status === 'bridge-unavailable') {
    return (
      <div data-testid="optimizer-view">
        <EmptyState title={t.emptyBridgeUnavailableTitle} />
      </div>
    );
  }

  if (account.status === 'loading') {
    return (
      <div data-testid="optimizer-view">
        <EmptyState title={t.shellLoadingLabel} />
      </div>
    );
  }

  // The raw message from main is untranslatable English, so it is carried as diagnostic data
  // only and never rendered as player-facing copy — same treatment the Farm screen gives it.
  if (account.status === 'error') {
    return (
      <div data-testid="optimizer-view">
        <Banner tone="warn" title={t.errorAccountReadFailed} data-account-error-detail={account.message}>
          {t.errorAccountReadFailedDescription}
        </Banner>
      </div>
    );
  }

  if (state.status === 'unavailable') {
    return (
      <div data-testid="optimizer-view">
        <EmptyState title={t.farmUnavailableTitle} description={t.optimizerUnavailableDescription} />
      </div>
    );
  }

  // Only the FIRST compute has nothing to show. Every later one keeps the setup panel and scope
  // board it already has on screen and marks it busy below.
  if (settled === null) {
    return (
      <div data-testid="optimizer-view">
        <EmptyState title={t.shellLoadingLabel} />
      </div>
    );
  }

  return (
    <div data-testid="optimizer-view" className={colClass} aria-busy={busy}>
      {settled.leftOut.length > 0 && (
        <Banner tone="warn" title={t.optimizerLeftOutTitle} data-testid="optimizer-left-out">
          {sub(t.optimizerLeftOutBody, { heroes: settled.leftOut.map((hero) => hero.name).join(', ') })}
        </Banner>
      )}
      <OptimizerScreen
        snapshot={settled}
        controls={controls}
        setControls={setControls}
        planState={planState}
        runner={runner}
        refresh={{ stale, busy, readState, onRefresh }}
        actions={{ startRun, resolveRun, applyPlan, clearPlan, openHeroes }}
      />
    </div>
  );
}
