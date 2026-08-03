/**
 * BSPW4-10 — the shared point-allocation scorer and search, in two tiers sharing one
 * invariant (`AC-57`): `reoptDps >= currentDps`, always, by construction.
 *
 * `findGateCandidate` (Tier 1) is `AD-BSP-08` verbatim — bounded greedy, seed-compared
 * against the current vector — and is the tier wired into `computeAdvisorPipeline`
 * (`ASM-09`). `optimizeBuild` (Tier 2) is a multi-start, best-improvement local search;
 * the Points tab "Optimize build" control calls it on demand (`AC-64m`).
 *
 * Shared primitives (the affine scorer, `REOPT_KEYS`, the greedy walk) live in
 * `points-reopt-core.ts`; Tier 2's seeds/neighbourhood/local-search live in
 * `points-reopt-search.ts` — both split out to keep this file under the 300-line ESLint cap.
 */
import { sustainedDps, type Context, type EffectiveDeltas, type HeroSheet } from './model';
import type { SheetKey } from './planner-constants';
import {
  budgetOf,
  buildCandidateSheet,
  cappedStatsOf,
  greedyWalk,
  REOPT_GATE_MAX_EVALUATIONS,
  REOPT_KEYS,
} from './points-reopt-core';
import {
  buildSeeds,
  generateMoves,
  localSearch,
  REOPT_FULL_MAX_EVALUATIONS,
} from './points-reopt-search';

export {
  REOPT_KEYS,
  REOPT_GATE_MAX_EVALUATIONS,
  buildCandidateSheet,
  cappedStatsOf,
  budgetOf,
  greedyWalk,
} from './points-reopt-core';
export type { GreedyWalkResult } from './points-reopt-core';
export {
  REOPT_FULL_MAX_EVALUATIONS,
  REOPT_FULL_MAX_SWEEPS,
  REOPT_BLOCK_SIZES,
  REOPT_REFUND_ROUNDS,
} from './points-reopt-search';

export type ReoptInput = {
  /** Full 8-key current allocation. `pts.luck` is copied through untouched (`AD-BSP-21`). */
  pts: Record<SheetKey, number>;
  /** The pipeline's already-computed effective combat sheet (`AC-57g` — no extra `derive`). */
  effective: HeroSheet;
  /** The pipeline's already-computed marginal +1pt deltas (`AC-57g`). */
  effectiveDelta: EffectiveDeltas;
  context: Context;
};

export type ReoptResult = {
  /** Full 8-key vector. `luck` is copied from the input untouched (`AD-BSP-21`). */
  pts: Record<SheetKey, number>;
  /** Budget the search could not place because every candidate scored <= 0 (`ASM-03`). */
  unallocated: number;
  currentDps: number;
  reoptDps: number;
  /** `(reoptDps / currentDps - 1) x 100`, floored at 0 by the seed comparison (`DEC-06`). */
  gainPct: number;
  /** True when the seed comparison kept the player's own vector (`S1`). */
  keptCurrent: boolean;
  /** Neighbourhood moves applied — always 0 for Tier 1 (no neighbourhood, `AC-57c`). */
  localSearchMoves: number;
  /** `sustainedDps`-equivalent calls spent; bounded per tier (`AC-57d`, `AC-64b`). */
  evaluations: number;
  /** `'gate'` (Tier 1, automatic) or `'full'` (Tier 2, on demand). `BSPW4-15`, `AC-70b`. */
  tier: 'gate' | 'full';
  /** `true` for Tier 1 (a lower bound); `false` for Tier 2 (best found). `AC-70b`. */
  gainIsLowerBound: boolean;
  /** Crit chance / cdr already saturated in the returned vector's sheet (`AC-61`). */
  cappedStats: ('critChance' | 'cdr')[];
  /** `true` when an evaluation or sweep bound truncated the search (`AC-64c`). */
  budgetExhausted: boolean;
  /** Tier 2 only. Which of the seven seeds produced the winning vector (`AC-64g`). */
  winningSeed?: string;
  /** Tier 2 only. Local-search sweeps consumed (`AC-64`). */
  sweeps?: number;
};

/**
 * Tier 1 — the reset gate. `AD-BSP-08` verbatim: greedy repeated best `rankNextPoint` from
 * zero, seed-compared against the current vector (`S1`), better wins, ties favour `S1`
 * (`ASM-02`). No neighbourhood, no local search, no extra seeds (`AC-57c`). Reuses the
 * pipeline's already-computed `effective`/`effectiveDelta` — no extra `derive` pass (`AC-57g`).
 *
 * `reoptDps >= currentDps` holds by construction (`AC-57`): `S1` is evaluated first and ties
 * resolve in its favour, so the returned candidate can never score below the player's own.
 */
