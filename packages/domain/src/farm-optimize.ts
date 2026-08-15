/**
 * The farm-respec solver's public surface: result types, `solveFarmRespec` (Tier 2, on demand)
 * and `gateFarmRespec` (Tier 1, always-on). Both turn a roster + account + objective into a
 * joint per-hero build x phase recommendation, bounded by a named, exported evaluation budget.
 *
 * Every exported function here is pure: same arguments, same result, no memo cache, no
 * module-level mutable state, no clock, no `Math.random`. Re-running the solver on its own
 * proposed build is a fixed point — the same non-compounding property `reoptBudget` was fixed
 * for. `pts.luck` is never touched: Luck sits outside the seven reallocatable stat keys
 * structurally, not by a runtime check.
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
  farmObjectiveScales,
  type FarmObjective,
  type ResolvedFarmObjective,
  type FarmObjectiveScales,
  type FarmPhasePick,
} from './farm-optimize-objective';
import { reoptBudget, REOPT_KEYS } from './points-reopt-core';
import { respecCostGold } from './respec-cost';
import {
  runFarmSearch,
  runFarmGateSeeds,
  squadEnergyShare,
  derivePlateauBounds,
  compareFarmCandidates,
  type PtsAssignment,
  type FarmSearchOutcome,
  FARM_OPT_FULL_MAX_EVALUATIONS,
  FARM_OPT_JOINT_BUDGET_SHARE,
  FARM_OPT_PLATEAU_TOLERANCE_PCT,
  FARM_OPT_FRONTIER_CANDIDATES,
  FARM_OPT_GATE_PHASE_STRIDE,
  FARM_OPT_GATE_MAX_EVALUATIONS,
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

/**
 * Gold/hr and chests/hr at a squad's OWN best-over-phase rate for each currency independently —
 * decoupled from whatever phase the ACTIVE objective recommends. This is what makes
 * `paybackHours` "always denominated in GOLD whatever the objective" (design.md §4.11): a
 * chest-focused solve still reports each side's real gold ceiling, not gold-at-the-chest-phase.
 * Not counted toward `evaluations` — informational read-out, zero pipeline calls.
 */
function goldChestReadout(
  squad: SquadFarmFacts,
  phaseOptions: FarmRateOptions,
): { goldPerHour: number; chestsPerHour: number } {
  const scales = farmObjectiveScales(squad, phaseOptions);
  return { goldPerHour: scales.goldScale, chestsPerHour: scales.chestScale };
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
  phaseOptions: FarmRateOptions;
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
    phaseOptions,
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
  const currentReadout = goldChestReadout(currentSquad, phaseOptions);
  const currentGoldPerHour = currentReadout.goldPerHour;
  const currentChestsPerHour = currentReadout.chestsPerHour;

  const recommendedPhase = proposedPick ? proposedPick.phase : null;
  // No fabricated value — 0, never NaN/Infinity, when nothing is feasible.
  const proposedObjective = proposedPick ? proposedPick.value : 0;
  const proposedReadout = goldChestReadout(proposedSquad, phaseOptions);
  const proposedGoldPerHour = proposedReadout.goldPerHour;
  const proposedChestsPerHour = proposedReadout.chestsPerHour;

  // currentObjective <= 0 ⇒ gainPct 0, never a division by zero.
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
  phaseOptions: FarmRateOptions;
  /** null for emptyPool/allDegenerate (no squad to describe); a trivial point-plateau for
   *  noBudget, where the search never ran (design.md §7: "reported around current"). */
  plateau: FarmRespecPlateau | null;
  tier: 'gate' | 'full';
  gainIsLowerBound: boolean;
  currentFactsById?: ReadonlyMap<string, HeroFarmFacts>;
  budgetById?: ReadonlyMap<string, number>;
}): FarmRespecResult {
  const { bases, objective, outcome, evaluation, evaluations, account, phaseOptions, plateau, tier, gainIsLowerBound } = params;
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
    phaseOptions,
    evaluations,
    budgetExhausted: false,
    winningSeed: 'current',
    sweeps: 0,
    tier,
    gainIsLowerBound,
    frontier: [],
    plateau,
  });
}

