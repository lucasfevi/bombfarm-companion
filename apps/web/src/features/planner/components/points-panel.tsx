'use client';

import { PointsTable } from '@bombfarm/hero/components';
import { useAppLang } from '@/shared/context/app-lang';
import { usePlannerStore, selectAdvisorPipeline, runHeroFarmOptimize } from '@/shared/stores';

/**
 * Store wiring for the shared Points panel. It lives here rather than in `AdviceColumn` so a
 * points edit wakes this panel alone — subscribing from the column would re-render the ranking
 * and sheet panels beside it on every click.
 *
 * Remounted per hero by the `key` at its call site, which is what resets `PointsTable`'s local
 * preview state; the connector holds no state of its own, so that keying keeps working through it.
 */
export function PointsPanel() {
  const { t, lang } = useAppLang();
  const level = usePlannerStore((state) => state.level);
  const pts = usePlannerStore((state) => state.pts);
  const setPts = usePlannerStore((state) => state.setPts);
  const pipeline = usePlannerStore(selectAdvisorPipeline);
  const heroBattleAllowed = usePlannerStore((state) => state.heroBattleAllowed);
  const optimizeMode = usePlannerStore((state) => state.optimizeMode);
  const setOptimizeMode = usePlannerStore((state) => state.setOptimizeMode);

  return (
    <PointsTable
      t={t}
      lang={lang}
      level={level}
      pts={pts}
      pipeline={pipeline}
      heroBattleAllowed={heroBattleAllowed}
      editing={{
        onPts: setPts,
        optimizeMode,
        onOptimizeModeChange: setOptimizeMode,
        // Read through getState() rather than a subscription: the farm search needs the whole
        // rotation pool, and subscribing this panel to it would drag a roster-wide dependency
        // onto a screen that renders one hero.
        runFarmOptimize: () => runHeroFarmOptimize(usePlannerStore.getState()),
      }}
    />
  );
}
