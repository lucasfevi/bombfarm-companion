/**
 * Held for the window, not one mount of the page: the shell unmounts a tab the player leaves, and
 * a result that arrived meanwhile would never be seen. The Burn button is off while the queue
 * runs, so pausing it here covers only the race where it starts between render and confirm.
 */
import { useEffect, useState } from 'react';
import { isDeconstructEvent, type DeconstructEvent } from '@bombfarm/contracts';
import { forgeQueuePort, type ForgeQueuePort } from '../forge/forge-queue-store';
import { createLazySingleton, createSharedStore } from '../shared-store';
import {
  deconstructRunReducer,
  IDLE_DECONSTRUCT_RUN,
  isBurning,
  type DeconstructRunAction,
  type DeconstructRunState,
} from './deconstruct-run-reducer';
import { unselectDeconstruct } from './deconstruct-store';

type Bridge = NonNullable<Window['bfc']>;

export interface DeconstructRunStoreDeps {
  readonly bridge: Bridge | null;
  readonly queue: ForgeQueuePort;
  readonly onBurned: (itemIds: readonly string[]) => void;
}

export interface DeconstructRunStore {
  readonly getState: () => DeconstructRunState;
  readonly subscribe: (listener: (state: DeconstructRunState) => void) => () => void;
  readonly start: () => void;
  readonly burn: (itemIds: readonly string[]) => void;
  readonly dismiss: () => void;
}

export function createDeconstructRunStore(deps: DeconstructRunStoreDeps): DeconstructRunStore {
  let send: ((action: DeconstructRunAction) => void) | null = null;
  let queuePausedByBurn = false;

  const store = createSharedStore<DeconstructRunState, DeconstructRunAction>({
    initial: IDLE_DECONSTRUCT_RUN,
    accept: deconstructRunReducer,
    connect: (dispatch) => {
      send = dispatch;
      if (!deps.bridge) return;
      deps.bridge.on('deconstruct:event', (event: DeconstructEvent) => {
        if (!isDeconstructEvent(event)) return;
        dispatch({ kind: 'done', event });
        if (event.result.status === 'burned') deps.onBurned(event.itemIds);
        resumeQueue();
      });
    },
  });

  function resumeQueue(): void {
    if (!queuePausedByBurn) return;
    queuePausedByBurn = false;
    deps.queue.resume();
  }

  function request(itemIds: readonly string[]): void {
    const bridge = deps.bridge;
    if (!bridge) return;
    bridge
      .invoke('deconstruct:start', { itemIds: [...itemIds] })
      .then((result) => {
        if (result.ok) {
          send?.({ kind: 'began', runId: result.runId, itemIds });
          return;
        }
        send?.({ kind: 'start-refused', reason: result.reason });
        resumeQueue();
      })
      .catch(() => {
        send?.({ kind: 'start-refused', reason: 'unavailable' });
        resumeQueue();
      });
  }

  return {
    getState: () => store.getState(),
    subscribe: (listener) => store.subscribe(listener),
    start: () => {
      store.start();
    },
    burn: (itemIds) => {
      store.start();
      if (isBurning(store.getState())) return;
      send?.({ kind: 'starting' });
      if (!deps.bridge) {
        send?.({ kind: 'start-refused', reason: 'unavailable' });
        return;
      }
      if (deps.queue.getState().status !== 'running') {
        request(itemIds);
        return;
      }
      deps.queue.pause();
      queuePausedByBurn = true;
      if (deps.queue.getState().active === null) {
        request(itemIds);
        return;
      }
      const unsubscribe = deps.queue.subscribe((next) => {
        if (next.active !== null) return;
        unsubscribe();
        request(itemIds);
      });
    },
    dismiss: () => {
      store.start();
      send?.({ kind: 'dismiss' });
    },
  };
}

const sharedDeconstructRunStore = createLazySingleton(() =>
  createDeconstructRunStore({
    bridge: typeof window === 'undefined' ? null : ((window as unknown as { bfc?: Bridge }).bfc ?? null),
    queue: forgeQueuePort(),
    onBurned: unselectDeconstruct,
  }),
);

export function useDeconstructRun(): DeconstructRunState {
  const [state, setState] = useState<DeconstructRunState>(() => sharedDeconstructRunStore().getState());

  useEffect(() => {
    const store = sharedDeconstructRunStore();
    const unsubscribe = store.subscribe(setState);
    setState(store.getState());
    store.start();
    return unsubscribe;
  }, []);

  return state;
}

export function burnDeconstruct(itemIds: readonly string[]): void {
  sharedDeconstructRunStore().burn(itemIds);
}

export function dismissDeconstructRun(): void {
  sharedDeconstructRunStore().dismiss();
}