/** `(changed in the joint optimum) desc, then budget desc, then heroId asc` (design.md §4.10). */
function rankFrontierCandidates(
  heroEntries: readonly FarmRespecHeroEntry[],
  searchableIds: readonly string[],
  budgetById: ReadonlyMap<string, number>,
): string[] {
  const entriesById = new Map(heroEntries.map((h) => [h.heroId, h] as const));
  return [...searchableIds].sort((a, b) => {
    const aChanged = entriesById.get(a)?.changed ?? false;
    const bChanged = entriesById.get(b)?.changed ?? false;
    if (aChanged !== bChanged) return aChanged ? -1 : 1;
    const budgetDiff = (budgetById.get(b) ?? 0) - (budgetById.get(a) ?? 0);
    if (budgetDiff !== 0) return budgetDiff;
    return a < b ? -1 : a > b ? 1 : 0;
  });
}

function buildFrontierEntry(
  heroIds: readonly string[],
  search: FarmSearchOutcome,
  bases: readonly HeroFarmBasis[],
  currentFactsById: ReadonlyMap<string, HeroFarmFacts>,
  budgetById: ReadonlyMap<string, number>,
  phaseOptions: FarmRateOptions,
  currentObjective: number,
  currentGoldPerHour: number,
): FarmRespecFrontierEntry {
  const heroEntries = buildHeroEntries(bases, currentFactsById, budgetById, search.winner.assignment);
  const recommendedPhase = search.winner.pick ? search.winner.pick.phase : null;
  const proposedObjective = search.winner.pick ? search.winner.pick.value : 0;
  const readout = goldChestReadout(search.winner.squad, phaseOptions);
  const gainPct = currentObjective > 0 ? Math.max(0, (proposedObjective / currentObjective - 1) * 100) : 0;
  const respecCostGoldTotal = heroEntries.filter((h) => h.changed).reduce((sum, h) => sum + h.respecCostGold, 0);
  const deltaGold = readout.goldPerHour - currentGoldPerHour;
  const paybackHours = deltaGold > 0 && Number.isFinite(deltaGold) ? respecCostGoldTotal / deltaGold : null;

  return {
    heroCount: heroIds.length,
    heroIds: [...heroIds].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)),
    heroes: heroEntries,
    recommendedPhase,
    proposedObjective,
    gainPct,
    respecCostGold: respecCostGoldTotal,
    paybackHours,
    proposedGoldPerHour: readout.goldPerHour,
    proposedChestsPerHour: readout.chestsPerHour,
  };
}

/**
 * The cost frontier (design.md §4.10): best 1-hero and best 2-hero respec, each RE-SOLVED with
 * every other hero pinned to current — never truncated from the joint optimum. Candidates are
 * ranked once, deterministically, and only the top `FARM_OPT_FRONTIER_CANDIDATES` are considered,
 * which bounds the cost to at most `FARM_OPT_FRONTIER_CANDIDATES + C(FARM_OPT_FRONTIER_CANDIDATES, 2)`
 * re-solves rather than the `n + n(n-1)/2` exhaustive scan.
 */
