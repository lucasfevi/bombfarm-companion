/**
 * The forge queue, held for the window — the same lifetime as the run store beside it, for the
 * same reason: the shell unmounts a tab the player leaves, and a queue that emptied itself on a
 * tab change would be no queue. This is also where the queue drives main: main forges one piece
 * per `forge:start` and answers `busy` to a second, so the queue asks for its head piece whenever
 * it is running with nothing in flight, and asks again when that run's `done` arrives.
 */
import { useEffect, useState } from 'react';
import type { ForgeEvent } from '@bombfarm/contracts';
import { createLazySingleton, createSharedStore } from '../shared-store';
import {
  EMPTY_FORGE_QUEUE,
  forgeQueueHead,
  forgeQueueReducer,
  type ForgeQueueAction,
  type ForgeQueuePiece,
  type ForgeQueueState,
} from './forge-queue-reducer';
import { loadForgeQueuePieces, saveForgeQueuePieces } from './forge-queue-storage';

type Bridge = NonNullable<Window['bfc']>;

export interface ForgeQueueStoreDeps {
  readonly bridge: Bridge | null;
  readonly load: () => readonly ForgeQueuePiece[];
  readonly save: (pieces: readonly ForgeQueuePiece[]) => void;
}

export interface ForgeQueueStore {
  readonly getState: () => ForgeQueueState;
  readonly subscribe: (listener: (state: ForgeQueueState) => void) => () => void;
  readonly start: () => void;
  readonly add: (itemId: string, target: number) => void;
  readonly remove: (itemId: string) => void;
  readonly startQueue: () => void;
  /** Stops the queue and cancels the run in flight, if the queue started one. */
  readonly cancel: () => void;
  readonly sync: (upgrades: ReadonlyMap<string, number>) => void;
}

export function createForgeQueueStore(deps: ForgeQueueStoreDeps): ForgeQueueStore {
  let send: ((action: ForgeQueueAction) => void) | null = null;

  const store = createSharedStore<ForgeQueueState, ForgeQueueAction>({
    initial: EMPTY_FORGE_QUEUE,
    accept: forgeQueueReducer,
    connect: (dispatch) => {
      send = dispatch;
      dispatch({ kind: 'restore', pieces: deps.load() });
      if (!deps.bridge) return;
      deps.bridge.on('forge:event', (event: ForgeEvent) => {
        if (event.type !== 'done') return;
        apply({ kind: 'done', runId: event.runId, result: event.result });
      });
    },
  });

  function apply(action: ForgeQueueAction): void {
    store.start();
    const before = store.getState();
    send?.(action);
    const after = store.getState();
    if (after.pieces !== before.pieces) deps.save(after.pieces);
    askForHead();
  }

  function askForHead(): void {
    const state = store.getState();
    const head = forgeQueueHead(state);
    if (state.status !== 'running' || state.active !== null || head === null || !deps.bridge) return;
    const { itemId, target } = head;
    apply({ kind: 'requested', itemId });
    deps.bridge
      .invoke('forge:start', { itemId, target, maxGold: null, maxAttempts: null })
      .then((result) => {
        if (!result.ok) {
          apply({ kind: 'refused', itemId, reason: result.reason });
          return;
        }
        apply({ kind: 'started', itemId, runId: result.runId });
        if (store.getState().status !== 'running') void deps.bridge?.invoke('forge:cancel', result.runId);
      })
      .catch(() => {
        apply({ kind: 'refused', itemId, reason: 'unavailable' });
      });
  }

  return {
    getState: () => store.getState(),
    subscribe: (listener) => store.subscribe(listener),
    start: () => {
      store.start();
    },
    add: (itemId, target) => {
      apply({ kind: 'add', itemId, target });
    },
    remove: (itemId) => {
      apply({ kind: 'remove', itemId });
    },
    startQueue: () => {
      apply({ kind: 'start' });
    },
    cancel: () => {
      const runId = store.getState().active?.runId ?? null;
      apply({ kind: 'cancel' });
      if (runId !== null) void deps.bridge?.invoke('forge:cancel', runId);
    },
    sync: (upgrades) => {
      apply({ kind: 'sync', upgrades });
    },
  };
}

const sharedForgeQueueStore = createLazySingleton(() =>
  createForgeQueueStore({
    bridge: typeof window === 'undefined' ? null : ((window as unknown as { bfc?: Bridge }).bfc ?? null),
    load: loadForgeQueuePieces,
    save: saveForgeQueuePieces,
  }),
);

export function useForgeQueue(): ForgeQueueState {
  const [state, setState] = useState<ForgeQueueState>(() => sharedForgeQueueStore().getState());

  useEffect(() => {
    const store = sharedForgeQueueStore();
    const unsubscribe = store.subscribe(setState);
    setState(store.getState());
    store.start();
    return unsubscribe;
  }, []);

  return state;
}

export function addToForgeQueue(itemId: string, target: number): void {
  sharedForgeQueueStore().add(itemId, target);
}

export function removeFromForgeQueue(itemId: string): void {
  sharedForgeQueueStore().remove(itemId);
}

export function startForgeQueue(): void {
  sharedForgeQueueStore().startQueue();
}

export function cancelForgeQueue(): void {
  sharedForgeQueueStore().cancel();
}

export function syncForgeQueue(upgrades: ReadonlyMap<string, number>): void {
  sharedForgeQueueStore().sync(upgrades);
}
