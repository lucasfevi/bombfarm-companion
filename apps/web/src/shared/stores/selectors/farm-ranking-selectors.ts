// The ONLY file in apps/web that imports @bombfarm/domain/farm-rate (R-C20 AC-7 guard (f); the
// type-only ReturnBonusMode import in shared/lib/phases-view-storage.ts is the sole allowlisted
// exception, ASM-C15). computeFarmRates is B's own stated convenience entry for item C — it
// fixes the facts -> squad -> rows ordering in one place. Do NOT hand-compose
// computeHeroFarmFacts + computeSquadFarmFacts + computeFarmRateTable here (TD-13):
// that re-creates B's ordering contract in a second place for no benefit. returnBonusMultiplier
// and E_D_CELLS are intentionally never imported — this surface never applies a multiplier or a
// cadence constant itself (R-C20).
import { computeFarmRates, type FarmRateRow } from '@bombfarm/domain/farm-rate';
import type { AccountShared } from '@/shared/lib/storage';
import type { PlannerStore } from '@/shared/stores/planner-store';

export type FarmRankingReason = 'no-roster' | 'no-heroes-enabled' | 'compute-failed';

export type FarmRankingResult = {
  rows: readonly FarmRateRow[];
  /** `null` on a real compute; a named reason when rows is deliberately empty (`AD-PFRC-07`). */
  reason: FarmRankingReason | null;
};

const EMPTY_ROWS: readonly FarmRateRow[] = [];

/**
 * The `R-C21` / `AD-PFR-14` traceability artifact: every planner edit the board must react to.
 * 15 members — `maxPhase` is here because `FarmRateOptions.maxPhase` is what sets
 * `FarmRateRow.locked` (a COMPUTE INPUT, not a post-compute filter — TD-15; an earlier design
 * draft treating it as a filter would have made `row.locked` permanently `false`). A field
 * missing from this tuple is a planner edit that silently does not recompute the board.
 */
function readFarmDepTuple(state: PlannerStore) {
  return [
    state.heroes,
    state.treeDanoTotal,
    state.treeCritChance,
    state.treeCritDmg,
    state.treeSpeed,
    state.treeEnergy,
    state.treeTeamCoinPct,
    state.treeLuckFlatPct,
    state.teamBuffs,
    state.houseIdx,
    state.houseLevel,
    state.slots,
    state.maxPhase,
    state.farmPoolOverrides,
    state.farmReturnBonus,
  ] as const;
}

function depsEqual(left: readonly unknown[], right: readonly unknown[]): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index++) {
    if (!Object.is(left[index], right[index])) return false;
  }
  return true;
}

/** Module-level single-entry cache — one store instance (AD-012); reset via resetFarmRankingCache. */
let cache: { deps: readonly unknown[]; result: FarmRankingResult } | null = null;
let computeCount = 0;

export function resetFarmRankingCache(): void {
  cache = null;
}

export function getFarmRankingComputeCount(): number {
  return computeCount;
}

export function resetFarmRankingComputeCount(): void {
  computeCount = 0;
  resetFarmRankingCache();
}

/** `overrides[id] ?? (hero.battleAllowed ?? true)` — absence follows the save (`AD-PFR-05`). */
function resolveEnabledHeroIds(state: PlannerStore): string[] {
  const overrides = state.farmPoolOverrides;
  return state.heroes
    .filter((hero) => overrides[hero.id] ?? (hero.battleAllowed ?? true))
    .map((hero) => hero.id);
}

/**
 * Minimal `AccountShared` built directly from the tuple's own primitive fields — not
 * `selectAccountShared` (whose own tuple carries fields, e.g. `mitigationPct`/`phase`/
 * `rankMode`/`targetProp`, that `pipelineForHero(hero, account, 1, 0)` never reads because the
 * farm-rate module calls it with an explicit phase/mitigation of its own). Keeping this file's
 * own tuple as the single source of "what triggers a recompute" avoids a second referential-
 * stability mechanism.
 */
function buildAccount(state: PlannerStore): AccountShared {
  return {
    tree: {
      danoTotal: state.treeDanoTotal,
      critChance: state.treeCritChance,
      critDmg: state.treeCritDmg,
      speed: state.treeSpeed,
      energy: state.treeEnergy,
      teamCoinPct: state.treeTeamCoinPct,
      luckFlatPct: state.treeLuckFlatPct,
    },
    teamBuffs: state.teamBuffs,
    context: {
      houseIdx: state.houseIdx,
      houseLevel: state.houseLevel,
      phase: null,
      mitigationPct: 1,
      rankMode: 'dps',
      targetProp: 'stone',
    },
    slots: state.slots,
    maxPhase: state.maxPhase,
  };
}

function computeFarmRanking(state: PlannerStore): FarmRankingResult {
  // AD-PFRC-07: the empty pool is short-circuited BEFORE the call, never delegated. B's
  // documented behaviour for enabledHeroIds: [] is 600 rows of 0 / Infinity / infeasible:true —
  // correct as a total function, and exactly the table of zeros the surface must never render.
  if (state.heroes.length === 0) {
    return { rows: EMPTY_ROWS, reason: 'no-roster' };
  }
  const enabledHeroIds = resolveEnabledHeroIds(state);
  if (enabledHeroIds.length === 0) {
    return { rows: EMPTY_ROWS, reason: 'no-heroes-enabled' };
  }

  try {
    const { rows } = computeFarmRates({
      heroes: state.heroes,
      account: buildAccount(state),
      enabledHeroIds,
      returnBonus: state.farmReturnBonus,
      maxPhase: state.maxPhase,
    });
    return { rows, reason: null };
  } catch {
    // Caught at THIS boundary only — never downstream. A throw becomes a named, renderable
    // reason instead of being swallowed into an empty list that reads as "no good phases".
    return { rows: EMPTY_ROWS, reason: 'compute-failed' };
  }
}

/**
 * Module-level single-entry memoized selector (`R-C19`, MOD-18 shape). Returns the SAME object
 * identity on a cache hit, so `usePlannerStore(selectFarmRankingRows)` needs no `useShallow` —
 * and must not have one: shallow-comparing 600 rows on every store write is the exact cost this
 * memoization exists to avoid (the `selectAdvisorPipeline` carve-out in `state-management.md`).
 */
export function selectFarmRankingRows(state: PlannerStore): FarmRankingResult {
  const deps = readFarmDepTuple(state);
  if (cache && depsEqual(cache.deps, deps)) {
    return cache.result;
  }
  computeCount += 1;
  const result = computeFarmRanking(state);
  cache = { deps, result };
  return result;
}

export type FarmPoolEntry = {
  heroId: string;
  heroName: string;
  /** `overrides[id] ?? (battleAllowed ?? true)` — the same resolution `computeFarmRates` uses. */
  enabled: boolean;
};

/** One entry per roster hero, in roster order — the rotation-pool chip row's data source. */
export function selectFarmPoolEntries(state: PlannerStore): FarmPoolEntry[] {
  const overrides = state.farmPoolOverrides;
  return state.heroes.map((hero) => ({
    heroId: hero.id,
    heroName: hero.name,
    enabled: overrides[hero.id] ?? (hero.battleAllowed ?? true),
  }));
}

export const selectFarmReturnBonus = (state: PlannerStore) => state.farmReturnBonus;