function computeFrontier(params: {
  bases: readonly HeroFarmBasis[];
  heroEntries: readonly FarmRespecHeroEntry[];
  currentFactsById: ReadonlyMap<string, HeroFarmFacts>;
  budgetById: ReadonlyMap<string, number>;
  searchableIds: readonly string[];
  account: AccountShared;
  objective: ResolvedFarmObjective;
  scales: FarmObjectiveScales;
  phaseOptions: FarmRateOptions;
  currentObjective: number;
  currentGoldPerHour: number;
  remainingBudget: number;
}): { frontier: FarmRespecFrontierEntry[]; evaluationsSpent: number; budgetExhausted: boolean } {
  const { bases, heroEntries, currentFactsById, budgetById, searchableIds, account, objective, scales, phaseOptions, currentObjective, currentGoldPerHour } = params;

  if (searchableIds.length < 2) return { frontier: [], evaluationsSpent: 0, budgetExhausted: false };

  const ranked = rankFrontierCandidates(heroEntries, searchableIds, budgetById).slice(0, FARM_OPT_FRONTIER_CANDIDATES);

  const soloTiers: string[][] = ranked.map((id) => [id]);
  const pairTiers: string[][] = [];
  for (let i = 0; i < ranked.length; i++) {
    for (let j = i + 1; j < ranked.length; j++) pairTiers.push([ranked[i], ranked[j]]);
  }

  const plannedSolves: string[][] = [];
  if (searchableIds.length >= 2) plannedSolves.push(...soloTiers);
  if (searchableIds.length >= 3) plannedSolves.push(...pairTiers);

  let remaining = params.remainingBudget;
  let evaluationsSpent = 0;
  let budgetExhausted = false;
  const soloSearches: { heroIds: string[]; search: FarmSearchOutcome }[] = [];
  const pairSearches: { heroIds: string[]; search: FarmSearchOutcome }[] = [];

  for (let i = 0; i < plannedSolves.length; i++) {
    const solvesLeft = plannedSolves.length - i;
    const share = Math.max(0, Math.floor(remaining / solvesLeft));
    const heroIds = plannedSolves[i];
    const search = runFarmSearch(bases, heroIds, budgetById, account, objective, scales, phaseOptions, share);
    remaining -= search.evaluations;
    evaluationsSpent += search.evaluations;
    if (search.budgetExhausted) budgetExhausted = true;
    (heroIds.length === 1 ? soloSearches : pairSearches).push({ heroIds, search });
  }

  const frontier: FarmRespecFrontierEntry[] = [];

  if (soloSearches.length > 0 && 1 < searchableIds.length) {
    const winner = soloSearches.reduce((best, candidate) =>
      compareFarmCandidates(candidate.search.winner, best.search.winner, bases) < 0 ? candidate : best,
    );
    frontier.push(
      buildFrontierEntry(winner.heroIds, winner.search, bases, currentFactsById, budgetById, phaseOptions, currentObjective, currentGoldPerHour),
    );
  }

  if (pairSearches.length > 0 && 2 < searchableIds.length) {
    const winner = pairSearches.reduce((best, candidate) =>
      compareFarmCandidates(candidate.search.winner, best.search.winner, bases) < 0 ? candidate : best,
    );
    frontier.push(
      buildFrontierEntry(winner.heroIds, winner.search, bases, currentFactsById, budgetById, phaseOptions, currentObjective, currentGoldPerHour),
    );
  }

  frontier.sort((a, b) => {
    if (a.respecCostGold !== b.respecCostGold) return a.respecCostGold - b.respecCostGold;
    return a.heroCount - b.heroCount;
  });

  return { frontier, evaluationsSpent, budgetExhausted };
}

type FarmRespecSetup =
  | { kind: 'terminal'; result: FarmRespecResult }
  | {
      kind: 'ready';
      bases: readonly HeroFarmBasis[];
      objective: ResolvedFarmObjective;
      phaseOptions: FarmRateOptions;
      currentFactsById: ReadonlyMap<string, HeroFarmFacts>;
      budgetById: ReadonlyMap<string, number>;
      currentSquad: SquadFarmFacts;
      scales: FarmObjectiveScales;
      searchableIds: readonly string[];
    };

/**
 * The shared prefix both tiers run: resolve the objective, extract the basis, and handle the
 * three degenerate fast paths (`emptyPool`, `allDegenerate`, `noBudget`) identically — design.md
 * §7's own requirement that "every §7 degenerate row returns the same outcome from the gate as
 * from the full solve". Returns either a finished terminal result or everything the real search
 * needs to proceed.
 */
