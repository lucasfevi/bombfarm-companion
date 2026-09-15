/**
 * The optimizer snapshot store's construction, the actions, and the hook a screen reads it
 * through — the Farm hook's own shape (`use-farm-snapshot.ts`), plus the package runner and the
 * plan reducer beside the snapshot reducer, because a run must survive a tab switch the same way
 * the Forge run does.
 *
 * `connect` wires NOTHING — no bridge subscription, no timer, no `account:changed`. That absence
 * is what makes "the snapshot does not recompute when the live payload ticks" a property of the
 * wiring instead of a comparison someone has to keep correct: the only way an account reaches
 * either reducer is an action call, and every action call originates on the screen.
 *
 * The store's lifetime is the window's, so the snapshot and any plan survive the unmount that
 * switching tabs causes: coming back shows them already in hand, not a recompute and not a lost
 * run. The runner is exposed as-is and never subscribed to here — the package screen's own
 * toolbar effect is the one place that turns runner state into lifecycle dispatches (D-19); a
 * second observer here would be a second applier.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createTeamPlanRunner, type TeamPlanRunnerHandle, type TeamPlanRunStatus } from '@bombfarm/team-plan/runner';
import type { TeamPlan } from '@bombfarm/domain/team-plan/types';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import type { AccountView } from '@bombfarm/contracts';
import { createLazySingleton, createSharedStore, type SharedStore } from '../shared-store';
import { useAccountView } from '../account/use-account-view';
import { oldestCaptureOf } from '../account/account-facts';
import { loadFarmView } from '../farm/farm-view-storage';
import { buildOptimizerInputs, optimizerDepKey } from './optimizer-inputs';
import { createOptimizerWorker } from './optimizer-worker';
import {
  acceptOptimizer,
  initialOptimizerSnapshotState,
  settledSnapshot,
  type OptimizerComputeOutcome,
  type OptimizerSnapshotArrival,
  type OptimizerSnapshotState,
} from './optimizer-snapshot-store';
import { acceptPlan, initialOptimizerPlanState, type OptimizerPlanArrival, type OptimizerPlanState } from './optimizer-plan-store';

export type { OptimizerSnapshotState, OptimizerPlanState };

export interface OptimizerSnapshotActions {
  /** The tab opened. A no-op when the snapshot in hand would be rebuilt unchanged — see
   *  {@link openOwesSnapshot}. */
  readonly open: (view: AccountView, sourceKey: string, farmChosenPhase: number | null) => void;
  /** The player asked for the live account. Adopts it. */
  readonly refresh: (view: AccountView, sourceKey: string, farmChosenPhase: number | null) => void;
  readonly startRun: (runId: string, signature: string, heroes: readonly HeroRecord[]) => void;
  readonly resolveRun: (runId: string, status: Exclude<TeamPlanRunStatus, 'running'>) => void;
  readonly applyPlan: (runId: string, plan: TeamPlan) => void;
  readonly clearPlan: () => void;
  readonly openHeroes: (heroIds: readonly string[]) => void;
}

