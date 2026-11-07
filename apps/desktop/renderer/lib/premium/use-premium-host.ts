import { useEffect, useState } from 'react';
import type { PremiumHostView, PremiumView } from '@bombfarm/contracts';
import { createLazySingleton, createSharedStore } from '../shared-store';

/** The part of the window's bridge this hook reads: the host view, and nothing of the licence. */
interface HostBridge {
  invoke(channel: 'premium:get'): Promise<PremiumView>;
  on(channel: 'premium:changed', handler: (view: PremiumView) => void): () => void;
}

/** Newest arrival wins; the same host view object changes nothing. */
function accept(state: PremiumHostView | null, arrival: PremiumHostView | null): PremiumHostView | null {
  return arrival === state ? state : arrival;
}

const sharedStore = createLazySingleton(() =>
  createSharedStore<PremiumHostView | null, PremiumHostView | null>({
    initial: null,
    accept,
    connect: (dispatch) => {
      const bridge = (window as unknown as { bfc?: HostBridge }).bfc;
      if (!bridge) return;
      try {
        Promise.resolve(bridge.invoke('premium:get'))
          .then((view) => {
            dispatch(view.host);
          })
          .catch(() => undefined);
        bridge.on('premium:changed', (view) => {
          dispatch(view.host);
        });
      } catch {
        // A bridge without the Premium channels leaves the section absent.
      }
    },
  }),
);

/**
 * The host view alone, for the Live tab's section. It reads only the running bundle's host view
 * and never the licence, and it does not ask for a refresh.
 */
export function usePremiumHost(): PremiumHostView | null {
  const [host, setHost] = useState<PremiumHostView | null>(() => sharedStore().getState());
  useEffect(() => {
    const store = sharedStore();
    const unsubscribe = store.subscribe(setHost);
    setHost(store.getState());
    store.start();
    return unsubscribe;
  }, []);
  return host;
}
