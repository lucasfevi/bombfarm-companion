import {
  computeAdvisorPipeline,
  type AdvisorPipelineResult,
} from '@bombfarm/domain/advisor-pipeline';
import { substituteHeroAbilities } from '@bombfarm/domain/team-buffs';
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
    // The active hero's own team-aura ranks are folded into `state.teamBuffs` at combine time
    // (issue #132's substitution, `substituteHeroAbilities`), not by `abilityMods` any more — so
    // a change to EITHER the roster (the active hero's last-persisted ranks) or `activeHeroId`
    // itself (switching heroes) must invalidate this cache exactly like `state.abilities` above.
    state.heroes,
    state.activeHeroId,
    state.houseIdx,
    state.houseLevel,
    state.houseCycleSecs,
    state.houseCycleSecsHouseIdx,
    state.houseCycleSecsLevel,
    state.phase,
    state.mitigationPct,
    // state.rankMode is deliberately NOT a dep here: computeAdvisorPipeline no longer reads
    // rankMode for anything, so including it would invalidate this cache on every dps/farm
    // toggle for no reason — the pipeline's ranking output cannot change from it.
    state.targetProp,
    state.birth,
  ] as const;
}

/**
 * The active hero's own team-aura ranks substituted into the stored roster total (issue #132):
 * `abilityMods` no longer folds a team aura into a hero's own mods at all, so the ONLY way an
 * edit to the active hero's own Grito/Marcha/Fôlego/Presságio rank reaches the live preview is
 * through this substitution — `state.teamBuffs` was last computed (by the autofill button, or
 * hand-typed) against the roster's PERSISTED ranks, and `state.heroes` still holds that
 * persisted rank for the active hero until the autosave debounce catches up with `state.abilities`.
 */
function previewTeamBuffs(state: PlannerStore) {
  const savedActiveHero = state.heroes.find((hero) => hero.id === state.activeHeroId);
  if (!savedActiveHero) return state.teamBuffs;
  return substituteHeroAbilities(state.teamBuffs, savedActiveHero.abilities, state.abilities);
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
    teamBuffs: previewTeamBuffs(state),
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
// selectBestStat / selectBestGainPct moved to next-point-selectors.ts — they are mode-aware
// now (DPS vs. farm ranking), and defining them here would make that file depend back on this
// one, an import cycle. stores/index.ts re-exports them under the same names.
