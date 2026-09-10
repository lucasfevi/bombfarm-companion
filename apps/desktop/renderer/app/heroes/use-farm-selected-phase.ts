'use client';

/**
 * The Farm screen's stored phase, read once when this screen mounts.
 *
 * Read in an effect rather than during render for the reason the Farm screen reads its own view
 * that way: this renderer is a prerendered static export, and a value only the browser has cannot
 * be part of the first, server-produced markup without a hydration mismatch.
 *
 * Once per mount, and never written. Leaving the screen and coming back re-reads it, which is what
 * makes the local override on this screen end when the screen does.
 */
import { useEffect, useState } from 'react';
import { loadFarmView } from '../../lib/farm/farm-view-storage';
import type { FarmPhaseSelection } from './hero-phase';

const NOT_READ_YET: FarmPhaseSelection = { ready: false, phase: null };

export function useFarmSelectedPhase(): FarmPhaseSelection {
  const [selection, setSelection] = useState<FarmPhaseSelection>(NOT_READ_YET);

  useEffect(() => {
    setSelection({ ready: true, phase: loadFarmView().selectedPhase });
  }, []);

  return selection;
}