export function createOptimizerStore(): {
  readonly store: SharedStore<OptimizerSnapshotState>;
  readonly planStore: SharedStore<OptimizerPlanState>;
  readonly runner: TeamPlanRunnerHandle;
} & OptimizerSnapshotActions {
  /** The one `AccountView` this store computes from. Replaced only by `open` and `refresh`. */
  let frozenView: AccountView | null = null;
  let dispatchArrival: ((arrival: OptimizerSnapshotArrival) => void) | null = null;

  const store = createSharedStore<OptimizerSnapshotState, OptimizerSnapshotArrival>({
    initial: initialOptimizerSnapshotState,
    accept: acceptOptimizer,
    connect: (dispatch) => {
      dispatchArrival = dispatch;
    },
  });

  let dispatchPlanArrival: ((arrival: OptimizerPlanArrival) => void) | null = null;

  const planStore = createSharedStore<OptimizerPlanState, OptimizerPlanArrival>({
    initial: initialOptimizerPlanState,
    accept: acceptPlan,
    connect: (dispatch) => {
      dispatchPlanArrival = dispatch;
    },
  });

  // The window-lifetime singleton the package screen subscribes to instead of creating its own,
  // so a solve survives the screen unmounting (D-2). The desktop calls `runner.run` nowhere —
  // the package's own toolbar does, on the Optimize press.
  const runner = createTeamPlanRunner({ createWorker: createOptimizerWorker });

  function dispatch(arrival: OptimizerSnapshotArrival): void {
    store.start();
    dispatchArrival?.(arrival);
  }

  function dispatchPlan(arrival: OptimizerPlanArrival): void {
    planStore.start();
    dispatchPlanArrival?.(arrival);
  }

  /** The reducer decides whether a compute is owed; this only obeys. */
  function computeIfOwed(sourceKey: string, farmChosenPhase: number | null): void {
    const state = store.getState();
    if (state.status !== 'computing') return;
    if (state.sourceKey !== sourceKey || state.farmChosenPhase !== farmChosenPhase) return;

    const view = frozenView;
    if (view === null) return;

    const built = buildOptimizerInputs(view, farmChosenPhase);
    const outcome: OptimizerComputeOutcome =
      built === null
        ? { ok: false, reason: 'incomplete-account' }
        : { ok: true, inputs: built.inputs, leftOut: built.leftOut, capturedAt: oldestCaptureOf(view.payload) };
    dispatch({ kind: 'computed', sourceKey, farmChosenPhase, outcome });
  }

  function adopt(
    kind: 'begin' | 'refresh',
    view: AccountView,
    sourceKey: string,
    farmChosenPhase: number | null,
  ): void {
    frozenView = view;
    dispatch({ kind, sourceKey, farmChosenPhase });
    computeIfOwed(sourceKey, farmChosenPhase);
  }

  return {
    store,
    planStore,
    runner,
    open: (view, sourceKey, farmChosenPhase) => {
      if (!openOwesSnapshot(store.getState(), view, farmChosenPhase)) return;
      adopt('begin', view, sourceKey, farmChosenPhase);
    },
    refresh: (view, sourceKey, farmChosenPhase) => {
      adopt('refresh', view, sourceKey, farmChosenPhase);
    },
    startRun: (runId, signature, heroes) => {
      dispatchPlan({ kind: 'startRun', runId, signature, heroes });
    },
    resolveRun: (runId, status) => {
      dispatchPlan({ kind: 'resolveRun', runId, status });
    },
    applyPlan: (runId, plan) => {
      dispatchPlan({ kind: 'applyPlan', runId, plan });
    },
    clearPlan: () => {
      dispatchPlan({ kind: 'clearPlan' });
    },
    openHeroes: (heroIds) => {
      dispatchPlan({ kind: 'openHeroes', heroIds });
    },
  };
}

const sharedOptimizerStore = createLazySingleton(createOptimizerStore);

/**
 * A sentinel dep key no real `TeamPlanInputs` can produce (`canonicalStringify` never emits a
 * bare string), so a live account that can no longer produce inputs at all reads as staler than
 * the settled snapshot rather than as impossible to compare.
 */
const LIVE_ACCOUNT_INCOMPLETE = '"live-account-incomplete"';

/**
 * Whether the live account would give different inputs than the snapshot on screen — compared
 * over `optimizerDepKey`, which strips `farmChosenPhase` (D-4): a Farm phase change alone must
 * not read as "the account moved", it reaches the plan through the package signature instead.
 * The live record is built with the SNAPSHOT's own `farmChosenPhase`, for the same reason.
 *
 * Pure and exported so the rule is testable: this project's Vitest run never mounts the hook.
 */
export function optimizerSnapshotStale(state: OptimizerSnapshotState, liveView: AccountView | null): boolean {
  const settled = settledSnapshot(state);
  if (settled === null || liveView === null) return false;
  const live = buildOptimizerInputs(liveView, settled.inputs.farmChosenPhase);
  const liveDepKey = live === null ? LIVE_ACCOUNT_INCOMPLETE : optimizerDepKey(live.inputs);
  return optimizerDepKey(settled.inputs) !== liveDepKey;
}

/**
 * Whether opening the tab should re-take the snapshot. The account key behind `begin` moves with
 * every wallet tick, so keyed on it alone a re-open almost always recomputed — and repainted every
 * row with the same numbers. A settled snapshot at the wanted Farm phase is re-taken only when
 * the live account would actually give different inputs ({@link optimizerSnapshotStale}); any
 * other state is left to the reducer's own rule.
 */
