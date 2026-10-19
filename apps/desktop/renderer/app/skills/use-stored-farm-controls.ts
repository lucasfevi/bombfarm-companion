'use client';

/**
 * The Farm screen's stored compute controls — pool overrides, return bonus, auras at cap, map
 * size — read once when this screen mounts, so a node is priced under the same roster and on the
 * same field the board prices. The map size follows the game the way the board's does when the
 * player has not picked one.
 *
 * Read in an effect for the reason `use-farm-selected-phase.ts` reads the phase that way: this
 * renderer is a prerendered static export, and a value only the browser has cannot be part of the
 * first markup. Never written; the Farm screen owns its controls.
 */
import { useEffect, useMemo, useState } from 'react';
import type { FarmControls } from '../../lib/farm/farm-inputs';
import { effectiveMapSize, loadFarmView, type FarmView } from '../../lib/farm/farm-view-storage';
import { useLiveMapSize } from '../../lib/live/use-live-map-size';

export function useStoredFarmControls(): FarmControls | null {
  const [stored, setStored] = useState<FarmView | null>(null);
  const liveMapSize = useLiveMapSize();

  useEffect(() => {
    setStored(loadFarmView());
  }, []);

  return useMemo(
    () =>
      stored === null
        ? null
        : {
            farmPoolOverrides: stored.farmPoolOverrides,
            farmReturnBonus: stored.farmReturnBonus,
            aurasAtCap: stored.aurasAtCap,
            farmMapSize: effectiveMapSize(stored.farmMapSizeOverride, liveMapSize),
          },
    [stored, liveMapSize],
  );
}
