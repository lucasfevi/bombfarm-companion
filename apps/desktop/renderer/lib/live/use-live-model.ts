import { useEffect, useState } from 'react';
import { INITIAL_LIVE_MODEL, type LiveModel } from './live-model';
import { createLiveStore, type LiveBridge, type LiveStore } from './live-store';

/**
 * Memoizes one store over every caller, so the store's lifetime is the renderer WINDOW's and not
 * one mount of the Live tab. The tab unmounts whenever the player looks at Inventory or Settings;
 * a store built per mount is torn back down with it, and the next visit starts again from
 * `loading` — the spinner on return, and a hole covering everything that arrived while away.
 * Construction is lazy because it reads `window.bfc`, and this module is evaluated during the
 * static export build, where there is no window.
 */
export function createLiveStoreHolder(make: () => LiveStore): () => LiveStore {
  let store: LiveStore | null = null;
  return () => {
    store ??= make();
    return store;
  };
}

const sharedLiveStore = createLiveStoreHolder(() =>
  createLiveStore({ bridge: (window as unknown as { bfc?: LiveBridge }).bfc }),
);

export function useLiveModel(): LiveModel {
  const [model, setModel] = useState<LiveModel>(INITIAL_LIVE_MODEL);

  useEffect(() => {
    const store = sharedLiveStore();

    const unsubscribe = store.subscribe(setModel);
    setModel(store.getModel());
    store.start();

    // Unsubscribes this mount, and deliberately does NOT stop the store: the bridge
    // subscriptions it holds are what keep the model current while another tab is showing, which
    // is what makes the `getModel()` above paint live data instead of `loading` on the way back.
    return unsubscribe;
  }, []);

  return model;
}
