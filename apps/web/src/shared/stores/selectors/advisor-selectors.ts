import {
  computeAdvisorPipeline,
  type AdvisorPipelineResult,
} from '@bombfarm/domain/advisor-pipeline';
import type { PlannerStore } from '@/shared/stores/planner-store';

/**
 * Module-level single-entry cache — valid because the planner is client-only (AD-012)
 * with exactly one store instance. Reset in Vitest via resetAdvisorPipelineCache().
 */
let advisorPipelineComputeCount = 0;
let cache: { deps: readonly unknown[]; result: AdvisorPipelineResult } | null = null;

export function resetAdvisorPipelineCache(): void {
  cache = null;
}

export function getAdvisorPipelineComputeCount(): number {
  return advisorPipelineComputeCount;
}

export function resetAdvisorPipelineComputeCount(): void {
  advisorPipelineComputeCount = 0;
  resetAdvisorPipelineCache();
}

/** Zero-allocation dep read — stored references only (W5-07). */
export function readAdvisorDepTuple(state: PlannerStore): readonly unknown[] {
  return [
    state.naked,
    state.gearedOverride,
    state.loadout,
    state.altLoadout,
    state.pts,
    state.abilities,
    state.rarity,
    state.level,
    state.stars,
    state.treeDanoTotal,
    state.treeCritChance,
    state.treeCritDmg,
    state.treeSpeed,
    state.treeEnergy,
    state.treeLuckFlatPct,
    state.teamBuffs,
    state.houseIdx,
    state.houseLevel,
    state.houseCycleSecs,
    state.houseCycleSecsHouseIdx,
    state.houseCycleSecsLevel,
    state.phase,
    state.mitigationPct,
    state.rankMode,
    state.targetProp,
    state.birth,
  ] as const;
}

function depsEqual(left: readonly unknown[], right: readonly unknown[]): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index++) {
    if (!Object.is(left[index], right[index])) return false;
  }
  return true;
}

export function selectAdvisorPipeline(state: PlannerStore): AdvisorPipelineResult {
  const deps = readAdvisorDepTuple(state);
  if (cache && depsEqual(cache.deps, deps)) {
    return cache.result;
  }
  advisorPipelineComputeCount += 1;
  const result = computeAdvisorPipeline({
    naked: state.naked,
    geared: state.gearedOverride,
    loadout: state.loadout,
    altLoadout: state.altLoadout,
    pts: state.pts,
    abilities: state.abilities,
    rarity: state.rarity,
    level: state.level,
    stars: state.stars,
    treeDanoTotal: state.treeDanoTotal,
    treeCritChance: state.treeCritChance,
    treeCritDmg: state.treeCritDmg,
    treeSpeed: state.treeSpeed,
    treeEnergy: state.treeEnergy,
    treeLuckFlatPct: state.treeLuckFlatPct,
    teamBuffs: state.teamBuffs,
    houseIdx: state.houseIdx,
    houseLevel: state.houseLevel,
    houseCycleSecs: state.houseCycleSecs,
    houseCycleSecsHouseIdx: state.houseCycleSecsHouseIdx,
    houseCycleSecsLevel: state.houseCycleSecsLevel,
    phase: state.phase,
    mitigationPct: state.mitigationPct,
    rankMode: state.rankMode,
    targetProp: state.targetProp,
    birth: state.birth,
  });
  cache = { deps, result };
  return result;
}

export const selectDps = (state: PlannerStore) => selectAdvisorPipeline(state).dps;
export const selectBestStat = (state: PlannerStore) => selectAdvisorPipeline(state).best.stat;
export const selectBestGainPct = (state: PlannerStore) => selectAdvisorPipeline(state).best.dpsGainPct;
