/**
 * The only `collections:get` call site and the only `collections:changed` subscription site: a
 * store whose lifetime is the window's, so a read that lands while the player is on another tab is
 * already on the screen when they come back.
 */
import { useEffect, useState } from 'react';
import { createLazySingleton, createSharedStore, type SharedStore } from '../shared-store';
import { accept, initialCollectionsState, type CollectionsArrival, type CollectionsState } from './collections-store';

export type { CollectionsState };

type Bridge = NonNullable<Window['bfc']>;

export function createCollectionsStore(bridgeOf: () => Bridge | null): SharedStore<CollectionsState> {
  return createSharedStore<CollectionsState, CollectionsArrival>({
    initial: initialCollectionsState,
    accept,
    connect: (dispatch) => {
      const bridge = bridgeOf();
      if (!bridge) {
        dispatch({ kind: 'bridge-missing' });
        return;
      }
      const issuedAt = initialCollectionsState.applied;
      bridge
        .invoke('collections:get')
        .then((view) => {
          dispatch({ kind: 'fetched', view, issuedAt });
        })
        .catch(() => {
          dispatch({ kind: 'fetch-failed', issuedAt });
        });
      bridge.on('collections:changed', (view) => {
        dispatch({ kind: 'pushed', view });
      });
    },
  });
}

function windowBridge(): Bridge | null {
  if (typeof window === 'undefined') return null;
  return (window as unknown as { bfc?: Bridge }).bfc ?? null;
}

/** Asks main to read the collections now — the tab calls it on open. What the read finds arrives
 *  on `collections:changed` like everything else; a refusal (no game, no consent, too soon) is
 *  main's to log, and the screen keeps showing what it last held. */
export function refreshCollections(): void {
  const bridge = windowBridge();
  if (!bridge) return;
  void bridge.invoke('collections:refresh').catch(() => undefined);
}

const sharedCollectionsStore = createLazySingleton(() => createCollectionsStore(windowBridge));

export function useCollections(): CollectionsState {
  const [state, setState] = useState<CollectionsState>(() => sharedCollectionsStore().getState());

  useEffect(() => {
    const store = sharedCollectionsStore();
    const unsubscribe = store.subscribe(setState);
    setState(store.getState());
    store.start();
    return unsubscribe;
  }, []);

  return state;
}
