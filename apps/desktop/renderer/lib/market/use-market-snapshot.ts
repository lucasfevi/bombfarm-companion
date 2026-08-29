/**
 * The only `market:getSnapshot` call site and the only `market:changed` subscription site — the
 * shape `use-account-view.ts` established: one `useState`, one `useEffect`, every arrival folded
 * through the pure reducer in `market-store.ts`.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { MarketQuoteResult, MarketQuoteTarget } from '@bombfarm/contracts';
import type { MarketSnapshot } from '@bombfarm/pricing';
import { accept, initialMarketState, quoteTargetId } from './market-store';
import type { MarketState, MarketView } from './market-store';

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

export function useMarketSnapshot(): MarketSnapshotHook {
  const [state, setState] = useState<MarketState>(initialMarketState);
  const [refresher, setRefresher] = useState<ReturnType<typeof createQuoteRefresher> | null>(null);

  useEffect(() => {
    const bridge = (window as unknown as { bfc?: Bridge }).bfc;
    if (!bridge) {
      setState((prev) => accept(prev, { kind: 'bridge-missing' }));
      return;
    }

    let cancelled = false;
    setRefresher(createQuoteRefresher(bridge));
    const issuedAt = initialMarketState.applied;

    bridge
      .invoke('market:getSnapshot')
      .then((view) => {
        if (!cancelled) setState((prev) => accept(prev, { kind: 'fetched', view: asMarketView(view), issuedAt }));
      })
      .catch(() => {
        if (!cancelled) setState((prev) => accept(prev, { kind: 'fetch-failed', issuedAt }));
      });

    const unsubscribe = bridge.on('market:changed', (view) => {
      if (!cancelled) setState((prev) => accept(prev, { kind: 'pushed', view: asMarketView(view) }));
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const refreshItem = useCallback(
    (target: MarketQuoteTarget): Promise<MarketQuoteResult> =>
      refresher?.refresh(target) ??
      Promise.resolve({
        ok: false as const,
        key: null,
        hashName: null,
        reason: 'network' as const,
        keptAmount: null,
        at: new Date().toISOString(),
      }),
    [refresher],
  );

  return useMemo(
    () => ({ state, snapshot: state.status === 'ready' ? state.view.snapshot : null, refreshItem }),
    [state, refreshItem],
  );
}
