import { useEffect, useState } from 'react';
import type { MapSize } from '@bombfarm/domain/model';
import { sharedLiveStore } from './use-live-model';

/** The field the game is drawing right now, or `null` with no live map. A string slice, so the
 *  fast channel's arrivals re-render the screen holding it only when the field itself changes. */
export function useLiveMapSize(): MapSize | null {
  const [mapSize, setMapSize] = useState<MapSize | null>(() => sharedLiveStore().getModel().map?.mapSize ?? null);

  useEffect(() => {
    const store = sharedLiveStore();
    const unsubscribe = store.subscribe((model) => {
      setMapSize(model.map?.mapSize ?? null);
    });
    setMapSize(store.getModel().map?.mapSize ?? null);
    store.start();
    return unsubscribe;
  }, []);

  return mapSize;
}
