/**
 * Optimize ONE hero's stat points against the FARM objective — the per-hero counterpart to
 * `points-reopt.ts`'s `optimizeBuild`, which scores sustained DPS instead.
 *
 * WHY THE WHOLE POOL IS STILL AN INPUT: gold/hr is a rate the rotation produces, not a rate a
 * hero produces. Scoring one hero in isolation would answer a question the game never asks. So
 * the search takes the full pool as context and narrows only what it is allowed to MOVE — the
 * same `searchableIds` narrowing the roster solver's cost frontier already uses, with a
 * single id in it.
 *
 * Pure, and makes ZERO advisor-pipeline calls: it consumes `HeroFarmBasis[]` the caller already
 * paid for, exactly like `rankNextPointForFarm`. `pts.luck` is copied through untouched.
 */
import {
  heroFactsFromBasis,
  squadFactsFromBases,
  type FarmRateOptions,
  type HeroFarmBasis,
  type ReturnBonusMode,
} from './farm-rate';
import {
  bestFarmPhase,
  farmObjectiveScales,
  resolveFarmObjective,
  type FarmObjective,
  type FarmObjectiveScales,
  type ResolvedFarmObjective,
} from './farm-optimize-objective';
import { runFarmSearch, FARM_OPT_FULL_MAX_EVALUATIONS } from './farm-optimize-search';
import { reoptBudget, REOPT_KEYS } from './points-reopt-core';
import { ZERO_PTS, type SheetKey } from './planner-constants';
import type { AccountShared } from './shims/storage';

export type HeroFarmOptimizeInput = {
  /** The rotation pool INCLUDING the optimized hero, in the order the caller wants summed —
   *  squad reductions are float sums, so order is part of the contract. */
  bases: readonly HeroFarmBasis[];
  account: AccountShared;
  /** The hero whose points may move. Must appear in `bases`. */
  heroId: string;
  /** Default `{ kind: 'gold' }`. */
  objective?: FarmObjective | null;
  /** null / non-positive / non-finite ⇒ every phase in `[1, 600]`. */
  maxPhase?: number | null;
  /** Default `'off'`, matching the estimator and the Farm board. */
  returnBonus?: ReturnBonusMode;
};

export type HeroFarmOptimizeOutcome =
  | 'improved' // a strictly better build was found
  | 'nothingToGain' // searched, the hero's current build wins
  | 'emptyPool' // no rotation to score against
  | 'heroNotInPool' // heroId names no basis — a caller error, reported not thrown
  | 'degenerate' // the estimator cannot rate this hero at its current points
  | 'noBudget' // `reoptBudget` is 0 — nothing placed and no level pool
  | 'noFeasiblePhase'; // no phase in range is farmable under the current build

export type HeroFarmOptimizeResult = {
  outcome: HeroFarmOptimizeOutcome;
  objective: ResolvedFarmObjective;
  /** Full 8-key vector for the optimized hero. Equals the input vector on every outcome except
   *  `'improved'`; `luck` always equals the input's. */
  pts: Record<SheetKey, number>;
  /** PERCENT, `>= 0`, in `objective.unit`. 0 whenever the current build is not beaten. */
  gainPct: number;
  currentObjective: number;
  proposedObjective: number;
  /** The phase this rotation farms best under each build. null when nothing is feasible. */
  currentPhase: number | null;
  recommendedPhase: number | null;
  /** Each side's own gold ceiling, reported whatever the objective — a chest-focused solve
   *  still says what happens to gold. */
  currentGoldPerHour: number;
  proposedGoldPerHour: number;
  /** Phase-argmax sweeps spent by the SEARCH. The read-outs above are not counted. */
  evaluations: number;
  /** True when an evaluation or sweep bound truncated the search. */
  budgetExhausted: boolean;
};

