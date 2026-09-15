/**
 * The run as the screen sees it, held for the window rather than for one mount of the screen.
 * The shell unmounts a tab the player leaves, and a `useReducer` in the view went with it: a
 * glance at another screen mid-run came back to an empty rail, with every step main had pushed in
 * between dropped, and a run that finished while the player was away was never seen to finish.
 * The `forge:event` subscription lives here, in `connect`, so the climb keeps folding while
 * nothing is displaying it — the same lifetime the account and market stores already have.
 */
import { useEffect, useState } from 'react';
import type { ForgeEvent } from '@bombfarm/contracts';
import { createLazySingleton, createSharedStore } from '../shared-store';
import { forgeRunReducer, IDLE_FORGE_RUN, type ForgeRunAction, type ForgeRunAdoption, type ForgeRunState } from './forge-run-reducer';

type Bridge = NonNullable<Window['bfc']>;

export interface ForgeRunStore {
  readonly getState: () => ForgeRunState;
  readonly subscribe: (listener: (state: ForgeRunState) => void) => () => void;
  readonly start: () => void;
  readonly dispatch: (action: ForgeRunAction) => void;
  /** The piece on screen and its plan, read at the moment a step arrives so a run this screen did
   *  not start can adopt the figures the plan panel printed for it. */
  readonly setAdoption: (adoption: ForgeRunAdoption | null) => void;
}

export function createForgeRunStore(bridge: Bridge | null): ForgeRunStore {
  let adoption: ForgeRunAdoption | null = null;
  let send: ((action: ForgeRunAction) => void) | null = null;

  const store = createSharedStore<ForgeRunState, ForgeRunAction>({
    initial: IDLE_FORGE_RUN,
    accept: forgeRunReducer,
    connect: (dispatch) => {
      send = dispatch;
      if (!bridge) return;
      bridge.on('forge:event', (event: ForgeEvent) => {
        if (event.type === 'done') dispatch({ kind: 'done', event });
        else if (event.type === 'pause') dispatch({ kind: 'pause', event });
        else dispatch({ kind: 'step', event, adopt: adoption });
      });
    },
  });

  return {
    getState: () => store.getState(),
    subscribe: (listener) => store.subscribe(listener),
    start: () => {
      store.start();
    },
    dispatch: (action) => {
      store.start();
      send?.(action);
    },
    setAdoption: (next) => {
      adoption = next;
    },
  };
}

const sharedForgeRunStore = createLazySingleton(() =>
  createForgeRunStore(typeof window === 'undefined' ? null : ((window as unknown as { bfc?: Bridge }).bfc ?? null)),
);

export function useForgeRun(): ForgeRunState {
  const [state, setState] = useState<ForgeRunState>(() => sharedForgeRunStore().getState());

  useEffect(() => {
    const store = sharedForgeRunStore();
    const unsubscribe = store.subscribe(setState);
    setState(store.getState());
    store.start();
    return unsubscribe;
  }, []);

  return state;
}

export function dispatchForgeRun(action: ForgeRunAction): void {
  sharedForgeRunStore().dispatch(action);
}

export function setForgeRunAdoption(adoption: ForgeRunAdoption | null): void {
  sharedForgeRunStore().setAdoption(adoption);
}
