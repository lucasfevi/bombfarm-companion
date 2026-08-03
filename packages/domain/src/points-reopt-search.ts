/**
 * BSPW4-10 Tier 2 internals — the seven seeds (`AC-62`), the three-family neighbourhood
 * (`AC-63`) and best-improvement local search. Split out of `points-reopt.ts` to keep that
 * file under the 300-line ESLint cap; `optimizeBuild` (Tier 2's public entry point) orchestrates
 * these from there.
 */
import { rankNextPoint, sustainedDps, type Context, type EffectiveDeltas, type HeroSheet } from '@/shared/domain/model';
import type { SheetKey } from '@/shared/domain/planner-constants';
import { buildCandidateSheet, greedyWalk, REOPT_KEYS } from '@/shared/domain/points-reopt-core';

export const REOPT_FULL_MAX_EVALUATIONS = 200_000;
export const REOPT_FULL_MAX_SWEEPS = 24;
export const REOPT_BLOCK_SIZES = [2, 3, 5, 10] as const;
/** Bound on `greedy-from-current`'s refund-and-replace rounds — it also stops on its own
 *  the first round with no net-positive swap, so this is a backstop, not the typical exit. */
export const REOPT_REFUND_ROUNDS = 50;

const EPS = 1e-9;

export type Seed = { name: string; pts: Record<SheetKey, number> };

function zeroedReoptKeys(pts: Record<SheetKey, number>): Record<SheetKey, number> {
  const out = { ...pts };
  for (const key of REOPT_KEYS) out[key] = 0;
  return out;
}

function scoreOf(
  effective: HeroSheet,
  basePts: Record<SheetKey, number>,
  effectiveDelta: EffectiveDeltas,
  context: Context,
  candidatePts: Record<SheetKey, number>,
): number {
  return sustainedDps(buildCandidateSheet(effective, basePts, effectiveDelta, candidatePts), context);
}

/** `S5`'s first phase: greedy restricted to `{critChance, critDmg}` only (the bilinear pair). */
function restrictedGreedyWalk(
  startPts: Record<SheetKey, number>,
  steps: number,
  effective: HeroSheet,
  basePts: Record<SheetKey, number>,
  effectiveDelta: EffectiveDeltas,
  context: Context,
  allowed: readonly SheetKey[],
): Record<SheetKey, number> {
  let current = { ...startPts };
  for (let step = 0; step < steps; step++) {
    const sheet = buildCandidateSheet(effective, basePts, effectiveDelta, current);
    const best = rankNextPoint(sheet, context, { effectiveDeltas: effectiveDelta, mode: 'dps' }).find((row) =>
      allowed.includes(row.stat),
    );
    if (!best || best.dpsGainPct <= 0) break;
    current = { ...current, [best.stat]: current[best.stat] + 1 };
  }
  return current;
}

/**
 * `S3` greedy-from-current: refund-and-replace. Each round finds the point whose removal
 * costs the least DPS, then the stat that gains the most from re-adding a point there, and
 * commits the swap only if it is net-positive — otherwise stops. Bounded by
 * `REOPT_REFUND_ROUNDS`, but normally stops earlier on its own exit condition.
 */
function refundReplaceWalk(
  startPts: Record<SheetKey, number>,
  effective: HeroSheet,
  basePts: Record<SheetKey, number>,
  effectiveDelta: EffectiveDeltas,
  context: Context,
): Record<SheetKey, number> {
  let current = { ...startPts };
  for (let round = 0; round < REOPT_REFUND_ROUNDS; round++) {
    const currentScore = scoreOf(effective, basePts, effectiveDelta, context, current);
    let cheapestStat: SheetKey | null = null;
    let cheapestScore = -Infinity;
    for (const key of REOPT_KEYS) {
      if (current[key] <= 0) continue;
      const removed = { ...current, [key]: current[key] - 1 };
      const removedScore = scoreOf(effective, basePts, effectiveDelta, context, removed);
      if (removedScore > cheapestScore) {
        cheapestScore = removedScore;
        cheapestStat = key;
      }
    }
    if (cheapestStat === null) break; // nothing left to give up.
    const removedPts = { ...current, [cheapestStat]: current[cheapestStat] - 1 };
    const removedSheet = buildCandidateSheet(effective, basePts, effectiveDelta, removedPts);
    const best = rankNextPoint(removedSheet, context, { effectiveDeltas: effectiveDelta, mode: 'dps' })[0];
    if (!best) break;
    const swapped = { ...removedPts, [best.stat]: removedPts[best.stat] + 1 };
    const swappedScore = scoreOf(effective, basePts, effectiveDelta, context, swapped);
    if (swappedScore > currentScore + EPS) {
      current = swapped;
    } else {
      break; // no net-positive swap available.
    }
  }
  return current;
}

