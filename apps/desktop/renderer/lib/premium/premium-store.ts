import {
  signedOutPremiumView,
  type IpcEventChannel,
  type IpcInvokeArgs,
  type IpcInvokeChannel,
  type IpcInvokeResult,
  type PremiumActionResult,
  type PremiumView,
} from '@bombfarm/contracts';
import { createSharedStore, type SharedStore } from '../shared-store';

export interface PremiumState {
  readonly applied: number;
  readonly view: PremiumView;
}

export type PremiumArrival =
  | { readonly kind: 'pushed'; readonly view: PremiumView }
  | { readonly kind: 'fetched'; readonly view: PremiumView; readonly issuedAt: number };

export const initialPremiumState: PremiumState = { applied: 0, view: signedOutPremiumView };

export function accept(state: PremiumState, arrival: PremiumArrival): PremiumState {
  if (arrival.kind === 'fetched' && arrival.issuedAt !== state.applied) return state;
  return { applied: state.applied + 1, view: arrival.view };
}

export interface PremiumBridge {
  invoke<C extends IpcInvokeChannel>(channel: C, ...args: IpcInvokeArgs<C>): Promise<IpcInvokeResult<C>>;
  on(channel: Extract<IpcEventChannel, 'premium:changed'>, handler: (view: PremiumView) => void): () => void;
}

export interface PremiumActions {
  readonly signIn: () => Promise<PremiumActionResult>;
  readonly cancelSignIn: () => Promise<boolean>;
  readonly signOut: () => Promise<void>;
  readonly refresh: () => Promise<PremiumActionResult>;
  readonly manage: () => Promise<PremiumActionResult>;
}

export interface PremiumStore extends SharedStore<PremiumState> {
  readonly actions: PremiumActions;
}

const UNAVAILABLE: PremiumActionResult = { ok: false, reason: 'unavailable' };

export function createPremiumStore(getBridge: () => PremiumBridge | undefined): PremiumStore {
  let pushed: ((view: PremiumView) => void) | null = null;

  const store = createSharedStore<PremiumState, PremiumArrival>({
    initial: initialPremiumState,
    accept,
    connect: (dispatch) => {
      pushed = (view) => {
        dispatch({ kind: 'pushed', view });
      };
      const bridge = getBridge();
      if (!bridge) return;
      const issuedAt = initialPremiumState.applied;
      bridge
        .invoke('premium:get')
        .then((view) => {
          dispatch({ kind: 'fetched', view, issuedAt });
        })
        .catch(() => undefined);
      bridge.on('premium:changed', (view) => {
        dispatch({ kind: 'pushed', view });
      });
    },
  });

  const withBridge = <T>(call: (bridge: PremiumBridge) => Promise<T>, fallback: T): Promise<T> => {
    const bridge = getBridge();
    return bridge ? call(bridge) : Promise.resolve(fallback);
  };

  const act = (call: (b: PremiumBridge) => Promise<PremiumActionResult>): Promise<PremiumActionResult> =>
    withBridge((bridge) => call(bridge).catch(() => UNAVAILABLE), UNAVAILABLE);

  const actions: PremiumActions = {
    signIn: () => act((b) => b.invoke('premium:signIn')),
    cancelSignIn: () => withBridge((bridge) => bridge.invoke('premium:cancelSignIn').catch(() => false), false),
    signOut: async () => {
      const view = await withBridge((bridge) => bridge.invoke('premium:signOut').catch(() => null), null);
      if (view !== null) pushed?.(view);
    },
    refresh: () => act((b) => b.invoke('premium:refresh')),
    manage: () => act((b) => b.invoke('premium:manage')),
  };

  return { ...store, actions };
}
