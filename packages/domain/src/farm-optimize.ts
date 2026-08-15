/**
 * The farm-respec solver's public surface: result types, `solveFarmRespec` (Tier 2, on demand)
 * and `gateFarmRespec` (Tier 1, always-on). Both turn a roster + account + objective into a
 * joint per-hero build x phase recommendation, bounded by a named, exported evaluation budget.
 *
 * Every exported function here is pure: same arguments, same result, no memo cache, no
 * module-level mutable state, no clock, no `Math.random`. Re-running the solver on its own
 * proposed build is a fixed point (`FRAD-16`) — the same non-compounding property `reoptBudget`
 * was fixed for. `pts.luck` is never touched (`OD-A1`'s luck-freeze, restated without the id):
 * Luck sits outside the seven reallocatable stat keys structurally, not by a runtime check.
 */
import type { HeroRecord, AccountShared } from './shims/storage';
import type { SheetKey } from './planner-constants';
import {
  computeHeroFarmBases,
  heroFactsFromBasis,
  squadFactsFromBases,
  type HeroFarmBasis,
  type HeroFarmFacts,
  type SquadFarmFacts,
  type FarmRateOptions,
  type ReturnBonusMode,
} from './farm-rate';
import {
  resolveFarmObjective,
  bestFarmPhase,
  type FarmObjective,
  type ResolvedFarmObjective,
  type FarmObjectiveScales,
  type FarmPhasePick,
} from './farm-optimize-objective';
import { reoptBudget, REOPT_KEYS } from './points-reopt-core';
import { respecCostGold } from './respec-cost';
import {
  runFarmSearch,
  type PtsAssignment,
  FARM_OPT_FULL_MAX_EVALUATIONS,
  FARM_OPT_JOINT_BUDGET_SHARE,
} from './farm-optimize-search';

export {
  FARM_OPT_MAX_SWEEPS,
  FARM_OPT_GATE_PHASE_STRIDE,
  FARM_OPT_SEED_ENERGY_SHARES,
  FARM_OPT_PLATEAU_SHARES,
  FARM_OPT_PLATEAU_TOLERANCE_PCT,
  FARM_OPT_FRONTIER_CANDIDATES,
  FARM_OPT_GATE_MAX_EVALUATIONS,
  FARM_OPT_FULL_MAX_EVALUATIONS,
  FARM_OPT_JOINT_BUDGET_SHARE,
} from './farm-optimize-search';
export { resolveFarmObjective, farmObjectiveValue, bestFarmPhase } from './farm-optimize-objective';
export type {
  FarmObjective,
  FarmObjectiveKind,
  FarmObjectiveUnit,
  ResolvedFarmObjective,
  FarmObjectiveScales,
  FarmPhasePick,
} from './farm-optimize-objective';

/** PERCENT. The only gate on whether a recommendation is surfaced. Payback never gates. */
export const FARM_RESPEC_MIN_GAIN_PCT = 1;

export type FarmRespecOutcome =
  | 'improved' // a strictly better build was found
  | 'nothingToGain' // searched, current build wins (keptCurrent, gainPct 0)
  | 'emptyPool' // no enabled hero
  | 'allDegenerate' // every enabled hero is degenerate
  | 'noBudget' // every enabled hero has reoptBudget 0
  | 'noFeasiblePhase'; // no phase in [1, maxPhase] is feasible under any candidate

