/**
 * The only `onlinePlayers:get` call site and the only `onlinePlayers:changed` subscription — one
 * window-lifetime store, so the strip's cell keeps its number across every tab change.
 */
import { useEffect, useState } from 'react';
import type { OnlinePlayersReading } from '@bombfarm/contracts';
import { createLazySingleton, createSharedStore } from '../shared-store';
import { accept, initialOnlinePlayersState, type OnlinePlayersArrival, type OnlinePlayersState } from './online-players-store';

type Bridge = NonNullable<Window['bfc']>;

function createOnlinePlayersStore() {
  return createSharedStore<OnlinePlayersState, OnlinePlayersArrival>({
    initial: initialOnlinePlayersState,
    accept,
    connect: (dispatch) => {
      const bridge = (window as unknown as { bfc?: Bridge }).bfc;
      if (!bridge) return;
      const issuedAt = initialOnlinePlayersState.applied;
      bridge
        .invoke('onlinePlayers:get')
        .then((view) => {
          dispatch({ kind: 'fetched', view, issuedAt });
        })
        .catch(() => undefined);
      bridge.on('onlinePlayers:changed', (view) => {
        dispatch({ kind: 'pushed', view });
      });
    },
  });
}

const sharedStore = createLazySingleton(createOnlinePlayersStore);

/** `null` until a fresh reading is in hand — the cell draws nothing rather than a zero. */
export function useOnlinePlayers(): OnlinePlayersReading | null {
  const [state, setState] = useState<OnlinePlayersState>(() => sharedStore().getState());
  useEffect(() => {
    const store = sharedStore();
    const unsubscribe = store.subscribe(setState);
    setState(store.getState());
    store.start();
    return unsubscribe;
  }, []);
  return state.view.reading;
}