export function openOwesSnapshot(
  state: OptimizerSnapshotState,
  liveView: AccountView,
  farmChosenPhase: number | null,
): boolean {
  if (state.status !== 'ready') return true;
  if (state.farmChosenPhase !== farmChosenPhase) return true;
  return optimizerSnapshotStale(state, liveView);
}

export interface OptimizerSnapshotHook {
  readonly state: OptimizerSnapshotState;
  readonly planState: OptimizerPlanState;
  /** The live account would give different inputs than the snapshot on screen — see
   *  {@link optimizerSnapshotStale}. Read-only: knowing the snapshot is stale is what lets the
   *  refresh control OFFER a refresh, and it never takes one. */
  readonly stale: boolean;
  /** Whether an account has been read at all — until it has, `open` and `refresh` do nothing. */
  readonly hasAccount: boolean;
  readonly runner: TeamPlanRunnerHandle;
  readonly open: () => void;
  readonly refresh: () => void;
  readonly startRun: (runId: string, signature: string, heroes: readonly HeroRecord[]) => void;
  readonly resolveRun: (runId: string, status: Exclude<TeamPlanRunStatus, 'running'>) => void;
  readonly applyPlan: (runId: string, plan: TeamPlan) => void;
  readonly clearPlan: () => void;
  readonly openHeroes: (heroIds: readonly string[]) => void;
}

export function useOptimizerSnapshot(): OptimizerSnapshotHook {
  const account = useAccountView();

  // Seeded from the store rather than from the initial state: on a remount the snapshot (and any
  // plan) is already in hand, and reading it only in the effect below would paint one committed
  // empty frame first.
  const [state, setState] = useState<OptimizerSnapshotState>(() => sharedOptimizerStore().store.getState());
  const [planState, setPlanState] = useState<OptimizerPlanState>(() =>
    sharedOptimizerStore().planStore.getState(),
  );

  useEffect(() => {
    const { store, planStore } = sharedOptimizerStore();

    const unsubscribe = store.subscribe(setState);
    const unsubscribePlan = planStore.subscribe(setPlanState);
    setState(store.getState());
    setPlanState(planStore.getState());
    store.start();
    planStore.start();

    // Unsubscribes this mount only. The snapshot and the plan outlive it.
    return () => {
      unsubscribe();
      unsubscribePlan();
    };
  }, []);

  const liveView = account.status === 'loaded' ? account.view : null;
  const liveKey = account.status === 'loaded' ? account.key : null;

  const open = useCallback(() => {
    if (liveView === null || liveKey === null) return;
    sharedOptimizerStore().open(liveView, liveKey, loadFarmView().selectedPhase);
  }, [liveView, liveKey]);

  const refresh = useCallback(() => {
    if (liveView === null || liveKey === null) return;
    sharedOptimizerStore().refresh(liveView, liveKey, loadFarmView().selectedPhase);
  }, [liveView, liveKey]);

  const startRun = useCallback((runId: string, signature: string, heroes: readonly HeroRecord[]) => {
    sharedOptimizerStore().startRun(runId, signature, heroes);
  }, []);

  const resolveRun = useCallback((runId: string, status: Exclude<TeamPlanRunStatus, 'running'>) => {
    sharedOptimizerStore().resolveRun(runId, status);
  }, []);

  const applyPlan = useCallback((runId: string, plan: TeamPlan) => {
    sharedOptimizerStore().applyPlan(runId, plan);
  }, []);

  const clearPlan = useCallback(() => {
    sharedOptimizerStore().clearPlan();
  }, []);

  const openHeroes = useCallback((heroIds: readonly string[]) => {
    sharedOptimizerStore().openHeroes(heroIds);
  }, []);

  const stale = useMemo(() => optimizerSnapshotStale(state, liveView), [state, liveView]);

  return useMemo(
    () => ({
      state,
      planState,
      stale,
      hasAccount: liveKey !== null,
      runner: sharedOptimizerStore().runner,
      open,
      refresh,
      startRun,
      resolveRun,
      applyPlan,
      clearPlan,
      openHeroes,
    }),
    [state, planState, stale, liveKey, open, refresh, startRun, resolveRun, applyPlan, clearPlan, openHeroes],
  );
}