export type FarmRespecHeroEntry = {
  heroId: string;
  heroName: string;
  level: number;
  /** Full 8-key CURRENT allocation. */
  currentPts: Record<SheetKey, number>;
  /** Full 8-key ABSOLUTE TARGET allocation — sufficient to re-spend from zero after an in-game
   *  refund. No key is omitted for being unchanged. `luck` always equals `currentPts.luck`. */
  proposedPts: Record<SheetKey, number>;
  /** True iff `proposedPts` differs from `currentPts` on any of the seven reallocatable keys. */
  changed: boolean;
  /** `Σ |proposed − current|` over the seven reallocatable keys. 0 when unchanged. */
  pointsMoved: number;
  /** ABSOLUTE GOLD, `1000 × level`, reported for EVERY hero — for an unchanged hero this is the
   *  gold the player is told they need NOT spend. Only changed heroes enter the top-level total. */
  respecCostGold: number;
  /** The estimator's own verdict — a degenerate hero is excluded from the search and pinned. */
  degenerate: boolean;
  /** False when the hero is degenerate or its budget is 0; such heroes are pinned to current. */
  searchable: boolean;
};

/** All FRACTIONS except `tolerancePct`, which is a PERCENT. */
export type FarmRespecPlateau = {
  /** Lowest squad energy share scoring within tolerance of the optimum, on the probed grid. */
  minEnergyShare: number;
  /** Highest such share. Equals `minEnergyShare` when no neighbour qualifies (never null). */
  maxEnergyShare: number;
  tolerancePct: number;
  /** The current build's squad energy share, for item B's "you are here" marker. */
  currentEnergyShare: number;
  /** The proposed build's squad energy share. Always inside `[min, max]`. */
  proposedEnergyShare: number;
};

export type FarmRespecFrontierEntry = {
  /** 1 or 2 — the tier. */
  heroCount: number;
  /** The hero ids this tier was allowed to move, ascending. */
  heroIds: readonly string[];
  /** One entry per ENABLED hero, same shape and same rules as the top-level list. */
  heroes: readonly FarmRespecHeroEntry[];
  recommendedPhase: number | null;
  proposedObjective: number;
  /** PERCENT, `>= 0`. */
  gainPct: number;
  /** ABSOLUTE GOLD, summed over CHANGED heroes only. */
  respecCostGold: number;
  /** HOURS, or null when `proposedGoldPerHour <= currentGoldPerHour`. */
  paybackHours: number | null;
  proposedGoldPerHour: number;
  proposedChestsPerHour: number;
};

export type FarmRespecResult = {
  objective: ResolvedFarmObjective;
  tier: 'gate' | 'full';
  /** true for Tier 1 (a lower bound), false for Tier 2 (best found). */
  gainIsLowerBound: boolean;
  outcome: FarmRespecOutcome;
  keptCurrent: boolean;

  /** The phase to farm under the PROPOSED build. null when nothing is feasible. */
  recommendedPhase: number | null;
  /** The phase to farm under the CURRENT build — item B's before/after. */
  currentPhase: number | null;

  /** In `objective.unit`. */
  currentObjective: number;
  proposedObjective: number;
  /** PERCENT, `>= 0` by construction. 0 when `currentObjective <= 0`. */
  gainPct: number;

  /** Always gold/hr and chests/hr, each at its own side's recommended phase, whatever the
   *  objective — item B renders these regardless of what was optimized. */
  currentGoldPerHour: number;
  proposedGoldPerHour: number;
  currentChestsPerHour: number;
  proposedChestsPerHour: number;

  /** ABSOLUTE GOLD, summed over CHANGED heroes only. 0 when `keptCurrent`. */
  respecCostGold: number;
  /** HOURS. `respecCostGold / (proposedGoldPerHour - currentGoldPerHour)`, always denominated in
   *  GOLD whatever the objective. null when the denominator is `<= 0` or non-finite — reachable
   *  under `'chests'`. Never negative, never `Infinity`. */
  paybackHours: number | null;

  /** EVERY enabled hero, in `heroes` input order — not only the changed ones. */
  heroes: readonly FarmRespecHeroEntry[];
  /** Best 1-hero and best 2-hero respec, ASCENDING by `respecCostGold`. A tier is omitted when
   *  its hero count is not strictly less than the searchable-hero count. Empty for `<= 1`. */
  frontier: readonly FarmRespecFrontierEntry[];
  /** Always reported when there is a squad — including when `keptCurrent` (the region around the
   *  current build). null only for `emptyPool` / `allDegenerate`. */
  plateau: FarmRespecPlateau | null;

  /** Evaluations spent across the WHOLE call, joint solve plus every frontier re-solve. */
  evaluations: number;
  /** True when an evaluation or sweep bound truncated any part of the search. */
  budgetExhausted: boolean;
  /** Which seed produced the descent start. */
  winningSeed: string;
  /** Outer coordinate-descent sweeps consumed by the joint solve. */
  sweeps: number;

  /** Squad facts under the PROPOSED build. Item B re-ranks the 600-row table with
   *  `computeFarmRateTable(proposedSquad, options)` at ZERO extra pipeline calls. */
  proposedSquad: SquadFarmFacts;
  /** Squad facts under the CURRENT build, for the same reason. */
  currentSquad: SquadFarmFacts;
};

