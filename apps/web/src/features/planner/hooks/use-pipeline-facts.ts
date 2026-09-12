'use client';

import type { PipelineFacts } from '@bombfarm/domain/stat-breakdown';
import { usePlannerStore, selectAdvisorPipeline } from '@/shared/stores';

/** Everything the per-statistic breakdown reads: the pipeline's own outputs beside the draft
 *  fields they were computed from. */
export function usePipelineFacts(): PipelineFacts {
  const pipeline = usePlannerStore(selectAdvisorPipeline);
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
    teamCritFlat,
    rest,
    dmgMult,
    treeSheet,
  } = pipeline;

  return {
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
}
