/**
 * The farm snapshot store's construction, the three user-initiated actions that move it, and the
 * hook a screen reads it through. The compute runs here so `farm-snapshot-store.ts` can stay a
 * pure reducer, the way `use-market-snapshot.ts` holds the actions for `market-store.ts`.
 *
 * `connect` wires NOTHING — no bridge subscription, no timer, no `account:changed`. That absence
 * is what makes "the board does not recompute when the live payload ticks" a property of the
 * wiring instead of a comparison someone has to keep correct: the only way an account reaches
 * the reducer is an action call, and every action call originates on the screen.
 *
 * The store's lifetime is the window's, so the snapshot survives the unmount that switching tabs
 * causes: coming back shows the board already in hand, not a recompute.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createFarmRankingMemo } from '@bombfarm/farm/core';
import type { AccountView } from '@bombfarm/contracts';
import { createLazySingleton, createSharedStore, type SharedStore } from '../shared-store';
import { useAccountView } from '../account/use-account-view';
import { buildFarmInputs, DEFAULT_FARM_CONTROLS, type FarmControls } from './farm-inputs';
import {
  accept,
  initialFarmSnapshotState,
  snapshotSourceKey,
  type FarmComputeOutcome,
  type FarmSnapshotArrival,
  type FarmSnapshotState,
} from './farm-snapshot-store';

export type { FarmSnapshotState };

export interface FarmSnapshotActions {
  /** The screen opened. A no-op when the snapshot in hand is already this account's. */
  readonly open: (view: AccountView, sourceKey: string, controls: FarmControls) => void;
  /** The player asked for the live account. Adopts it. */
  readonly refresh: (view: AccountView, sourceKey: string, controls: FarmControls) => void;
  /** A compute input changed. Recomputes against the frozen account, never a newer one. */
  readonly setControls: (controls: FarmControls) => void;
}

export function createFarmSnapshotStore(): { readonly store: SharedStore<FarmSnapshotState> } & FarmSnapshotActions {
  // One memo instance for this app — never module state, so a test taking a fresh store does not
  // inherit the previous one's warm cache.
  const memo = createFarmRankingMemo();

  /**
   * The one `AccountView` this store computes from. Replaced only by `open` and `refresh`, which
   * is what lets a controls change recompute against the same frozen account: the live view has
   * moved on several times by then, and the board must not.
   */
  let frozenView: AccountView | null = null;
  let dispatchArrival: ((arrival: FarmSnapshotArrival) => void) | null = null;

  const store = createSharedStore<FarmSnapshotState, FarmSnapshotArrival>({
    initial: initialFarmSnapshotState,
    accept,
    connect: (dispatch) => {
      dispatchArrival = dispatch;
    },
  });

  function dispatch(arrival: FarmSnapshotArrival): void {
    // Idempotent, and the only thing `start()` does here is hand back the dispatcher.
    store.start();
    dispatchArrival?.(arrival);
  }

  /** The reducer decides whether a compute is owed; this only obeys. A `begin` that found the
   *  snapshot already in hand leaves the state alone, and nothing is computed. */
  function computeIfOwed(sourceKey: string, controls: FarmControls): void {
    const state = store.getState();
    if (state.status !== 'computing') return;
    if (state.sourceKey !== sourceKey || state.controls !== controls) return;

    const view = frozenView;
    if (view === null) return;

    const inputs = buildFarmInputs(view, controls);
    const outcome: FarmComputeOutcome =
      inputs === null
        ? { ok: false, reason: 'incomplete-account' }
        : { ok: true, board: memo.rows(inputs), inputs };
    dispatch({ kind: 'computed', sourceKey, controls, outcome });
  }

  function adopt(kind: 'begin' | 'refresh', view: AccountView, sourceKey: string, controls: FarmControls): void {
    frozenView = view;
    dispatch({ kind, sourceKey, controls });
    computeIfOwed(sourceKey, controls);
  }

  return {
    store,
    open: (view, sourceKey, controls) => {
      adopt('begin', view, sourceKey, controls);
    },
    refresh: (view, sourceKey, controls) => {
      adopt('refresh', view, sourceKey, controls);
    },
    setControls: (controls) => {
      const sourceKey = snapshotSourceKey(store.getState());
      if (sourceKey === null) return;
      dispatch({ kind: 'controls', controls });
      computeIfOwed(sourceKey, controls);
    },
  };
}

const sharedFarmSnapshotStore = createLazySingleton(createFarmSnapshotStore);

export interface FarmSnapshotHook {
  readonly state: FarmSnapshotState;
  /**
   * The live account has moved past the snapshot on screen. Read-only, and read from a
   * subscription this hook holds purely to be able to answer it: knowing a snapshot is stale is
   * what lets the screen OFFER a refresh, and it never takes one.
   */
  readonly stale: boolean;
  /** Whether an account has been read at all — until it has, `open` and `refresh` do nothing. */
  readonly hasAccount: boolean;
  readonly open: (controls?: FarmControls) => void;
  readonly refresh: (controls: FarmControls) => void;
  readonly setControls: (controls: FarmControls) => void;
}

export function useFarmSnapshot(): FarmSnapshotHook {
  const account = useAccountView();

  // Seeded from the store rather than from the initial state: on a remount the board is already
  // in hand, and reading it only in the effect below would paint one committed empty frame first.
  const [state, setState] = useState<FarmSnapshotState>(() => sharedFarmSnapshotStore().store.getState());

  useEffect(() => {
    const { store } = sharedFarmSnapshotStore();

    const unsubscribe = store.subscribe(setState);
    setState(store.getState());
    store.start();

    // Unsubscribes this mount only. The snapshot itself outlives it.
    return unsubscribe;
  }, []);

  const liveView = account.status === 'loaded' ? account.view : null;
  const liveKey = account.status === 'loaded' ? account.key : null;

  const open = useCallback(
    (controls: FarmControls = DEFAULT_FARM_CONTROLS) => {
      if (liveView === null || liveKey === null) return;
      sharedFarmSnapshotStore().open(liveView, liveKey, controls);
    },
    [liveView, liveKey],
  );

  const refresh = useCallback(
    (controls: FarmControls) => {
      if (liveView === null || liveKey === null) return;
      sharedFarmSnapshotStore().refresh(liveView, liveKey, controls);
    },
    [liveView, liveKey],
  );

  const setControls = useCallback((controls: FarmControls) => {
    sharedFarmSnapshotStore().setControls(controls);
  }, []);

  const snapshotKey = snapshotSourceKey(state);
  const stale = snapshotKey !== null && liveKey !== null && snapshotKey !== liveKey;

  return useMemo(
    () => ({ state, stale, hasAccount: liveKey !== null, open, refresh, setControls }),
    [state, stale, liveKey, open, refresh, setControls],
  );
}
