import { useEffect, useState } from 'react';
import type { PremiumView } from '@bombfarm/contracts';
import { createLazySingleton } from '../shared-store';
import { createPremiumStore, type PremiumActions, type PremiumBridge, type PremiumState } from './premium-store';

const sharedStore = createLazySingleton(() =>
  createPremiumStore(() => (window as unknown as { bfc?: PremiumBridge }).bfc),
);

function useSharedState(enabled = true): PremiumState {
  const [state, setState] = useState<PremiumState>(() => sharedStore().getState());
  useEffect(() => {
    if (!enabled) return;
    const store = sharedStore();
    const unsubscribe = store.subscribe(setState);
    setState(store.getState());
    store.start();
    return unsubscribe;
  }, [enabled]);
  return state;
}

export function usePremium(): PremiumActions & { readonly view: PremiumView } {
  const state = useSharedState();
  useEffect(() => {
    void sharedStore().actions.refresh();
  }, []);
  return { view: state.view, ...sharedStore().actions };
}

export function usePremiumVisible(enabled: boolean): boolean {
  return useSharedState(enabled).view.visible && enabled;
}
