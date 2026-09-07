'use client';

import { useAppLang } from '@/shared/context/app-lang';
import {
  usePlannerStore,
  selectAdvisorPipeline,
  selectNextPointRanking,
  runHeroFarmOptimize,
} from '@/shared/stores';
import type { PipelineFacts } from '@bombfarm/domain/stat-breakdown';
import { NextPointRanking, PointsTable, SheetTable } from '@bombfarm/hero/components';
import { adviceSplitClass, colClass } from '@bombfarm/ui/panel-field.recipe';
import { EffectiveStatsPanel } from './effective-stats-panel';

export function AdviceColumn() {
  const { t, lang } = useAppLang();
  const pipeline = usePlannerStore(selectAdvisorPipeline);
  const activeHeroId = usePlannerStore((state) => state.activeHeroId);
  const birth = usePlannerStore((state) => state.birth);
  const level = usePlannerStore((state) => state.level);
  const stars = usePlannerStore((state) => state.stars);
  const pts = usePlannerStore((state) => state.pts);
  const setPts = usePlannerStore((state) => state.setPts);
  const loadout = usePlannerStore((state) => state.loadout);
  const heroBattleAllowed = usePlannerStore((state) => state.heroBattleAllowed);
  const optimizeMode = usePlannerStore((state) => state.optimizeMode);
  const setOptimizeMode = usePlannerStore((state) => state.setOptimizeMode);
  const rankMode = usePlannerStore((state) => state.rankMode);
  const setRankMode = usePlannerStore((state) => state.setRankMode);
  const nextPointRanking = usePlannerStore(selectNextPointRanking);
  const naked = usePlannerStore((state) => state.naked);
  const geared = usePlannerStore((state) => state.gearedOverride);
  const treeSpeed = usePlannerStore((state) => state.treeSpeed);
  const treeCritChance = usePlannerStore((state) => state.treeCritChance);
  const treeCritDmg = usePlannerStore((state) => state.treeCritDmg);
  const treeEnergy = usePlannerStore((state) => state.treeEnergy);
  const treeDanoTotal = usePlannerStore((state) => state.treeDanoTotal);

  const {
    pointDelta,
    adjusted,
    effective,
    mods,
    sheetOther,
    context,
    active,
    dps,
    uptime,
    attackMult,
    energyMult,
    speedMult,
    critDmgMult,
    teamCritFlat,
    rest,
    dmgMult,
    treeSheet,
  } = pipeline;

  const facts: PipelineFacts = {
    geared,
    adjusted,
    pts,
    delta: pointDelta,
    effective,
    mods,
    sheetOther,
    naked,
    level,
    stars,
    attackMult,
    energyMult,
    speedMult,
    critDmgMult,
    teamCritFlat,
    treeSpeed,
    treeCritChance,
    treeCritDmg,
    treeEnergy,
    treeLuckFlatPct: treeSheet.luckFlatPct,
    context,
    dmgMult,
    treeDanoTotal,
    extraDmgPct: 0,
    active,
    dps,
    uptime,
    rest,
  };

  return (
    <div className={colClass}>
      <>
          <div className={adviceSplitClass}>
            {/* Remount on hero switch — the cleanest way to reset PointsTable's local preview
                state per hero without an effect. Keying makes the reset a consequence of identity
                changing. */}
            <PointsTable
              key={activeHeroId ?? 'none'}
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
                // Read through getState() rather than a subscription: the farm search needs the
                // whole rotation pool, and subscribing this column to it would drag a roster-wide
                // dependency onto a screen that renders one hero.
                runFarmOptimize: () => runHeroFarmOptimize(usePlannerStore.getState()),
              }}
            />
            <NextPointRanking
              t={t}
              lang={lang}
              ranking={nextPointRanking}
              rankMode={rankMode}
              onRankMode={setRankMode}
            />
          </div>

          <SheetTable
            t={t}
            lang={lang}
            input={{ birth, level, stars, sheetOther, loadout, pts, tree: treeSheet }}
          />
          <EffectiveStatsPanel facts={facts} />
        </>
    </div>
  );
}
