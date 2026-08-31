/**
 * The planner store's adapter onto `@bombfarm/farm/core`. Every compute below happens in the
 * shared package, which knows nothing about zustand; this file's whole job is the
 * `PlannerStore -> FarmInputs` mapping and one memo instance for this app.
 *
 * No file in apps/web imports a runtime binding from `@bombfarm/domain/farm-rate` or
 * `@bombfarm/domain/farm-optimize` any more — the package owns both, and a structural guard
 * enforces it (farm-ranking-guards.test.ts, guards (f) and (g)). Type-only imports of
 * `FarmRateRow`/`ReturnBonusMode`/`FarmRespecResult` erase at compile time and stay allowed.
 *
 * PRODUCER OBLIGATION, unchanged by the move and still owed by this app. Three tuple members are
 * compared by REFERENCE (`Object.is`) inside the package: `state.heroes`, the effective team
 * buffs, and `state.farmPoolOverrides`. A fresh-but-equal array or object reads exactly like a
 * real edit — it drops a live respec proposal with no error surfaced. For `heroes` that
 * obligation is met by every roster producer in `shared/lib/storage.ts` — `patchHeroInList` (the
 * 700ms autosave path, the guard that cost the most to find), `importHeroes` (the save-import
 * path), and `writeHeroBattleAllowed` (`stores/persistence/persist-roster.ts`) — each returning
 * the SAME array when nothing changed. The matching consumer half is `commitRoster` in
 * `stores/slices/roster-slice.ts`, the single writer of `state.heroes`, which declines to `set`
 * on an unchanged reference. A new roster producer owes both halves. `selectEffectiveTeamBuffs`
 * holds the same contract through its own single-entry cache.
 *
 * `toFarmInputs` allocating a fresh object per call does NOT threaten any of that: the memo
 * never keys on that object, it keys on the 19 fields read out of it.
 */
import {
  buildAccount as buildFarmAccount,
  computeFarmRespecShouldSurface,
  createFarmRankingMemo,
  deriveFarmPoolEntries,
  farmDepsEqual,
  readFarmDepTuple as readFarmInputsDepTuple,
  readFarmRespecDepTuple as readFarmInputsRespecDepTuple,
  resolveEnabledHeroIds as resolveEnabledHeroIdsFor,
  type FarmInputs,
  type FarmPoolEntry,
  type FarmRankingResult,
  type FarmRespecGate,
} from '@bombfarm/farm/core';
import type { FarmRespecResult } from '@bombfarm/domain/farm-optimize';
import type { AccountShared } from '@/shared/lib/storage';
import type { PlannerStore } from '@/shared/stores/planner-store';
import type { FarmRespecProposal, FarmRespecStatus } from '@/shared/stores/slices/phases-slice';
import { selectEffectiveTeamBuffs } from '@/shared/stores/selectors/account-selectors';

export { computeFarmRespecShouldSurface, deriveFarmPoolEntries };
export type {
  FarmPoolEntry,
  FarmRankingReason,
  FarmRankingResult,
  FarmRespecGate,
  FarmRespecGateReason,
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
    effectiveTeamBuffs: selectEffectiveTeamBuffs(state),
    teamBuffsOverride: state.teamBuffsOverride,
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
  };
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