function terminal(
  outcome: HeroFarmOptimizeOutcome,
  objective: ResolvedFarmObjective,
  pts: Record<SheetKey, number>,
  currentPhase: number | null,
  currentObjective: number,
  currentGoldPerHour: number,
  evaluations: number,
): HeroFarmOptimizeResult {
  return {
    outcome,
    objective,
    pts: { ...pts },
    gainPct: 0,
    currentObjective,
    proposedObjective: currentObjective,
    currentPhase,
    recommendedPhase: currentPhase,
    currentGoldPerHour,
    proposedGoldPerHour: currentGoldPerHour,
    evaluations,
    budgetExhausted: false,
  };
}

/** Pure. Never throws. */
export function optimizeHeroForFarm(input: HeroFarmOptimizeInput): HeroFarmOptimizeResult {
  const { bases, account, heroId } = input;
  const objective = resolveFarmObjective(input.objective);
  const phaseOptions: FarmRateOptions = { maxPhase: input.maxPhase, returnBonus: input.returnBonus };

  if (bases.length === 0) {
    return terminal('emptyPool', objective, ZERO_PTS(), null, 0, 0, 0);
  }
  const basis = bases.find((b) => b.heroId === heroId);
  if (basis === undefined) {
    return terminal('heroNotInPool', objective, ZERO_PTS(), null, 0, 0, 0);
  }

  // The frozen normalizers AND the gold/chest read-out are the same per-currency scan, derived
  // together rather than swept twice.
  const currentSquad = squadFactsFromBases(bases, null, account);
  const currentReadout = farmObjectiveScales(currentSquad, phaseOptions);
  const scales: FarmObjectiveScales = currentReadout;
  const currentPick = bestFarmPhase(currentSquad, objective, scales, phaseOptions);
  const currentPhase = currentPick ? currentPick.phase : null;
  const currentObjective = currentPick ? currentPick.value : 0;
  const currentGold = currentReadout.goldScale;

  const bail = (outcome: HeroFarmOptimizeOutcome) =>
    terminal(outcome, objective, basis.pts, currentPhase, currentObjective, currentGold, 1);

  if (heroFactsFromBasis(basis, basis.pts).degenerate) return bail('degenerate');

  const budget = reoptBudget(basis.pts, basis.level);
  if (budget <= 0) return bail('noBudget');
  if (currentPick === null) return bail('noFeasiblePhase');

  const budgetById = new Map(bases.map((b) => [b.heroId, b.heroId === heroId ? budget : 0] as const));
  const search = runFarmSearch(
    bases,
    [heroId],
    budgetById,
    account,
    objective,
    scales,
    phaseOptions,
    FARM_OPT_FULL_MAX_EVALUATIONS,
  );

  const proposedSource = search.winner.assignment.get(heroId) ?? basis.pts;
  const pts: Record<SheetKey, number> = { ...proposedSource, luck: basis.pts.luck };
  const changed = REOPT_KEYS.some((key) => pts[key] !== basis.pts[key]);
  const proposedPick = search.winner.pick;
  const proposedObjective = proposedPick ? proposedPick.value : 0;
  const outcome: HeroFarmOptimizeOutcome =
    proposedPick === null ? 'noFeasiblePhase' : changed ? 'improved' : 'nothingToGain';

  return {
    outcome,
    objective,
    // A search that beat nothing hands back the player's own vector, never an equally-scoring
    // reshuffle they would have to buy a reset to apply.
    pts: outcome === 'improved' ? pts : { ...basis.pts },
    gainPct:
      outcome === 'improved' && currentObjective > 0
        ? Math.max(0, (proposedObjective / currentObjective - 1) * 100)
        : 0,
    currentObjective,
    proposedObjective: outcome === 'improved' ? proposedObjective : currentObjective,
    currentPhase,
    recommendedPhase: outcome === 'improved' && proposedPick ? proposedPick.phase : currentPhase,
    currentGoldPerHour: currentGold,
    proposedGoldPerHour:
      outcome === 'improved' ? farmObjectiveScales(search.winner.squad, phaseOptions).goldScale : currentGold,
    evaluations: search.evaluations,
    budgetExhausted: search.budgetExhausted,
  };
}
