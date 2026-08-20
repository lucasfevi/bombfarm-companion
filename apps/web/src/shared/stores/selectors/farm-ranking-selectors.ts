// The ONLY file in apps/web that imports @bombfarm/domain/farm-rate (enforced by a structural
// guard — see farm-ranking-guards.test.ts guard (f); the
// type-only ReturnBonusMode import in shared/lib/phases-view-storage.ts is the sole allowlisted
// exception). computeFarmRates is @bombfarm/domain's own stated convenience entry point — it
// fixes the facts -> squad -> rows ordering in one place. Do NOT hand-compose
// computeHeroFarmFacts + computeSquadFarmFacts + computeFarmRateTable here:
// that re-creates the domain package's ordering contract in a second place for no benefit. returnBonusMultiplier
// and E_D_CELLS are intentionally never imported — this surface never applies a multiplier or a
// cadence constant itself.
import { computeFarmRates, computeFarmRateTable, type FarmRateRow } from '@bombfarm/domain/farm-rate';
// This file is ALSO the only apps/web file that imports a runtime binding from
// @bombfarm/domain/farm-optimize (guard (g), farm-ranking-guards.test.ts). resolveFarmObjective,
// farmObjectiveValue and bestFarmPhase are deliberately NOT imported — that surface belongs to
// the next-point ranking mode, not to this recommendation seam. respecCostGold is not imported
// either: every cost this surface renders is already a field on a FarmRespecResult/
// FarmRespecHeroEntry.
import {
  gateFarmRespec,
  solveFarmRespec,
  FARM_RESPEC_MIN_GAIN_PCT,
  type FarmRespecResult,
} from '@bombfarm/domain/farm-optimize';
import type { AccountShared } from '@/shared/lib/storage';
import type { PlannerStore } from '@/shared/stores/planner-store';
import type { FarmRespecProposal, FarmRespecStatus } from '@/shared/stores/slices/phases-slice';
import { selectEffectiveTeamBuffs } from '@/shared/stores/selectors/account-selectors';

export type FarmRankingReason = 'no-roster' | 'no-heroes-enabled' | 'compute-failed';

export type FarmRankingResult = {
  rows: readonly FarmRateRow[];
  /** `null` on a real compute; a named reason when rows is deliberately empty. */
  reason: FarmRankingReason | null;
};

const EMPTY_ROWS: readonly FarmRateRow[] = [];

/**
 * The dependency-tuple traceability artifact: every planner edit the board must react to.
 * 19 members — `fieldSlots` and `houseCycleSecs` joined at the House-ceiling fix: the first is
 * the FIELD concurrency cap (`skills.field_slots`, a different quantity from `slots`, which is
 * the House's RECOVERY cap), the second is the House cycle that every hero's uptime divides by.
 * `houseCycleSecsHouseIdx`/`houseCycleSecsLevel` joined at the same fix's regression repair: the
 * (house, level) `houseCycleSecs` is anchored to, snapshotted separately from the live
 * `houseIdx`/`houseLevel` picker above so `resolveHouseRestSeconds` can tell a picker move from
 * the account's own imported configuration — omitting either from this tuple would leave the
 * board computing against a stale anchor after a re-import. `maxPhase` is here because
 * `FarmRateOptions.maxPhase` is what sets `FarmRateRow.locked` (a COMPUTE INPUT, not a
 * post-compute filter; an earlier design draft treating it as a filter would have made
 * `row.locked` permanently `false`). A field missing from this tuple is a planner edit that
 * silently does not recompute the board.
 *
 * The converse obligation falls on PRODUCERS: members compared by reference here (`heroes`,
 * `teamBuffs`, `farmPoolOverrides`) must be identity-stable across a write that changed nothing.
 * `depsEqual` compares with `Object.is`, so a fresh-but-equal array or object reads exactly like a
 * real edit — it drops a live respec proposal with no error surfaced. For `heroes` that obligation
 * is met by every roster producer in `shared/lib/storage.ts` — `patchHeroInList` (the 700ms
 * autosave path, the guard that cost the most to find), `importHeroes` (the save-import path), and
 * `writeHeroBattleAllowed` (`stores/persistence/persist-roster.ts`) — each returning the SAME
 * array when nothing changed. The matching consumer half is `commitRoster` in
 * `stores/slices/roster-slice.ts`, the single writer of `state.heroes`, which declines to `set`
 * on an unchanged reference. A new roster producer owes both halves.
 */