function prepareFarmRespecSolve(
  input: FarmRespecInput,
  tier: 'gate' | 'full',
  gainIsLowerBound: boolean,
): FarmRespecSetup {
  const objective = resolveFarmObjective(input.objective);
  const bases = computeHeroFarmBases({
    heroes: input.heroes,
    account: input.account,
    enabledHeroIds: input.enabledHeroIds,
  });
  const phaseOptions: FarmRateOptions = { maxPhase: input.maxPhase, returnBonus: input.returnBonus };

  if (bases.length === 0) {
    return {
      kind: 'terminal',
      result: buildTerminalResult({
        bases,
        objective,
        outcome: 'emptyPool',
        evaluation: null,
        evaluations: 0,
        account: input.account,
        phaseOptions,
        plateau: null,
        tier,
        gainIsLowerBound,
      }),
    };
  }

  const currentFactsById = new Map(bases.map((b) => [b.heroId, heroFactsFromBasis(b, b.pts)] as const));
  const budgetById = new Map(bases.map((b) => [b.heroId, reoptBudget(b.pts, b.level)] as const));

  const allDegenerate = bases.every((b) => currentFactsById.get(b.heroId)!.degenerate);
  if (allDegenerate) {
    return {
      kind: 'terminal',
      result: buildTerminalResult({
        bases,
        objective,
        outcome: 'allDegenerate',
        evaluation: null,
        evaluations: 0,
        account: input.account,
        phaseOptions,
        plateau: null,
        tier,
        gainIsLowerBound,
        currentFactsById,
        budgetById,
      }),
    };
  }

  // Scales: the current build's own best over the candidate phase set, per currency, computed
  // once then frozen (design.md §4.1). Not counted toward `evaluations` — it is
  // objective-normalization setup, not a candidate the search is choosing between. This is the
  // SAME independent per-currency read-out `goldChestReadout` computes for display, so the two
  // are derived together rather than duplicating the phase scan.
  const currentSquad = squadFactsFromBases(bases, null, input.account);
  const currentReadout = goldChestReadout(currentSquad, phaseOptions);
  const scales: FarmObjectiveScales = {
    goldScale: currentReadout.goldPerHour,
    chestScale: currentReadout.chestsPerHour,
  };

  const searchableIds = bases
    .filter((b) => !currentFactsById.get(b.heroId)!.degenerate && (budgetById.get(b.heroId) ?? 0) > 0)
    .map((b) => b.heroId);

  if (searchableIds.length === 0) {
    const currentPick = bestFarmPhase(currentSquad, objective, scales, phaseOptions);
    // No search ran (nothing was searchable), so there is no ladder to read a plateau from — a
    // trivial point-plateau at the current build's own energy share (design.md §7: "reported
    // around current" for the every-hero-out-of-budget case).
    const noBudgetShare = squadEnergyShare(bases, searchableIds, budgetById, null);
    return {
      kind: 'terminal',
      result: buildTerminalResult({
        bases,
        objective,
        outcome: 'noBudget',
        evaluation: { pick: currentPick, squad: currentSquad },
        evaluations: 1,
        account: input.account,
        phaseOptions,
        plateau: {
          minEnergyShare: noBudgetShare,
          maxEnergyShare: noBudgetShare,
          tolerancePct: FARM_OPT_PLATEAU_TOLERANCE_PCT,
          currentEnergyShare: noBudgetShare,
          proposedEnergyShare: noBudgetShare,
        },
        tier,
        gainIsLowerBound,
        currentFactsById,
        budgetById,
      }),
    };
  }

  return { kind: 'ready', bases, objective, phaseOptions, currentFactsById, budgetById, currentSquad, scales, searchableIds };
}

