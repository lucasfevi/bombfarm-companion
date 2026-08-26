import { useEffect, useState } from 'react';
import { INITIAL_LIVE_MODEL, type LiveModel } from './live-model';
import { createLiveStore, type LiveBridge } from './live-store';

export function useLiveModel(): LiveModel {
  const [model, setModel] = useState<LiveModel>(INITIAL_LIVE_MODEL);

  useEffect(() => {
    const bridge = (window as unknown as { bfc?: LiveBridge }).bfc;
    const store = createLiveStore({ bridge });

    const unsubscribe = store.subscribe(setModel);
    setModel(store.getModel());
    store.start();

    return () => {
      unsubscribe();
      store.stop();
    };
  }, []);

  return model;
}
