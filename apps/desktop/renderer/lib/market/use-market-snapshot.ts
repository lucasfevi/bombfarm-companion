/**
 * The only `market:getSnapshot` call site and the only `market:changed` subscription site — the
 * shape `use-account-view.ts` established: a store whose lifetime is the window's, one `useState`,
 * one `useEffect`, every arrival folded through the pure reducer in `market-store.ts`.
 */
import { useEffect, useMemo, useState } from 'react';
import type { MarketQuoteResult, MarketQuoteTarget } from '@bombfarm/contracts';
import type { MarketSnapshot } from '@bombfarm/pricing';
import { createLazySingleton, createSharedStore, type SharedStore } from '../shared-store';
import { accept, initialMarketState, quoteTargetId } from './market-store';
import type { MarketArrival, MarketState, MarketView } from './market-store';

export type { MarketState, MarketView };

type Bridge = NonNullable<Window['bfc']>;

/**
 * Main validates every snapshot body with `isMarketSnapshot` before it crosses the bridge, so the
 * narrowing here has a runtime witness on the other side. It cannot be expressed as a type: the
 * snapshot's structural type lives in the pricing package, which depends on the contracts package
 * the channel is declared in, so the channel leaves the body opaque.
 */
function asMarketView(view: unknown): MarketView {
  return view as MarketView;
}

/**
 * Coalesces concurrent refreshes of the same item into one in-flight call. A per-item refresh is
 * one request to a rate-limited endpoint, so two components asking for the same item at once must
 * not become two requests.
 */
export function createQuoteRefresher(bridge: Bridge) {
  const inFlight = new Map<string, Promise<MarketQuoteResult>>();
  return {
    refresh(target: MarketQuoteTarget): Promise<MarketQuoteResult> {
      const id = quoteTargetId(target);
      const existing = inFlight.get(id);
      if (existing) return existing;

      const pending = bridge.invoke('market:refreshItem', target).finally(() => {
        inFlight.delete(id);
      });
      inFlight.set(id, pending);
      return pending;
    },
  };
}

export interface MarketSnapshotHook {
  state: MarketState;
  snapshot: MarketSnapshot | null;
  /** A property, not a method: it is a `useCallback` arrow, and callers destructure it. */
  refreshItem: (target: MarketQuoteTarget) => Promise<MarketQuoteResult>;
}

/** The refresher is built by `connect` and read back through here, so the in-flight map that
 *  coalesces duplicate quote requests is shared by every caller for as long as the window lives —
 *  one per mount would let two screens ask the rate-limited endpoint for the same item at once. */
export function createMarketSnapshotStore(): {
  readonly store: SharedStore<MarketState>;
  readonly refresh: (target: MarketQuoteTarget) => Promise<MarketQuoteResult>;
} {
  let refresher: ReturnType<typeof createQuoteRefresher> | null = null;

  const store = createSharedStore<MarketState, MarketArrival>({
    initial: initialMarketState,
    accept,
    connect: (dispatch) => {
      const bridge = (window as unknown as { bfc?: Bridge }).bfc;
      if (!bridge) {
        dispatch({ kind: 'bridge-missing' });
        return;
      }

      refresher = createQuoteRefresher(bridge);
      const issuedAt = initialMarketState.applied;

      bridge
        .invoke('market:getSnapshot')
        .then((view) => {
          dispatch({ kind: 'fetched', view: asMarketView(view), issuedAt });
        })
        .catch(() => {
          dispatch({ kind: 'fetch-failed', issuedAt });
        });

      // Never unsubscribed: prices merged while the player is on another tab are still on screen
      // when they come back, with no second `market:getSnapshot` to wait through.
      bridge.on('market:changed', (view) => {
        dispatch({ kind: 'pushed', view: asMarketView(view) });
      });
    },
  });

  return {
    store,
    refresh: (target) =>
      refresher?.refresh(target) ??
      Promise.resolve({
        ok: false as const,
        key: null,
        hashName: null,
        reason: 'network' as const,
        keptAmount: null,
        at: new Date().toISOString(),
      }),
  };
}

const sharedMarketSnapshotStore = createLazySingleton(createMarketSnapshotStore);

/** Module scope, so it is the same reference on every render and never re-triggers a consumer's
 *  memo — what the removed `useCallback` over a `useState`-held refresher was buying. */
function refreshItem(target: MarketQuoteTarget): Promise<MarketQuoteResult> {
  return sharedMarketSnapshotStore().refresh(target);
}

export function useMarketSnapshot(): MarketSnapshotHook {
  const [state, setState] = useState<MarketState>(() => sharedMarketSnapshotStore().store.getState());

  useEffect(() => {
    const { store } = sharedMarketSnapshotStore();

    const unsubscribe = store.subscribe(setState);
    setState(store.getState());
    store.start();

    return unsubscribe;
  }, []);

  return useMemo(
    () => ({ state, snapshot: state.status === 'ready' ? state.view.snapshot : null, refreshItem }),
    [state],
  );
}
