import { useEffect, useState } from 'react';
import { createLazySingleton } from '../shared-store';
import type { LiveModel } from './live-model';
import { createLiveStore, type LiveBridge } from './live-store';

/** One store for the renderer window, not one per mount of the Live tab — `shared-store.ts`
 *  carries the reasoning every seam here is built on. `bridge` is a getter so that constructing
 *  the store touches no `window`: the first render reads its state, and the static export build
 *  renders in Node. `createLiveStore` resolves it once, in `start()`. */
const sharedLiveStore = createLazySingleton(() =>
  createLiveStore({
    get bridge(): LiveBridge | undefined {
      return (window as unknown as { bfc?: LiveBridge }).bfc;
    },
  }),
);

export function useLiveModel(): LiveModel {
  // Seeded from the store, not from `INITIAL_LIVE_MODEL`: on a remount the store already holds
  // live data, and reading it only in the effect below would paint one committed frame of
  // `loading` first — the flash this whole seam exists to remove.
  const [model, setModel] = useState<LiveModel>(() => sharedLiveStore().getModel());

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