export function buildAccount(state: PlannerStore): AccountShared {
  return buildFarmAccount(toFarmInputs(state));
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

// -------------------------------------------------------------------------------------------
// Farm Respec Advisor — Tier 1 gate, Tier 2 on-demand solve, staleness, and the board's
// re-rank row source.
// -------------------------------------------------------------------------------------------

/** Currently identical to {@link readFarmDepTuple}, kept as its own named entry point so the
 *  Tier 1/Tier 2 call sites read "the respec deps", not a re-derivation of the ranking ones. */
export function readFarmRespecDepTuple(state: PlannerStore) {
  return readFarmInputsRespecDepTuple(toFarmInputs(state));
}

export function getFarmRespecGateComputeCount(): number {
  return memo.gateComputeCount();
}

export function resetFarmRespecGateComputeCount(): void {
  memo.resetGateComputeCount();
}

/**
 * Tier 1. Same shape as {@link selectFarmRankingRows}, over the same
 * {@link readFarmDepTuple}-derived tuple. Returns the SAME object identity on a cache hit and
 * must be subscribed to WITHOUT `useShallow`, for the identical reason.
 */
export function selectFarmRespecGate(state: PlannerStore): FarmRespecGate {
  return memo.gate(toFarmInputs(state));
}

export function getFarmRespecSolveCount(): number {
  return memo.solveCount();
}

export function resetFarmRespecSolveCount(): void {
  memo.resetSolveCount();
}

/**
 * Tier 2 — the on-demand full solve. A PLAIN FUNCTION: not a selector, not memoized, and never
 * called during render. The ONLY caller is phases-slice.ts's `runFarmRespec` action, on an
 * explicit user event (the Optimize button). Calling this anywhere on the dependency-driven
 * render path is the exact hazard the split between the two tiers exists to prevent.
 */
export function runFarmRespecSolve(state: PlannerStore): FarmRespecResult {
  return memo.solve(toFarmInputs(state));
}

/** true iff a proposal exists AND its deps differ from the live tuple. */
export function selectFarmRespecIsStale(state: PlannerStore): boolean {
  const proposal = state.farmRespecProposal;
  if (!proposal) return false;
  return !farmDepsEqual(proposal.deps, readFarmRespecDepTuple(state));
}

/**
 * The proposal ONLY when it is fresh. A stale proposal is unrenderable BY CONSTRUCTION — no
 * effect, no subscription, no write-on-render clears it; this pure derivation simply never
 * hands it to a caller. Stable identity: returns the stored FarmRespecProposal object or null,
 * never a fresh wrapper.
 */
export function selectFarmRespecView(state: PlannerStore): FarmRespecProposal | null {
  const proposal = state.farmRespecProposal;
  if (!proposal) return null;
  return farmDepsEqual(proposal.deps, readFarmRespecDepTuple(state)) ? proposal : null;
}

/**
 * `'idle'` whenever the view is null (no fresh proposal to show — including a proposal made
 * stale by a later input change), whatever `state.farmRespecStatus` holds. This is how the
 * Optimize control re-arms after an input change without a second write path clearing
 * `farmRespecStatus` itself. Components that need the LIVE in-flight/failed state (busy
 * spinner, failure banner) read `state.farmRespecStatus` directly — this derivation answers a
 * different question ("is there a fresh result to show"), not "is a solve currently running".
 */
export function selectFarmRespecStatus(state: PlannerStore): FarmRespecStatus {
  return selectFarmRespecView(state) == null ? 'idle' : state.farmRespecStatus;
}

/** `state.farmRespecReRank && selectFarmRespecView(state) != null`. A boolean — safe to
 *  subscribe directly. Already `false` whenever no fresh proposal exists, so the re-rank toggle
 *  component needs no staleness logic of its own. */
export function selectFarmReRankActive(state: PlannerStore): boolean {
  return state.farmRespecReRank && selectFarmRespecView(state) != null;
}

export function getFarmRespecRowsComputeCount(): number {
  return memo.boardRowsComputeCount();
}

export function resetFarmRespecRowsComputeCount(): void {
  memo.resetBoardRowsComputeCount();
}

/**
 * The board's row source. Returns {@link selectFarmRankingRows}' OWN cached object identity
 * when re-rank is off — not a copy, not a wrapper — so the no-`useShallow` contract holds
 * unchanged. The proposed squad's table is computed ONLY on the proposed branch, memoized on
 * `[proposedSquad, state.maxPhase, state.farmReturnBonus]`.
 *
 * The MODE is deliberately NOT carried on this return value. Spreading the ranking result into
 * `{ ...result, mode }` allocates a fresh object on every call, which turns
 * `useSyncExternalStore` into an infinite render loop — the exact hazard
 * `deriveFarmPoolEntries`' own header warns about for a different selector. Read the mode
 * separately via {@link selectFarmReRankActive}.
 */
export function selectFarmBoardRows(state: PlannerStore): FarmRankingResult {
  if (!selectFarmReRankActive(state)) {
    return selectFarmRankingRows(state);
  }
  // Non-null: selectFarmReRankActive already proved selectFarmRespecView(state) != null.
  const proposal = selectFarmRespecView(state)!;
  return memo.boardRows(toFarmInputs(state), proposal.result.proposedSquad);
}

/** Convenience wrapper over `deriveFarmPoolEntries` for direct-state callers (tests). */
export function selectFarmPoolEntries(state: PlannerStore): FarmPoolEntry[] {
  return deriveFarmPoolEntries(state.heroes, state.farmPoolOverrides);
}

export const selectFarmReturnBonus = (state: PlannerStore) => state.farmReturnBonus;