/** `AC-62`: the seven seeds, generated in this fixed order. */
export function buildSeeds(
  pts: Record<SheetKey, number>,
  budget: number,
  effective: HeroSheet,
  effectiveDelta: EffectiveDeltas,
  context: Context,
): Seed[] {
  const zeroStart = zeroedReoptKeys(pts);
  const greedyFromZeroScore = scoreOf(effective, pts, effectiveDelta, context, zeroStart);
  const greedyFromZero = greedyWalk(
    zeroStart,
    greedyFromZeroScore,
    budget,
    effective,
    pts,
    effectiveDelta,
    context,
    Infinity,
  ).pts;

  const greedyFromCurrent = refundReplaceWalk(pts, effective, pts, effectiveDelta, context);

  const allInAttack = { ...zeroStart, attack: budget };
  const allInEnergy = { ...zeroStart, energy: budget };
  const allInCdr = { ...zeroStart, cdr: budget };

  const half = Math.floor(budget / 2);
  const critPairHalfSeed = restrictedGreedyWalk(zeroStart, half, effective, pts, effectiveDelta, context, [
    'critChance',
    'critDmg',
  ]);
  const critPairHalfScore = scoreOf(effective, pts, effectiveDelta, context, critPairHalfSeed);
  const critPairHalf = greedyWalk(
    critPairHalfSeed,
    critPairHalfScore,
    budget - half,
    effective,
    pts,
    effectiveDelta,
    context,
    Infinity,
  ).pts;

  return [
    { name: 'current', pts: { ...pts } },
    { name: 'greedyFromZero', pts: greedyFromZero },
    { name: 'greedyFromCurrent', pts: greedyFromCurrent },
    { name: 'allInAttack', pts: allInAttack },
    { name: 'critPairHalf', pts: critPairHalf },
    { name: 'allInEnergy', pts: allInEnergy },
    { name: 'allInCdr', pts: allInCdr },
  ];
}

type MoveFn = (pts: Record<SheetKey, number>) => Record<SheetKey, number> | null;

/** `AC-63`: the three-family neighbourhood, generated in this fixed order (260 probes). */
export function generateMoves(): MoveFn[] {
  const moves: MoveFn[] = [];

  // N1 — single-point transfer i -> j (42).
  for (const from of REOPT_KEYS) {
    for (const destination of REOPT_KEYS) {
      if (from === destination) continue;
      moves.push((pts) =>
        pts[from] < 1 ? null : { ...pts, [from]: pts[from] - 1, [destination]: pts[destination] + 1 },
      );
    }
  }

  // Nk — block transfer of blockSize in REOPT_BLOCK_SIZES, i -> j, clamped to pts[i] (168).
  for (const blockSize of REOPT_BLOCK_SIZES) {
    for (const from of REOPT_KEYS) {
      for (const destination of REOPT_KEYS) {
        if (from === destination) continue;
        moves.push((pts) => {
          const amount = Math.min(blockSize, pts[from]);
          return amount <= 0 ? null : { ...pts, [from]: pts[from] - amount, [destination]: pts[destination] + amount };
        });
      }
    }
  }

  // Ns — crit-pair split/merge: 2k points from any other single stat <-> k+k crit pair (50).
  const otherStats = REOPT_KEYS.filter((key) => key !== 'critChance' && key !== 'critDmg');
  const critPairBlockSizes = [1, 2, 3, 5, 10];
  for (const source of otherStats) {
    for (const blockSize of critPairBlockSizes) {
      const twice = 2 * blockSize;
      moves.push((pts) =>
        pts[source] < twice
          ? null
          : {
              ...pts,
              [source]: pts[source] - twice,
              critChance: pts.critChance + blockSize,
              critDmg: pts.critDmg + blockSize,
            },
      );
      moves.push((pts) =>
        pts.critChance < blockSize || pts.critDmg < blockSize
          ? null
          : {
              ...pts,
              [source]: pts[source] + twice,
              critChance: pts.critChance - blockSize,
              critDmg: pts.critDmg - blockSize,
            },
      );
    }
  }

  return moves;
}

export type LocalSearchResult = {
  pts: Record<SheetKey, number>;
  score: number;
  evaluations: number;
  sweeps: number;
  movesApplied: number;
  truncated: boolean;
};

/**
 * `AC-63b`: best-improvement — evaluate every probe in a sweep, apply the single best
 * strictly-improving move, repeat. Monotone by construction, therefore terminating. A sweep
 * that finds no improving move IS the local-optimality postcondition (`AC-63c`): the loop
 * only exits early (before `REOPT_FULL_MAX_SWEEPS`) via that exact condition.
 */
export function localSearch(
  startPts: Record<SheetKey, number>,
  startScore: number,
  effective: HeroSheet,
  basePts: Record<SheetKey, number>,
  effectiveDelta: EffectiveDeltas,
  context: Context,
  moves: MoveFn[],
  evaluationBudget: number,
): LocalSearchResult {
  let current = { ...startPts };
  let score = startScore;
  let evaluations = 0;
  let sweeps = 0;
  let movesApplied = 0;
  let truncated = false;

  for (; sweeps < REOPT_FULL_MAX_SWEEPS; sweeps++) {
    let bestCandidate: Record<SheetKey, number> | null = null;
    let bestScore = score;
    for (const move of moves) {
      if (evaluations >= evaluationBudget) {
        truncated = true;
        break;
      }
      const candidate = move(current);
      if (!candidate) continue;
      const candidateScore = scoreOf(effective, basePts, effectiveDelta, context, candidate);
      evaluations += 1;
      if (candidateScore > bestScore + EPS) {
        bestScore = candidateScore;
        bestCandidate = candidate;
      }
    }
    if (truncated) break;
    if (!bestCandidate) break; // AC-63c: no strictly improving move — local optimum.
    current = bestCandidate;
    score = bestScore;
    movesApplied += 1;
  }

  return { pts: current, score, evaluations, sweeps, movesApplied, truncated };
}
