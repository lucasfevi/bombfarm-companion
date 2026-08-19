/**
 * Mode-aware next-point ranking: DPS mode reads the advisor pipeline's own ranking (zero extra
 * cost — this module is never entered); farm mode composes the rotation pool's already-extracted
 * bases with the LIVE draft basis (not the debounced-autosaved roster record, which lags the
 * editor) and scores the marginal farm objective over the whole squad.
 *
 * Three module-level single-entry memos, the same shape used four times already in
 * farm-ranking-selectors.ts, each returning a stable object identity on a cache hit so
 * components can subscribe without `useShallow`.
 */
import type { HeroFarmBasis } from '@bombfarm/domain/farm-point-rank';
import { computeHeroFarmBases, rankNextPointForFarm, type FarmPointRankOutcome } from '@bombfarm/domain/farm-point-rank';
import type { FarmObjective, FarmObjectiveKind } from '@bombfarm/domain/farm-optimize';
import type { PointValue, RankMode } from '@bombfarm/domain/model';
import type { PlannerStore } from '@/shared/stores/planner-store';
import type { HeroRecord } from '@/shared/lib/storage';
import { selectAdvisorPipeline } from '@/shared/stores/selectors/advisor-selectors';
import { selectEffectiveTeamBuffs } from '@/shared/stores/selectors/account-selectors';
import { selectHeroDraftTuple } from '@/shared/stores/persistence/persist-hero-draft';
import {
  readFarmDepTuple,
  resolveEnabledHeroIds,
  buildAccount,
} from '@/shared/stores/selectors/farm-ranking-selectors';

/** Same GOLD-share weight the Farm Ranking board's objective picker uses — item A collapses
 *  weight===1 to 'gold' and weight===0 to 'chests', so 0.5 is the only blend value either
 *  surface can ever emit. */
const FARM_BLEND_GOLD_WEIGHT = 0.5;

function toFarmObjective(kind: FarmObjectiveKind): FarmObjective {
  return kind === 'blend' ? { kind, weight: FARM_BLEND_GOLD_WEIGHT } : { kind };
}

function depsEqual(left: readonly unknown[], right: readonly unknown[]): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index++) {
    if (!Object.is(left[index], right[index])) return false;
  }
  return true;
}

// -----------------------------------------------------------------------------------------
// selectFarmPoolBases — the rotation pool's bases, EXCLUDING the active hero (its own basis
// comes from the live draft instead, via selectDraftFarmBasis below).
// -----------------------------------------------------------------------------------------

let poolBasesCache: { deps: readonly unknown[]; result: readonly HeroFarmBasis[] } | null = null;
let poolBasesComputeCount = 0;

export function resetFarmPoolBasesCache(): void {
  poolBasesCache = null;
}

export function getFarmPoolBasesComputeCount(): number {
  return poolBasesComputeCount;
}

export function resetFarmPoolBasesComputeCount(): void {
  poolBasesComputeCount = 0;
  resetFarmPoolBasesCache();
}

function readPoolBasesDepTuple(state: PlannerStore) {
  return [...readFarmDepTuple(state), state.activeHeroId] as const;
}

export function selectFarmPoolBases(state: PlannerStore): readonly HeroFarmBasis[] {
  const deps = readPoolBasesDepTuple(state);
  if (poolBasesCache && depsEqual(poolBasesCache.deps, deps)) {
    return poolBasesCache.result;
  }
  poolBasesComputeCount += 1;
  const enabledHeroIds = resolveEnabledHeroIds(state).filter((heroId) => heroId !== state.activeHeroId);
  const result = computeHeroFarmBases({
    heroes: state.heroes,
    account: buildAccount(state),
    enabledHeroIds,
  });
  poolBasesCache = { deps, result };
  return result;
}

// -----------------------------------------------------------------------------------------
// selectDraftFarmBasis — the ONE basis for the hero currently being edited, built from the
// SAME projection the debounced autosave stages (buildHeroRecord), so farm advice tracks the
// editor rather than lagging by up to AUTOSAVE_MS.
// -----------------------------------------------------------------------------------------

let draftBasisCache: { deps: readonly unknown[]; result: HeroFarmBasis | null } | null = null;
let draftBasisComputeCount = 0;

export function resetDraftFarmBasisCache(): void {
  draftBasisCache = null;
}

export function getDraftFarmBasisComputeCount(): number {
  return draftBasisComputeCount;
}

