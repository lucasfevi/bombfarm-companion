'use client';

import { usePlannerStore } from '@/shared/stores';
import { adviceSplitClass, colClass } from '@bombfarm/ui/panel-field.recipe';
import { PointsPanel } from './points-panel';
import { NextPointPanel } from './next-point-panel';
import { SheetPanel } from './sheet-panel';

export function AdviceColumn() {
  const activeHeroId = usePlannerStore((state) => state.activeHeroId);

  return (
    <div className={colClass}>
      <div className={adviceSplitClass}>
        {/* Remount on hero switch — the cleanest way to reset PointsTable's local preview
            state per hero without an effect. Keying makes the reset a consequence of identity
            changing. */}
        <PointsPanel key={activeHeroId ?? 'none'} />
        <NextPointPanel />
      </div>

      <SheetPanel />
    </div>
  );
}
