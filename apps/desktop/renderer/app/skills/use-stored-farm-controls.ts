'use client';

/**
 * The Farm screen's stored compute controls — pool overrides, return bonus, auras at cap — read
 * once when this screen mounts, so a node is priced under the same roster the board prices.
 *
 * Read in an effect for the reason `use-farm-selected-phase.ts` reads the phase that way: this
 * renderer is a prerendered static export, and a value only the browser has cannot be part of the
 * first markup. Never written; the Farm screen owns its controls.
 */
import { useEffect, useState } from 'react';
import type { FarmControls } from '../../lib/farm/farm-inputs';
import { loadFarmView } from '../../lib/farm/farm-view-storage';

export function useStoredFarmControls(): FarmControls | null {
  const [controls, setControls] = useState<FarmControls | null>(null);

  useEffect(() => {
    const stored = loadFarmView();
    setControls({
      farmPoolOverrides: stored.farmPoolOverrides,
      farmReturnBonus: stored.farmReturnBonus,
      aurasAtCap: stored.aurasAtCap,
    });
  }, []);

  return controls;
}
