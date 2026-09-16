/**
 * The only `pvp:history` call site and the only `pvp:changed` subscription site — the shape
 * `use-market-snapshot.ts` established: a store whose lifetime is the window's, so a duel that
 * settles while the player is on another tab is already on the list when they come back.
 */
import { useEffect, useState } from 'react';
import { createLazySingleton, createSharedStore, type SharedStore } from '../shared-store';
import { accept, initialPvpHistoryState, type PvpHistoryArrival, type PvpHistoryState } from './pvp-history-store';

export type { PvpHistoryState };

type Bridge = NonNullable<Window['bfc']>;

export function createPvpHistoryStore(bridgeOf: () => Bridge | null): SharedStore<PvpHistoryState> {
  return createSharedStore<PvpHistoryState, PvpHistoryArrival>({
    initial: initialPvpHistoryState,
    accept,
    connect: (dispatch) => {
      const bridge = bridgeOf();
      if (!bridge) {
        dispatch({ kind: 'bridge-missing' });
        return;
      }
      const issuedAt = initialPvpHistoryState.applied;
      bridge
        .invoke('pvp:history')
        .then((history) => {
          dispatch({ kind: 'fetched', history, issuedAt });
        })
        .catch(() => {
          dispatch({ kind: 'fetch-failed', issuedAt });
        });
      bridge.on('pvp:changed', (history) => {
        dispatch({ kind: 'pushed', history });
      });
    },
  });
}

function windowBridge(): Bridge | null {
  if (typeof window === 'undefined') return null;
  return (window as unknown as { bfc?: Bridge }).bfc ?? null;
}

const sharedPvpHistoryStore = createLazySingleton(() => createPvpHistoryStore(windowBridge));

export function usePvpHistory(): PvpHistoryState {
  const [state, setState] = useState<PvpHistoryState>(() => sharedPvpHistoryStore().getState());

  useEffect(() => {
    const store = sharedPvpHistoryStore();
    const unsubscribe = store.subscribe(setState);
    setState(store.getState());
    store.start();
    return unsubscribe;
  }, []);

  return state;
}