export type FarmRespecInput = {
  heroes: readonly HeroRecord[];
  account: AccountShared;
  /** Rotation pool. Same semantics as `FarmFactsInput`: null/omitted ⇒ `battleAllowed !== false`;
   *  an explicit `[]` is an EMPTY pool; unknown ids are ignored. */
  enabledHeroIds?: readonly string[] | null;
  /** Default `{ kind: 'gold' }`. */
  objective?: FarmObjective | null;
  /** null / non-positive / non-finite ⇒ every phase in `[1, 600]` is a candidate. */
  maxPhase?: number | null;
  /** Default `'off'`, matching the estimator. */
  returnBonus?: ReturnBonusMode;
};

function buildHeroEntries(
  bases: readonly HeroFarmBasis[],
  currentFactsById: ReadonlyMap<string, HeroFarmFacts>,
  budgetById: ReadonlyMap<string, number>,
  winnerAssignment: PtsAssignment | null,
): FarmRespecHeroEntry[] {
  return bases.map((basis) => {
    const proposedPtsSource = winnerAssignment?.get(basis.heroId) ?? basis.pts;
    const proposedPts: Record<SheetKey, number> = { ...proposedPtsSource, luck: basis.pts.luck };
    const changed = REOPT_KEYS.some((key) => proposedPts[key] !== basis.pts[key]);
    const pointsMoved = REOPT_KEYS.reduce((sum, key) => sum + Math.abs(proposedPts[key] - basis.pts[key]), 0);
    const facts = currentFactsById.get(basis.heroId)!;
    const budget = budgetById.get(basis.heroId) ?? 0;
    return {
      heroId: basis.heroId,
      heroName: basis.heroName,
      level: basis.level,
      currentPts: { ...basis.pts },
      proposedPts,
      changed,
      pointsMoved,
      respecCostGold: respecCostGold(basis.level),
      degenerate: facts.degenerate,
      searchable: !facts.degenerate && budget > 0,
    };
  });
}

