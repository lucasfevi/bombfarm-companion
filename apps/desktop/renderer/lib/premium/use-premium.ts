import { useEffect, useState } from 'react';
import type { PremiumView } from '@bombfarm/contracts';
import { createLazySingleton } from '../shared-store';
import { createPremiumStore, type PremiumActions, type PremiumBridge, type PremiumState } from './premium-store';

const sharedStore = createLazySingleton(() =>
  createPremiumStore((window as unknown as { bfc?: PremiumBridge }).bfc),
);

function useSharedState(): PremiumState {
  const [state, setState] = useState<PremiumState>(() => sharedStore().getState());
  useEffect(() => {
    const store = sharedStore();
    const unsubscribe = store.subscribe(setState);
    setState(store.getState());
    store.start();
    return unsubscribe;
  }, []);
  return state;
}

export function usePremium(): PremiumActions & { readonly view: PremiumView } {
  const state = useSharedState();
  useEffect(() => {
    void sharedStore().actions.refresh();
  }, []);
  return { view: state.view, ...sharedStore().actions };
}

export function usePremiumVisible(): boolean {
  return useSharedState().view.visible;
}
