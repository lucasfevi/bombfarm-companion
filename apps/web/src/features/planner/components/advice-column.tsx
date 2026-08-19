'use client';

import { usePlannerStore, selectAdvisorPipeline } from '@/shared/stores';
import type { PipelineFacts } from '@bombfarm/domain/stat-breakdown';
import { adviceSplitClass, colClass } from '@bombfarm/ui/panel-field.recipe';
import { PointsTable } from './points-table';
import { NextPointRanking } from './next-point-ranking';
import { SheetTable } from './sheet-table';
import { EffectiveStatsPanel } from './effective-stats-panel';

export function AdviceColumn() {
  const pipeline = usePlannerStore(selectAdvisorPipeline);
  const activeHeroId = usePlannerStore((state) => state.activeHeroId);
  const level = usePlannerStore((state) => state.level);
  const stars = usePlannerStore((state) => state.stars);
  const pts = usePlannerStore((state) => state.pts);
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
    teamCritPctOfBase,
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
    teamCritPctOfBase,
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
                state (DEC-02) per hero without an effect (design.md's "useEffect-free
                consequence of keying"). */}
            <PointsTable key={activeHeroId ?? 'none'} />
            <NextPointRanking />
          </div>

          <SheetTable />
          <EffectiveStatsPanel facts={facts} />
        </>
    </div>
  );
}