function assembleResult(params: {
  objective: ResolvedFarmObjective;
  outcome: FarmRespecOutcome;
  keptCurrent: boolean;
  heroEntries: FarmRespecHeroEntry[];
  currentPick: FarmPhasePick | null;
  proposedPick: FarmPhasePick | null;
  currentSquad: SquadFarmFacts;
  proposedSquad: SquadFarmFacts;
  evaluations: number;
  budgetExhausted: boolean;
  winningSeed: string;
  sweeps: number;
  tier: 'gate' | 'full';
  gainIsLowerBound: boolean;
  frontier: FarmRespecFrontierEntry[];
  plateau: FarmRespecPlateau | null;
}): FarmRespecResult {
  const {
    objective,
    outcome,
    keptCurrent,
    heroEntries,
    currentPick,
    proposedPick,
    currentSquad,
    proposedSquad,
    evaluations,
    budgetExhausted,
    winningSeed,
    sweeps,
    tier,
    gainIsLowerBound,
    frontier,
    plateau,
  } = params;

  const currentPhase = currentPick ? currentPick.phase : null;
  const currentObjective = currentPick ? currentPick.value : 0;
  const currentGoldPerHour = currentPick ? currentPick.row.goldPerHour : 0;
  const currentChestsPerHour = currentPick ? currentPick.row.chestsPerHour : 0;

  const recommendedPhase = proposedPick ? proposedPick.phase : null;
  // FRAD-20e: no fabricated value — 0, never NaN/Infinity, when nothing is feasible.
  const proposedObjective = proposedPick ? proposedPick.value : 0;
  const proposedGoldPerHour = proposedPick ? proposedPick.row.goldPerHour : 0;
  const proposedChestsPerHour = proposedPick ? proposedPick.row.chestsPerHour : 0;

  // FRAD-20f: currentObjective <= 0 ⇒ gainPct 0, never a division by zero.
  const gainPct = currentObjective > 0 ? Math.max(0, (proposedObjective / currentObjective - 1) * 100) : 0;

  const respecCostGoldTotal = heroEntries.filter((h) => h.changed).reduce((sum, h) => sum + h.respecCostGold, 0);

  const deltaGold = proposedGoldPerHour - currentGoldPerHour;
  const paybackHours = deltaGold > 0 && Number.isFinite(deltaGold) ? respecCostGoldTotal / deltaGold : null;

  return {
    objective,
    tier,
    gainIsLowerBound,
    outcome,
    keptCurrent,
    recommendedPhase,
    currentPhase,
    currentObjective,
    proposedObjective,
    gainPct,
    currentGoldPerHour,
    proposedGoldPerHour,
    currentChestsPerHour,
    proposedChestsPerHour,
    respecCostGold: respecCostGoldTotal,
    paybackHours,
    heroes: heroEntries,
    frontier,
    plateau,
    evaluations,
    budgetExhausted,
    winningSeed,
    sweeps,
    proposedSquad,
    currentSquad,
  };
}

function buildTerminalResult(params: {
  bases: readonly HeroFarmBasis[];
  objective: ResolvedFarmObjective;
  outcome: FarmRespecOutcome;
  evaluation: { pick: FarmPhasePick | null; squad: SquadFarmFacts } | null;
  evaluations: number;
  account: AccountShared;
  currentFactsById?: ReadonlyMap<string, HeroFarmFacts>;
  budgetById?: ReadonlyMap<string, number>;
}): FarmRespecResult {
  const { bases, objective, outcome, evaluation, evaluations, account } = params;
  const currentFactsById =
    params.currentFactsById ?? new Map(bases.map((b) => [b.heroId, heroFactsFromBasis(b, b.pts)] as const));
  const budgetById = params.budgetById ?? new Map(bases.map((b) => [b.heroId, reoptBudget(b.pts, b.level)] as const));
  const heroEntries = buildHeroEntries(bases, currentFactsById, budgetById, null);
  const squad = evaluation ? evaluation.squad : squadFactsFromBases(bases, null, account);
  const pick = evaluation ? evaluation.pick : null;

  return assembleResult({
    objective,
    outcome,
    keptCurrent: true,
    heroEntries,
    currentPick: pick,
    proposedPick: pick,
    currentSquad: squad,
    proposedSquad: squad,
    evaluations,
    budgetExhausted: false,
    winningSeed: 'current',
    sweeps: 0,
    tier: 'full',
    gainIsLowerBound: false,
    frontier: [],
    plateau: null,
  });
}

