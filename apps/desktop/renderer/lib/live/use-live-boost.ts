import { useEffect, useMemo, useState } from 'react';
import type { EconomyBoost } from '@bombfarm/domain/farm-rate';
import { economyBoostOf } from './live-boost';
import { sharedLiveStore } from './use-live-model';

/** The running Boosts alone, for a screen that prices them. Holding only this slice keeps the
 *  fast channel's four arrivals a second from re-rendering that screen. */
export function useLiveBoost(): EconomyBoost {
  const [axes, setAxes] = useState(() => sharedLiveStore().getModel().boosts);

  useEffect(() => {
    const store = sharedLiveStore();
    const unsubscribe = store.subscribe((model) => {
      setAxes(model.boosts);
    });
    setAxes(store.getModel().boosts);
    store.start();
    return unsubscribe;
  }, []);

  return useMemo(() => economyBoostOf(axes), [axes]);
}