export function resetDraftFarmBasisComputeCount(): void {
  draftBasisComputeCount = 0;
  resetDraftFarmBasisCache();
}

/** The account-shaped members of readFarmDepTuple only — NOT farmPoolOverrides/farmReturnBonus,
 *  neither of which affects a single hero's own extracted basis. `heroes` itself is NOT listed
 *  directly (unlike `readFarmDepTuple`): `selectEffectiveTeamBuffs` below is the one way the
 *  full roster can affect this single hero's basis (issue #132 — the derived team-buffs total),
 *  and it already returns a stable reference keyed on `heroes`, so depending on ITS result
 *  covers that without a second, bulkier `state.heroes` entry here. */
function readDraftBasisDepTuple(state: PlannerStore) {
  return [
    ...selectHeroDraftTuple(state),
    state.treeDanoTotal,
    state.treeCritChance,
    state.treeCritDmg,
    state.treeSpeed,
    state.treeEnergy,
    state.treeTeamCoinPct,
    state.treeLuckFlatPct,
    selectEffectiveTeamBuffs(state),
    state.houseIdx,
    state.houseLevel,
    state.slots,
    state.maxPhase,
  ] as const;
}

export function selectDraftFarmBasis(state: PlannerStore): HeroFarmBasis | null {
  const deps = readDraftBasisDepTuple(state);
  if (draftBasisCache && depsEqual(draftBasisCache.deps, deps)) {
    return draftBasisCache.result;
  }
  draftBasisComputeCount += 1;
  const activeHeroId = state.activeHeroId;
  let result: HeroFarmBasis | null = null;
  if (activeHeroId != null) {
    const draft = state.buildHeroRecord(activeHeroId);
    const draftRecord: HeroRecord = { ...draft, id: activeHeroId, updatedAt: 0 };
    result = computeHeroFarmBases({
      heroes: [draftRecord],
      account: buildAccount(state),
      enabledHeroIds: [activeHeroId],
    })[0] ?? null;
  }
  draftBasisCache = { deps, result };
  return result;
}

// -----------------------------------------------------------------------------------------
// selectNextPointRanking — the panel's actual data source.
// -----------------------------------------------------------------------------------------

export type NextPointRanking = {
  /** Always 7 — never null at this layer. */
  rows: readonly PointValue[];
  /** What was ASKED for. */
  mode: RankMode;
  /** null when mode === 'dps', or when farm ranking succeeded. */
  fallback: FarmPointRankOutcome | null;
  /** true when the edited hero is not in the rotation pool and was ranked as if added. */
  addedToPool: boolean;
  phase: number | null;
};

let nextPointCache: { deps: readonly unknown[]; result: NextPointRanking } | null = null;
let nextPointComputeCount = 0;
/** Increments once per ACTUAL rankNextPointForFarm call — 0 for an entire DPS-mode render,
 *  the sensor a fallback-shaped result would otherwise hide (a DPS render also recomputes this
 *  memo once, but never reaches the farm domain call). */
let farmRankComputeCount = 0;

export function resetNextPointRankingCache(): void {
  nextPointCache = null;
}

export function getNextPointRankingComputeCount(): number {
  return nextPointComputeCount;
}

export function resetNextPointRankingComputeCount(): void {
  nextPointComputeCount = 0;
  resetNextPointRankingCache();
}

export function getFarmRankComputeCount(): number {
  return farmRankComputeCount;
}

export function resetFarmRankComputeCount(): void {
  farmRankComputeCount = 0;
}

function dpsFallback(mode: RankMode, fallback: FarmPointRankOutcome | null, pipelineRanking: readonly PointValue[]): NextPointRanking {
  return { rows: pipelineRanking, mode, fallback, addedToPool: false, phase: null };
}

/** Splices `draftBasis` into `poolBases` at the active hero's roster position (or appends it
 *  when the hero is disabled in the pool, `addedToPool = true`) — see design's §5.2 for why
 *  order matters (squad reductions are float sums). */
function composeBases(
  state: PlannerStore,
  poolBases: readonly HeroFarmBasis[],
  draftBasis: HeroFarmBasis,
  activeHeroId: string,
): { bases: HeroFarmBasis[]; addedToPool: boolean } {
  const enabledIds = new Set(resolveEnabledHeroIds(state));
  const activeEnabled = enabledIds.has(activeHeroId);
  const basisById = new Map(poolBases.map((basis) => [basis.heroId, basis]));
  const bases: HeroFarmBasis[] = [];
  for (const hero of state.heroes) {
    if (hero.id === activeHeroId) {
      if (activeEnabled) bases.push(draftBasis);
      continue;
    }
    if (!enabledIds.has(hero.id)) continue;
    const basis = basisById.get(hero.id);
    if (basis) bases.push(basis);
  }
  if (!activeEnabled) bases.push(draftBasis);
  return { bases, addedToPool: !activeEnabled };
}

