/**
 * The planner store's adapter onto `@bombfarm/farm/core`. Every compute below happens in the
 * shared package, which knows nothing about zustand; this file's whole job is the
 * `PlannerStore -> FarmInputs` mapping and one memo instance for this app.
 *
 * No file in apps/web imports a runtime binding from `@bombfarm/domain/farm-rate` or
 * `@bombfarm/domain/farm-optimize` any more — the package owns both, and a structural guard
 * enforces it (farm-ranking-guards.test.ts, guards (f) and (g)). Type-only imports of
 * `FarmRateRow`/`ReturnBonusMode` erase at compile time and stay allowed.
 *
 * PRODUCER OBLIGATION, unchanged by the move and still owed by this app. Two tuple members are
 * compared by REFERENCE (`Object.is`) inside the package: `state.heroes` and
 * `state.farmPoolOverrides`. A fresh-but-equal array or object reads exactly like a
 * real edit — it recomputes the whole 600-row board with no error surfaced. For `heroes` that
 * obligation is met by every roster producer in `shared/lib/storage.ts` — `patchHeroInList` (the
 * 700ms autosave path, the guard that cost the most to find), `importHeroes` (the save-import
 * path), and `writeHeroBattleAllowed` (`stores/persistence/persist-roster.ts`) — each returning
 * the SAME array when nothing changed. The matching consumer half is `commitRoster` in
 * `stores/slices/roster-slice.ts`, the single writer of `state.heroes`, which declines to `set`
 * on an unchanged reference. A new roster producer owes both halves.
 *
 * `toFarmInputs` allocating a fresh object per call does NOT threaten any of that: the memo
 * never keys on that object, it keys on the 18 fields read out of it.
 */
import {
  buildAccount as buildFarmAccount,
  computeFarmTeamBuffs,
  createFarmRankingMemo,
  deriveFarmPoolEntries,
  farmDepsEqual,
  readFarmDepTuple as readFarmInputsDepTuple,
  resolveEnabledHeroIds as resolveEnabledHeroIdsFor,
  type FarmInputs,
  type FarmPoolEntry,
  type FarmRankingResult,
} from '@bombfarm/farm/core';
import type { FarmAccount } from '@bombfarm/domain/farm-rate';
import type { AccountShared as CombatAccount } from '@bombfarm/domain/shims/storage';
import type { PlannerStore } from '@/shared/stores/planner-store';
import { selectAccountShared } from '@/shared/stores/selectors/account-selectors';
import { NO_AURAS_AT_CAP } from '@bombfarm/domain/team-buffs';

export { deriveFarmPoolEntries };
export type {
  FarmPoolEntry,
  FarmRankingReason,
  FarmRankingResult,
} from '@bombfarm/farm/core';

/** One instance for this app. The desktop app owns its own — no cache, and no compute counter,
 *  is shared across a process boundary or across two hosts in one test run. */
const memo = createFarmRankingMemo();

/**
 * The mapping, and the only place this app's store field names meet the package's. A fresh
 * object every call is deliberate and harmless — see the producer note above.
 */
function toFarmInputs(state: PlannerStore): FarmInputs {
  return {
    heroes: state.heroes,
    treeDanoTotal: state.treeDanoTotal,
    treeCritChance: state.treeCritChance,
    treeCritDmg: state.treeCritDmg,
    treeSpeed: state.treeSpeed,
    treeEnergy: state.treeEnergy,
    treeTeamCoinPct: state.treeTeamCoinPct,
    treeLuckFlatPct: state.treeLuckFlatPct,
    houseIdx: state.houseIdx,
    houseLevel: state.houseLevel,
    slots: state.slots,
    fieldSlots: state.fieldSlots,
    houseCycleSecs: state.houseCycleSecs,
    houseCycleSecsHouseIdx: state.houseCycleSecsHouseIdx,
    houseCycleSecsLevel: state.houseCycleSecsLevel,
    maxPhase: state.maxPhase,
    farmPoolOverrides: state.farmPoolOverrides,
    farmReturnBonus: state.farmReturnBonus,
    // This app offers no control for it: the board prices every aura as the pool sustains it.
    aurasAtCap: NO_AURAS_AT_CAP,
  };
}

export function farmInputsOf(state: PlannerStore): FarmInputs {
  return toFarmInputs(state);
}

/** The 19 planner edits the board must react to. See the package's own header for what each
 *  member is there to catch and why a missing one fails silently. */
export function readFarmDepTuple(state: PlannerStore) {
  return readFarmInputsDepTuple(toFarmInputs(state));
}

export function resetFarmRankingCache(): void {
  memo.reset();
}

export function getFarmRankingComputeCount(): number {
  return memo.rowsComputeCount();
}

export function resetFarmRankingComputeCount(): void {
  memo.resetRowsComputeCount();
}

export function resolveEnabledHeroIds(state: PlannerStore): string[] {
  return resolveEnabledHeroIdsFor(toFarmInputs(state));
}

export function buildAccount(state: PlannerStore): FarmAccount {
  return buildFarmAccount(toFarmInputs(state));
}

let rosterTeamBuffsCache: { deps: readonly unknown[]; result: Record<string, number> } | null = null;
let rosterAccountCache: CombatAccount | null = null;

export function resetRosterAccountCache(): void {
  rosterTeamBuffsCache = null;
  rosterAccountCache = null;
}

/**
 * The team-aura totals the Farm board prices against, for the roster-wide readers that sit beside
 * it (the phases explorer's squad ranking) — every pooled carrier weighted by its own predicted
 * uptime, so the explorer and the board agree on the same roster. Memoized on the board's own
 * dep tuple: it costs a pipeline pass per pooled hero.
 */
export function selectRosterTeamBuffs(state: PlannerStore): Record<string, number> {
  const deps = readFarmDepTuple(state);
  if (rosterTeamBuffsCache && farmDepsEqual(rosterTeamBuffsCache.deps, deps)) {
    return rosterTeamBuffsCache.result;
  }
  const result = computeFarmTeamBuffs(toFarmInputs(state));
  rosterTeamBuffsCache = { deps, result };
  return result;
}

/** {@link selectAccountShared} with {@link selectRosterTeamBuffs} overlaid — the account a
 *  ROSTER-WIDE figure computes against. A per-hero figure reads `selectActiveHeroAccount`. */
export function selectRosterAccount(state: PlannerStore): CombatAccount {
  const shared = selectAccountShared(state);
  const teamBuffs = selectRosterTeamBuffs(state);
  if (
    rosterAccountCache &&
    rosterAccountCache.teamBuffs === teamBuffs &&
    Object.is(rosterAccountCache.context, shared.context)
  ) {
    return rosterAccountCache;
  }
  rosterAccountCache = { ...shared, teamBuffs };
  return rosterAccountCache;
}

/**
 * Single-entry memoized selector. Returns the SAME object identity on a cache hit, so
 * `usePlannerStore(selectFarmRankingRows)` needs no `useShallow` — and must not have one:
 * shallow-comparing 600 rows on every store write is the exact cost this memoization exists to
 * avoid (the `selectAdvisorPipeline` carve-out in `state-management.md`).
 */
export function selectFarmRankingRows(state: PlannerStore): FarmRankingResult {
  return memo.rows(toFarmInputs(state));
}

/** Convenience wrapper over `deriveFarmPoolEntries` for direct-state callers (tests). */
export function selectFarmPoolEntries(state: PlannerStore): FarmPoolEntry[] {
  return deriveFarmPoolEntries(state.heroes, state.farmPoolOverrides);
}

export const selectFarmReturnBonus = (state: PlannerStore) => state.farmReturnBonus;
