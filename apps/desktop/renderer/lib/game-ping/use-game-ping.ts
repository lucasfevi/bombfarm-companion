/**
 * The only `gamePing:get` call site and the only `gamePing:changed` subscription — one
 * window-lifetime store, so the strip's cell keeps its number across every tab change.
 */
import { useEffect, useState } from 'react';
import { createLazySingleton, createSharedStore } from '../shared-store';
import { accept, initialGamePingState, type GamePingArrival, type GamePingState } from './game-ping-store';

type Bridge = NonNullable<Window['bfc']>;

function createGamePingStore() {
  return createSharedStore<GamePingState, GamePingArrival>({
    initial: initialGamePingState,
    accept,
    connect: (dispatch) => {
      const bridge = (window as unknown as { bfc?: Bridge }).bfc;
      if (!bridge) return;
      const issuedAt = initialGamePingState.applied;
      bridge
        .invoke('gamePing:get')
        .then((view) => {
          dispatch({ kind: 'fetched', view, issuedAt });
        })
        .catch(() => undefined);
      bridge.on('gamePing:changed', (view) => {
        dispatch({ kind: 'pushed', view });
      });
    },
  });
}

const sharedStore = createLazySingleton(createGamePingStore);

/** `null` until a check lands, and whenever the last one failed. */
export function useGamePing(): number | null {
  const [state, setState] = useState<GamePingState>(() => sharedStore().getState());
  useEffect(() => {
    const store = sharedStore();
    const unsubscribe = store.subscribe(setState);
    setState(store.getState());
    store.start();
    return unsubscribe;
  }, []);
  return state.view.latencyMs;
}