function computeNextPointRanking(state: PlannerStore): NextPointRanking {
  const pipeline = selectAdvisorPipeline(state);
  if (state.rankMode === 'dps') {
    return { rows: pipeline.ranking, mode: 'dps', fallback: null, addedToPool: false, phase: null };
  }

  // No roster at all — short-circuited before the domain call, same shape as
  // computeFarmRanking's own 'no-roster' check in farm-ranking-selectors.ts. Checked BEFORE
  // activeHeroId, because an empty roster is the state a brand-new user with an unsaved draft
  // and no activeHeroId is actually in.
  if (state.heroes.length === 0) {
    return dpsFallback('farm', 'emptyPool', pipeline.ranking);
  }

  const activeHeroId = state.activeHeroId;
  if (activeHeroId == null) {
    // Heroes exist but none is selected — the panel that renders this has no hero to show
    // advice for in the first place. Defensive: reuses heroNotInPool rather than inventing a
    // new outcome for a state the UI does not normally reach.
    return dpsFallback('farm', 'heroNotInPool', pipeline.ranking);
  }

  const draftBasis = selectDraftFarmBasis(state);
  if (draftBasis == null) {
    return dpsFallback('farm', 'heroNotInPool', pipeline.ranking);
  }

  const poolBases = selectFarmPoolBases(state);
  const { bases, addedToPool } = composeBases(state, poolBases, draftBasis, activeHeroId);
  if (bases.length === 0) {
    return dpsFallback('farm', 'emptyPool', pipeline.ranking);
  }

  farmRankComputeCount += 1;
  const result = rankNextPointForFarm({
    bases,
    account: buildAccount(state),
    heroId: activeHeroId,
    objective: toFarmObjective(state.farmObjective),
    maxPhase: state.maxPhase,
    returnBonus: state.farmReturnBonus,
  });

  if (result.outcome !== 'ranked' || result.rows === null) {
    return { rows: pipeline.ranking, mode: 'farm', fallback: result.outcome, addedToPool, phase: null };
  }
  return { rows: result.rows, mode: 'farm', fallback: null, addedToPool, phase: result.phase };
}

/**
 * Branches on `state.rankMode` BEFORE reading `selectFarmPoolBases`/`selectDraftFarmBasis` —
 * under DPS mode those two memos are never invoked at all (not even to read a cached value),
 * so a DPS user pays exactly today's pipeline cost. This is what makes the farm compute
 * counter provably `0` through a whole DPS-mode render, not merely small.
 */
function readNextPointDepTuple(state: PlannerStore) {
  const pipeline = selectAdvisorPipeline(state);
  if (state.rankMode === 'dps') {
    return ['dps', pipeline] as const;
  }
  return [
    'farm',
    selectFarmPoolBases(state),
    selectDraftFarmBasis(state),
    state.farmObjective,
    state.maxPhase,
    state.farmReturnBonus,
    pipeline,
  ] as const;
}

/**
 * The panel's row source, mode-dispatched. Under `rankMode: 'dps'` the farm path is never
 * entered — `readNextPointDepTuple` and `computeNextPointRanking` both branch on the mode
 * before touching `selectFarmPoolBases`/`selectDraftFarmBasis`'s own compute paths for
 * anything beyond the memo dependency read, so a DPS user pays exactly today's cost.
 */
export function selectNextPointRanking(state: PlannerStore): NextPointRanking {
  const deps = readNextPointDepTuple(state);
  if (nextPointCache && depsEqual(nextPointCache.deps, deps)) {
    return nextPointCache.result;
  }
  nextPointComputeCount += 1;
  const result = computeNextPointRanking(state);
  nextPointCache = { deps, result };
  return result;
}

export const selectNextPointBest = (state: PlannerStore) => selectNextPointRanking(state).rows[0];
export const selectBestStat = (state: PlannerStore) => selectNextPointBest(state).stat;
export const selectBestGainPct = (state: PlannerStore) => selectNextPointBest(state).gainPct;