export function findGateCandidate(input: ReoptInput): ReoptResult {
  const { pts, effective, effectiveDelta, context } = input;
  const budget = budgetOf(pts);
  const cappedOnEntry = cappedStatsOf(effective);

  if (budget <= 0) {
    // AC-57f: fast path — no seed generated, evaluations <= 1.
    const dps = sustainedDps(effective, context);
    return {
      pts: { ...pts },
      unallocated: 0,
      currentDps: dps,
      reoptDps: dps,
      gainPct: 0,
      keptCurrent: true,
      localSearchMoves: 0,
      evaluations: 1,
      tier: 'gate',
      gainIsLowerBound: true,
      cappedStats: cappedOnEntry,
      budgetExhausted: false,
    };
  }

  let evaluations = 0;
  // S1: the player's current vector, evaluated first (AC-57, the tie-break anchor).
  const s1Score = sustainedDps(effective, context);
  evaluations += 1;

  // S2: greedy-from-zero over the seven DPS keys, Luck untouched.
  const zeroStart: Record<SheetKey, number> = { ...pts };
  for (const key of REOPT_KEYS) zeroStart[key] = 0;
  const zeroSheet = buildCandidateSheet(effective, pts, effectiveDelta, zeroStart);
  const zeroScore = sustainedDps(zeroSheet, context);
  const greedy = greedyWalk(
    zeroStart,
    zeroScore,
    budget,
    effective,
    pts,
    effectiveDelta,
    context,
    REOPT_GATE_MAX_EVALUATIONS - evaluations,
  );
  evaluations += greedy.evaluations;

  const keptCurrent = s1Score >= greedy.score;
  const winnerPts = keptCurrent ? { ...pts } : greedy.pts;
  const winnerScore = keptCurrent ? s1Score : greedy.score;
  const unallocated = keptCurrent ? 0 : greedy.unallocated;
  const winnerSheet = keptCurrent ? effective : buildCandidateSheet(effective, pts, effectiveDelta, winnerPts);

  return {
    pts: winnerPts,
    unallocated,
    currentDps: s1Score,
    reoptDps: Math.max(winnerScore, s1Score),
    gainPct: s1Score > 0 ? Math.max(0, (winnerScore / s1Score - 1) * 100) : 0,
    keptCurrent,
    localSearchMoves: 0,
    evaluations,
    tier: 'gate',
    gainIsLowerBound: true,
    cappedStats: cappedStatsOf(winnerSheet),
    budgetExhausted: greedy.budgetExhausted,
  };
}

/**
 * Tier 2 — on-demand multi-start optimiser. Seven seeds (`AC-62`) x best-improvement local
 * search over a three-family neighbourhood (`AC-63`), bounded by `REOPT_FULL_MAX_SWEEPS` per
 * seed and `REOPT_FULL_MAX_EVALUATIONS` overall (`AC-64`, `AC-64b`). Called from the
 * Points tab "Optimize build" control (`AC-64m`).
 *
 * `AC-64a` (tier monotonicity): this tier's seed set and neighbourhood are supersets of
 * Tier 1's (`S1`/`S2` are shared seeds; Tier 1 has no neighbourhood at all), so
 * `optimizeBuild.reoptDps >= findGateCandidate.reoptDps` holds structurally on the same input.
 */
export function optimizeBuild(input: ReoptInput): ReoptResult {
  const { pts, effective, effectiveDelta, context } = input;
  const budget = budgetOf(pts);
  const cappedOnEntry = cappedStatsOf(effective);

  if (budget <= 0) {
    const dps = sustainedDps(effective, context);
    return {
      pts: { ...pts },
      unallocated: 0,
      currentDps: dps,
      reoptDps: dps,
      gainPct: 0,
      keptCurrent: true,
      localSearchMoves: 0,
      evaluations: 1,
      tier: 'full',
      gainIsLowerBound: false,
      cappedStats: cappedOnEntry,
      budgetExhausted: false,
      winningSeed: 'current',
      sweeps: 0,
    };
  }

  const moves = generateMoves();
  const seeds = buildSeeds(pts, budget, effective, effectiveDelta, context);

  let totalEvaluations = 0;
  let truncatedAny = false;
  let s1Score = 0;
  let best: { name: string; pts: Record<SheetKey, number>; score: number; sweeps: number; movesApplied: number } | null =
    null;

  for (const seed of seeds) {
    if (totalEvaluations >= REOPT_FULL_MAX_EVALUATIONS) {
      truncatedAny = true;
      break;
    }
    const seedSheet = buildCandidateSheet(effective, pts, effectiveDelta, seed.pts);
    const seedScore = sustainedDps(seedSheet, context);
    totalEvaluations += 1;
    if (seed.name === 'current') s1Score = seedScore;

    const searched = localSearch(
      seed.pts,
      seedScore,
      effective,
      pts,
      effectiveDelta,
      context,
      moves,
      REOPT_FULL_MAX_EVALUATIONS - totalEvaluations,
    );
    totalEvaluations += searched.evaluations;
    if (searched.truncated) truncatedAny = true;

    if (!best || searched.score > best.score + 1e-9) {
      best = { name: seed.name, pts: searched.pts, score: searched.score, sweeps: searched.sweeps, movesApplied: searched.movesApplied };
    }
  }

  // `best` is always set: seeds has 7 entries and the loop always runs at least once for `budget > 0`.
  const winner = best as NonNullable<typeof best>;
  const winnerSum = budgetOf(winner.pts);
  const unallocated = Math.max(0, budget - winnerSum);
  const winnerSheet = buildCandidateSheet(effective, pts, effectiveDelta, winner.pts);

  return {
    pts: winner.pts,
    unallocated,
    currentDps: s1Score,
    reoptDps: Math.max(winner.score, s1Score),
    gainPct: s1Score > 0 ? Math.max(0, (winner.score / s1Score - 1) * 100) : 0,
    keptCurrent: winner.name === 'current',
    localSearchMoves: winner.movesApplied,
    evaluations: totalEvaluations,
    tier: 'full',
    gainIsLowerBound: false,
    cappedStats: cappedStatsOf(winnerSheet),
    budgetExhausted: truncatedAny,
    winningSeed: winner.name,
    sweeps: winner.sweeps,
  };
}