/** Tier 2 — the on-demand joint solve. Bounded by `FARM_OPT_FULL_MAX_EVALUATIONS`. Pure. */
export function solveFarmRespec(input: FarmRespecInput): FarmRespecResult {
  const objective = resolveFarmObjective(input.objective);
  const bases = computeHeroFarmBases({
    heroes: input.heroes,
    account: input.account,
    enabledHeroIds: input.enabledHeroIds,
  });
  const phaseOptions: FarmRateOptions = { maxPhase: input.maxPhase, returnBonus: input.returnBonus };

  if (bases.length === 0) {
    return buildTerminalResult({
      bases,
      objective,
      outcome: 'emptyPool',
      evaluation: null,
      evaluations: 0,
      account: input.account,
    });
  }

  const currentFactsById = new Map(bases.map((b) => [b.heroId, heroFactsFromBasis(b, b.pts)] as const));
  const budgetById = new Map(bases.map((b) => [b.heroId, reoptBudget(b.pts, b.level)] as const));

  const allDegenerate = bases.every((b) => currentFactsById.get(b.heroId)!.degenerate);
  if (allDegenerate) {
    return buildTerminalResult({
      bases,
      objective,
      outcome: 'allDegenerate',
      evaluation: null,
      evaluations: 0,
      account: input.account,
      currentFactsById,
      budgetById,
    });
  }

  // Scales: the current build's own best over the candidate phase set, per currency, computed
  // once then frozen. Not counted toward `evaluations` — it is objective-normalization setup,
  // not a candidate the search is choosing between.
  const currentSquad = squadFactsFromBases(bases, null, input.account);
  const dummyScales: FarmObjectiveScales = { goldScale: 1, chestScale: 1 };
  const goldPickForScale = bestFarmPhase(currentSquad, resolveFarmObjective({ kind: 'gold' }), dummyScales, phaseOptions);
  const chestPickForScale = bestFarmPhase(currentSquad, resolveFarmObjective({ kind: 'chests' }), dummyScales, phaseOptions);
  const scales: FarmObjectiveScales = {
    goldScale: goldPickForScale ? goldPickForScale.value : 0,
    chestScale: chestPickForScale ? chestPickForScale.value : 0,
  };

  const searchableIds = bases
    .filter((b) => !currentFactsById.get(b.heroId)!.degenerate && (budgetById.get(b.heroId) ?? 0) > 0)
    .map((b) => b.heroId);

  if (searchableIds.length === 0) {
    const currentPick = bestFarmPhase(currentSquad, objective, scales, phaseOptions);
    return buildTerminalResult({
      bases,
      objective,
      outcome: 'noBudget',
      evaluation: { pick: currentPick, squad: currentSquad },
      evaluations: 1,
      account: input.account,
      currentFactsById,
      budgetById,
    });
  }

  const evaluationBudget = Math.floor(FARM_OPT_FULL_MAX_EVALUATIONS * FARM_OPT_JOINT_BUDGET_SHARE);
  const search = runFarmSearch(
    bases,
    searchableIds,
    budgetById,
    input.account,
    objective,
    scales,
    phaseOptions,
    evaluationBudget,
  );

  const heroEntries = buildHeroEntries(bases, currentFactsById, budgetById, search.winner.assignment);
  const keptCurrent = heroEntries.every((h) => !h.changed);

  // Recomputed independently of the search's own 'current' seed so the CURRENT side of the
  // result never depends on internal search bookkeeping — zero pipeline calls, not counted.
  const currentPick = bestFarmPhase(currentSquad, objective, scales, phaseOptions);
  const proposedPick = search.winner.pick;
  const outcome: FarmRespecOutcome = proposedPick === null ? 'noFeasiblePhase' : keptCurrent ? 'nothingToGain' : 'improved';

  return assembleResult({
    objective,
    outcome,
    // FRAD-20e: no feasible phase anywhere ⇒ the honest "kept current" framing, never a
    // fabricated non-zero change set.
    keptCurrent: outcome === 'noFeasiblePhase' ? true : keptCurrent,
    heroEntries,
    currentPick,
    proposedPick,
    currentSquad,
    proposedSquad: search.winner.squad,
    evaluations: search.evaluations,
    budgetExhausted: search.budgetExhausted,
    winningSeed: search.winningSeedName,
    sweeps: search.sweeps,
    tier: 'full',
    gainIsLowerBound: false,
    frontier: [],
    plateau: null,
  });
}