export function readFarmDepTuple(state: PlannerStore) {
  return [
    state.heroes,
    state.treeDanoTotal,
    state.treeCritChance,
    state.treeCritDmg,
    state.treeSpeed,
    state.treeEnergy,
    state.treeTeamCoinPct,
    state.treeLuckFlatPct,
    // The effective (override-or-derived) roster total, issue #132 — `state.heroes` above
    // already covers the "derive" half; this also invalidates on an override edit.
    selectEffectiveTeamBuffs(state),
    state.houseIdx,
    state.houseLevel,
    state.slots,
    state.fieldSlots,
    state.houseCycleSecs,
    state.houseCycleSecsHouseIdx,
    state.houseCycleSecsLevel,
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
  gateCache = null;
  boardRowsCache = null;
}

export function getFarmRankingComputeCount(): number {
  return computeCount;
}

export function resetFarmRankingComputeCount(): void {
  computeCount = 0;
  resetFarmRankingCache();
}

/** `overrides[id] ?? (hero.battleAllowed ?? true)` — absence follows the save. */
export function resolveEnabledHeroIds(state: PlannerStore): string[] {
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
export function buildAccount(state: PlannerStore): AccountShared {
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
    // Issue #132: the roster-wide total is DERIVED from state.heroes by default (an override,
    // when set, wins) — never the stale, silently-zero stored field a fresh import used to
    // leave every carrier's own aura at 0% until someone found the auto-fill button.
    teamBuffs: selectEffectiveTeamBuffs(state),
    context: {
      houseIdx: state.houseIdx,
      houseLevel: state.houseLevel,
      phase: null,
      mitigationPct: 1,
      rankMode: 'dps',
      targetProp: 'stone',
    },
    slots: state.slots,
    fieldSlots: state.fieldSlots,
    houseCycleSecs: state.houseCycleSecs,
    houseCycleSecsHouseIdx: state.houseCycleSecsHouseIdx,
    houseCycleSecsLevel: state.houseCycleSecsLevel,
    maxPhase: state.maxPhase,
  };
}

function computeFarmRanking(state: PlannerStore): FarmRankingResult {
  // The empty pool is short-circuited BEFORE the call, never delegated. @bombfarm/domain's
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
 * Module-level single-entry memoized selector (MOD-18 shape). Returns the SAME object
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

// -------------------------------------------------------------------------------------------
// Farm Respec Advisor — Tier 1 gate, Tier 2 on-demand solve, staleness, and the board's
// re-rank row source. Everything below is additive; selectFarmRankingRows and
// readFarmDepTuple above are not edited.
// -------------------------------------------------------------------------------------------

/**
 * The gate/solve dependency tuple. With the objective picker gone, the Respec Advisor's
 * recommendation depends on nothing the ranking board doesn't already — this is currently
 * identical to {@link readFarmDepTuple}, kept as its own named entry point so the Tier 1/Tier 2
 * call sites read "the respec deps", not a re-derivation of the ranking ones.
 */
export function readFarmRespecDepTuple(state: PlannerStore) {
  return readFarmDepTuple(state);
}

function buildFarmRespecInput(state: PlannerStore, enabledHeroIds: readonly string[]) {
  return {
    heroes: state.heroes,
    account: buildAccount(state),
    enabledHeroIds,
    maxPhase: state.maxPhase,
    returnBonus: state.farmReturnBonus,
  };
}

export type FarmRespecGateReason = 'no-roster' | 'no-heroes-enabled' | 'gate-failed';

export type FarmRespecGate = {
  /** null when `reason` is set. */
  result: FarmRespecResult | null;
  reason: FarmRespecGateReason | null;
  /** `result != null && result.gainPct >= FARM_RESPEC_MIN_GAIN_PCT`. `paybackHours` is NOT read
   *  here, at any value including null — gain is the only gate. */
  shouldSurface: boolean;
};

/** The one expression `shouldSurface` is built from. `paybackHours` is deliberately never read
 *  here, at any value including `null` — gain alone gates the recommendation; payback is
 *  reported, never used to suppress it. Exported so this exact formula, not a re-derivation of
 *  it, is what the visibility test drives. */
export function computeFarmRespecShouldSurface(result: FarmRespecResult): boolean {
  return result.gainPct >= FARM_RESPEC_MIN_GAIN_PCT;
}

let gateCache: { deps: readonly unknown[]; gate: FarmRespecGate } | null = null;
let gateComputeCount = 0;

export function getFarmRespecGateComputeCount(): number {
  return gateComputeCount;
}

export function resetFarmRespecGateComputeCount(): void {
  gateComputeCount = 0;
  gateCache = null;
}

function computeFarmRespecGate(state: PlannerStore): FarmRespecGate {
  // The empty-pool short-circuits are repeated BEFORE the domain call, never delegated —
  // mirrors computeFarmRanking above, and saves a pipeline call item A would otherwise spend
  // reporting the same named-nothing answer.
  if (state.heroes.length === 0) {
    return { result: null, reason: 'no-roster', shouldSurface: false };
  }
  const enabledHeroIds = resolveEnabledHeroIds(state);
  if (enabledHeroIds.length === 0) {
    return { result: null, reason: 'no-heroes-enabled', shouldSurface: false };
  }
  try {
    const result = gateFarmRespec(buildFarmRespecInput(state, enabledHeroIds));
    return { result, reason: null, shouldSurface: computeFarmRespecShouldSurface(result) };
  } catch {
    // Caught at THIS boundary only. Item A never throws by contract; this renders a named
    // degraded state instead of a silent absence.
    return { result: null, reason: 'gate-failed', shouldSurface: false };
  }
}

/**
 * Module-level single-entry memo — Tier 1. Same shape as {@link selectFarmRankingRows}, over
 * the same {@link readFarmDepTuple}-derived tuple. Returns the SAME object identity on a cache
 * hit and must be subscribed to WITHOUT `useShallow`, for the identical reason
 * `selectFarmRankingRows` is.
 */
export function selectFarmRespecGate(state: PlannerStore): FarmRespecGate {
  const deps = readFarmRespecDepTuple(state);
  if (gateCache && depsEqual(gateCache.deps, deps)) {
    return gateCache.gate;
  }
  gateComputeCount += 1;
  const gate = computeFarmRespecGate(state);
  gateCache = { deps, gate };
  return gate;
}

let solveCount = 0;

export function getFarmRespecSolveCount(): number {
  return solveCount;
}

export function resetFarmRespecSolveCount(): void {
  solveCount = 0;
}

/**
 * Tier 2 — the on-demand full solve. A PLAIN FUNCTION: not a selector, not memoized, and never
 * called during render. The ONLY caller is phases-slice.ts's `runFarmRespec` action, on an
 * explicit user event (the Optimize button). Calling this anywhere on the dependency-driven
 * render path is the exact hazard the split between this file's two tiers exists to prevent.
 */
export function runFarmRespecSolve(state: PlannerStore): FarmRespecResult {
  solveCount += 1;
  const enabledHeroIds = resolveEnabledHeroIds(state);
  return solveFarmRespec(buildFarmRespecInput(state, enabledHeroIds));
}

/** true iff a proposal exists AND its deps differ from the live tuple. */
export function selectFarmRespecIsStale(state: PlannerStore): boolean {
  const proposal = state.farmRespecProposal;
  if (!proposal) return false;
  return !depsEqual(proposal.deps, readFarmRespecDepTuple(state));
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
  return depsEqual(proposal.deps, readFarmRespecDepTuple(state)) ? proposal : null;
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

let boardRowsCache: { deps: readonly unknown[]; result: FarmRankingResult } | null = null;
let boardRowsComputeCount = 0;

export function getFarmRespecRowsComputeCount(): number {
  return boardRowsComputeCount;
}

export function resetFarmRespecRowsComputeCount(): void {
  boardRowsComputeCount = 0;
  boardRowsCache = null;
}

/**
 * The board's row source. Returns {@link selectFarmRankingRows}' OWN cached object identity
 * when re-rank is off — not a copy, not a wrapper — so the no-`useShallow` contract holds
 * unchanged. `computeFarmRateTable` is called ONLY on the proposed branch, memoized on
 * `[proposedSquad, state.maxPhase, state.farmReturnBonus]`.
 *
 * The MODE is deliberately NOT carried on this return value. Spreading the ranking result into
 * `{ ...result, mode }` allocates a fresh object on every call, which turns
 * `useSyncExternalStore` into an infinite render loop — the exact hazard
 * `deriveFarmPoolEntries`' header above already warns about for a different selector. Read the
 * mode separately via {@link selectFarmReRankActive}.
 */
export function selectFarmBoardRows(state: PlannerStore): FarmRankingResult {
  if (!selectFarmReRankActive(state)) {
    return selectFarmRankingRows(state);
  }
  // Non-null: selectFarmReRankActive already proved selectFarmRespecView(state) != null.
  const proposal = selectFarmRespecView(state)!;
  const squad = proposal.result.proposedSquad;
  const deps = [squad, state.maxPhase, state.farmReturnBonus] as const;
  if (boardRowsCache && depsEqual(boardRowsCache.deps, deps)) {
    return boardRowsCache.result;
  }
  boardRowsComputeCount += 1;
  const rows = computeFarmRateTable(squad, {
    maxPhase: state.maxPhase,
    returnBonus: state.farmReturnBonus,
  });
  const result: FarmRankingResult = { rows, reason: null };
  boardRowsCache = { deps, result };
  return result;
}

export type FarmPoolEntry = {
  heroId: string;
  heroName: string;
  /** `overrides[id] ?? (battleAllowed ?? true)` — the same resolution `computeFarmRates` uses. */
  enabled: boolean;
};

/**
 * Pure derivation, one entry per roster hero in roster order — the rotation-pool chip row's
 * data source. NOT a store selector: it allocates a new array every call, so a component must
 * wrap it in its own `useMemo` keyed on `heroes`/`farmPoolOverrides` (both already-stable store
 * references) rather than subscribing to it directly via `usePlannerStore` — a selector that
 * returns a fresh array on every invocation makes `useSyncExternalStore` re-render forever.
 */
export function deriveFarmPoolEntries(
  heroes: PlannerStore['heroes'],
  farmPoolOverrides: PlannerStore['farmPoolOverrides'],
): FarmPoolEntry[] {
  return heroes.map((hero) => ({
    heroId: hero.id,
    heroName: hero.name,
    enabled: farmPoolOverrides[hero.id] ?? (hero.battleAllowed ?? true),
  }));
}

/** Convenience wrapper over {@link deriveFarmPoolEntries} for direct-state callers (tests). */
export function selectFarmPoolEntries(state: PlannerStore): FarmPoolEntry[] {
  return deriveFarmPoolEntries(state.heroes, state.farmPoolOverrides);
}

export const selectFarmReturnBonus = (state: PlannerStore) => state.farmReturnBonus;
