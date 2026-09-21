/**
 * The apply panel's window-lifetime store — held for the window the same way the forge stores
 * are, so a step in flight survives the player leaving the Optimizer tab. This is the only module
 * that invokes `apply:start`/`apply:stop`, subscribes `apply:event`, and steps the forge queue
 * aside — every other apply module is pure.
 */
import { useEffect, useState } from 'react';
import { isApplyEvent, type ApplyEvent, type ApplyStartRequest, type ApplyStartResult, type ApplyStep } from '@bombfarm/contracts';
import { createLazySingleton, createSharedStore } from '../shared-store';
import { forgeQueuePort, type ForgeQueuePort } from '../forge/forge-queue-store';
import {
  applyProgressReducer,
  initialApplyProgress,
  type ApplyProgressAction,
  type ApplyProgressState,
} from './apply-progress-reducer';
import type { ApplyStepId } from './apply-panel-model';
import type { ApplyUnitLabel } from './apply-labels';

type Bridge = NonNullable<Window['bfc']>;

export interface ApplyStoreDeps {
  readonly bridge: Bridge | null;
  readonly queue: ForgeQueuePort;
  readonly now: () => number;
}

export interface ApplyStore {
  readonly getState: () => ApplyProgressState;
  readonly subscribe: (listener: (state: ApplyProgressState) => void) => () => void;
  readonly start: () => void;
  readonly bind: (planRunId: string) => void;
  readonly openConfirm: (step: ApplyStepId) => void;
  readonly cancelConfirm: () => void;
  readonly confirm: (step: ApplyStep, units: readonly ApplyUnitLabel[], request: ApplyStartRequest) => void;
  readonly stop: () => void;
  readonly closeModal: () => void;
  readonly continueNext: () => void;
  readonly forgeDone: (result: { made: number; skipped: number }) => void;
}

export function createApplyStore(deps: ApplyStoreDeps): ApplyStore {
  let send: ((action: ApplyProgressAction) => void) | null = null;
  let unsubscribeQueueWait: (() => void) | null = null;
  let runningRunId: string | null = null;

  const store = createSharedStore<ApplyProgressState, ApplyProgressAction>({
    initial: initialApplyProgress,
    accept: applyProgressReducer,
    connect: (dispatch) => {
      send = dispatch;
      if (!deps.bridge) return;
      deps.bridge.on('apply:event', (payload: ApplyEvent) => {
        if (!isApplyEvent(payload)) return;
        send?.({ kind: 'event', event: payload });
        if (payload.type === 'done' && payload.runId === runningRunId) {
          runningRunId = null;
          resumeQueueIfPaused();
        }
      });
    },
  });

  function resumeQueueIfPaused(): void {
    if (!store.getState().queuePausedByApply) return;
    deps.queue.resume();
    send?.({ kind: 'queueResumed' });
  }

  function startRun(step: ApplyStep, units: readonly ApplyUnitLabel[], request: ApplyStartRequest): void {
    send?.({ kind: 'starting', step });
    if (!deps.bridge) {
      send?.({ kind: 'refused', step, reason: 'unavailable' });
      resumeQueueIfPaused();
      return;
    }
    deps.bridge
      .invoke('apply:start', request)
      .then((result: ApplyStartResult) => {
        if (!result.ok) {
          send?.({ kind: 'refused', step, reason: result.reason });
          resumeQueueIfPaused();
          return;
        }
        runningRunId = result.runId;
        send?.({ kind: 'began', step, runId: result.runId, units, startedAtMs: deps.now() });
      })
      .catch(() => {
        send?.({ kind: 'refused', step, reason: 'unavailable' });
        resumeQueueIfPaused();
      });
  }

  return {
    getState: () => store.getState(),
    subscribe: (listener) => store.subscribe(listener),
    start: () => {
      store.start();
    },
    bind: (planRunId) => {
      store.start();
      send?.({ kind: 'bind', planRunId });
    },
    openConfirm: (step) => {
      store.start();
      send?.({ kind: 'openConfirm', step });
    },
    cancelConfirm: () => {
      store.start();
      send?.({ kind: 'cancelConfirm' });
    },
    confirm: (step, units, request) => {
      store.start();
      if (deps.queue.getState().status === 'running') {
        deps.queue.pause();
        send?.({ kind: 'queuePaused', by: 'apply' });
        send?.({ kind: 'waitQueue', step });
        const unsubscribe = deps.queue.subscribe((next) => {
          if (next.active !== null) return;
          unsubscribe();
          unsubscribeQueueWait = null;
          startRun(step, units, request);
        });
        unsubscribeQueueWait = unsubscribe;
        return;
      }
      startRun(step, units, request);
    },
    stop: () => {
      const state = store.getState();
      if (state.modal === null || state.modal.stopRequested) return;
      if (state.modal.phase === 'waitingQueue') {
        unsubscribeQueueWait?.();
        unsubscribeQueueWait = null;
        resumeQueueIfPaused();
        send?.({ kind: 'queueWaitAborted' });
        return;
      }
      if (state.modal.run !== null) {
        send?.({ kind: 'stopRequested' });
        void deps.bridge?.invoke('apply:stop', state.modal.run.runId);
      }
    },
    closeModal: () => {
      send?.({ kind: 'closeModal' });
    },
    continueNext: () => {
      send?.({ kind: 'continueNext' });
    },
    forgeDone: (result) => {
      store.start();
      send?.({ kind: 'forgeDone', made: result.made, skipped: result.skipped });
    },
  };
}

const sharedApplyStore = createLazySingleton(() =>
  createApplyStore({
    bridge: typeof window === 'undefined' ? null : ((window as unknown as { bfc?: Bridge }).bfc ?? null),
    queue: forgeQueuePort(),
    now: () => Date.now(),
  }),
);

export function useApplyProgress(): ApplyProgressState {
  const [state, setState] = useState<ApplyProgressState>(() => sharedApplyStore().getState());

  useEffect(() => {
    const store = sharedApplyStore();
    const unsubscribe = store.subscribe(setState);
    setState(store.getState());
    store.start();
    return unsubscribe;
  }, []);

  return state;
}

export const applyActions = {
  bind: (planRunId: string): void => {
    sharedApplyStore().bind(planRunId);
  },
  openConfirm: (step: ApplyStepId): void => {
    sharedApplyStore().openConfirm(step);
  },
  cancelConfirm: (): void => {
    sharedApplyStore().cancelConfirm();
  },
  confirm: (step: ApplyStep, units: readonly ApplyUnitLabel[], request: ApplyStartRequest): void => {
    sharedApplyStore().confirm(step, units, request);
  },
  stop: (): void => {
    sharedApplyStore().stop();
  },
  closeModal: (): void => {
    sharedApplyStore().closeModal();
  },
  continueNext: (): void => {
    sharedApplyStore().continueNext();
  },
  forgeDone: (result: { made: number; skipped: number }): void => {
    sharedApplyStore().forgeDone(result);
  },
};