/** Tier 2 — the on-demand joint solve. Bounded by `FARM_OPT_FULL_MAX_EVALUATIONS`. Pure. */
export function solveFarmRespec(input: FarmRespecInput): FarmRespecResult {
  const setup = prepareFarmRespecSolve(input, 'full', false);
  if (setup.kind === 'terminal') return setup.result;
  const { bases, objective, phaseOptions, currentFactsById, budgetById, currentSquad, scales, searchableIds } = setup;

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

  // The plateau (design.md §4.7) — a pure read-out of the final sweep's ladder, ZERO extra
  // evaluations. `peak` is the winner's own value: by construction no ladder entry out-scores it.
  const winShare = squadEnergyShare(bases, searchableIds, budgetById, search.winner.assignment);
  const currentShare = squadEnergyShare(bases, searchableIds, budgetById, null);
  const plateauBounds = derivePlateauBounds(search.ladder, winShare, search.winner.value, FARM_OPT_PLATEAU_TOLERANCE_PCT);
  const plateau: FarmRespecPlateau = {
    minEnergyShare: plateauBounds.min,
    maxEnergyShare: plateauBounds.max,
    tolerancePct: FARM_OPT_PLATEAU_TOLERANCE_PCT,
    currentEnergyShare: currentShare,
    proposedEnergyShare: winShare,
  };

  // The cost frontier (design.md §4.10): only when the joint solve actually found something
  // better — a frontier under keptCurrent would advise spending gold for zero gain. Shares the
  // budget the joint solve left over (design.md §4.9).
  let frontier: FarmRespecFrontierEntry[] = [];
  let frontierEvaluations = 0;
  let frontierBudgetExhausted = false;
  if (outcome === 'improved') {
    const currentObjectiveForFrontier = currentPick ? currentPick.value : 0;
    const currentGoldPerHourForFrontier = goldChestReadout(currentSquad, phaseOptions).goldPerHour;
    const remainingBudget = Math.max(0, FARM_OPT_FULL_MAX_EVALUATIONS - search.evaluations);
    const frontierResult = computeFrontier({
      bases,
      heroEntries,
      currentFactsById,
      budgetById,
      searchableIds,
      account: input.account,
      objective,
      scales,
      phaseOptions,
      currentObjective: currentObjectiveForFrontier,
      currentGoldPerHour: currentGoldPerHourForFrontier,
      remainingBudget,
    });
    frontier = frontierResult.frontier;
    frontierEvaluations = frontierResult.evaluationsSpent;
    frontierBudgetExhausted = frontierResult.budgetExhausted;
  }

  return assembleResult({
    objective,
    outcome,
    // No feasible phase anywhere ⇒ the honest "kept current" framing, never a fabricated
    // non-zero change set.
    keptCurrent: outcome === 'noFeasiblePhase' ? true : keptCurrent,
    heroEntries,
    currentPick,
    proposedPick,
    currentSquad,
    proposedSquad: search.winner.squad,
    phaseOptions,
    evaluations: search.evaluations + frontierEvaluations,
    budgetExhausted: search.budgetExhausted || frontierBudgetExhausted,
    winningSeed: search.winningSeedName,
    sweeps: search.sweeps,
    tier: 'full',
    gainIsLowerBound: false,
    frontier,
    plateau,
  });
}

/**
 * Tier 1 — the always-on gate. Seeds only, subsampled phase grid for candidates and the FULL
 * set for the current build, so `gainPct` is a genuine LOWER BOUND. `frontier` is always empty;
 * `plateau` is always null. Bounded by `FARM_OPT_GATE_MAX_EVALUATIONS`. Pure.
 */
export function gateFarmRespec(input: FarmRespecInput): FarmRespecResult {
  const setup = prepareFarmRespecSolve(input, 'gate', true);
  if (setup.kind === 'terminal') return setup.result;
  const { bases, objective, phaseOptions, currentFactsById, budgetById, currentSquad, scales, searchableIds } = setup;

  const gate = runFarmGateSeeds(
    bases,
    searchableIds,
    budgetById,
    input.account,
    objective,
    scales,
    phaseOptions,
    FARM_OPT_GATE_PHASE_STRIDE,
    FARM_OPT_GATE_MAX_EVALUATIONS,
  );

  const heroEntries = buildHeroEntries(bases, currentFactsById, budgetById, gate.winner.assignment);
  const keptCurrent = heroEntries.every((h) => !h.changed);

  // The current build's own evaluation — scored on the FULL phase set, never subsampled, so a
  // ratio against it can only UNDER-state the true gain (design.md §4.8's lower-bound contract).
  const currentPick = gate.currentEval.pick;
  const proposedPick = gate.winner.pick;
  const outcome: FarmRespecOutcome = proposedPick === null ? 'noFeasiblePhase' : keptCurrent ? 'nothingToGain' : 'improved';

  return assembleResult({
    objective,
    outcome,
    keptCurrent: outcome === 'noFeasiblePhase' ? true : keptCurrent,
    heroEntries,
    currentPick,
    proposedPick,
    currentSquad,
    proposedSquad: gate.winner.squad,
    phaseOptions,
    evaluations: gate.evaluations,
    // The gate's own bound (<= 1 + 5 = 6) sits well inside FARM_OPT_GATE_MAX_EVALUATIONS (64) by
    // construction — there is no truncation path to signal.
    budgetExhausted: false,
    winningSeed: gate.winner.name,
    sweeps: 0,
    tier: 'gate',
    gainIsLowerBound: true,
    frontier: [],
    plateau: null,
  });
}
