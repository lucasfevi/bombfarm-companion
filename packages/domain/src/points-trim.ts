import { RESPEC_KEYS } from './points-reopt-core';
import type { SheetKey } from './planner-constants';

/**
 * PERCENT of a proposal's objective that trimming may give up, in total, to leave stats where the
 * player already has them. Measured 2026-10-23 on four rosters under the gold objective: undoing
 * any single 1–4 point change cost 0.000–0.37% gold/hr — below the search's own ~0.4% resolution
 * and an order of magnitude below the ~4% an in-game A/B can resolve.
 */
export const POINTS_TRIM_MAX_LOSS_PCT = 0.5;

export type PointVectors = ReadonlyMap<string, Readonly<Record<SheetKey, number>>>;

export type TrimTowardCurrentInput = {
  current: PointVectors;
  proposed: PointVectors;
  proposedValue: number;
  /** The objective of `current` itself. The trim never lands below it. */
  currentValue: number;
  evaluate: (vectors: Map<string, Record<SheetKey, number>>) => number;
  maxEvaluations: number;
};

export type TrimTowardCurrentResult = {
  vectors: Map<string, Record<SheetKey, number>>;
  value: number;
  evaluations: number;
};

type Revert = {
  heroId: string;
  points: number;
  apply: (pts: Readonly<Record<SheetKey, number>>) => Record<SheetKey, number>;
};

const UNPLACED = 'unplaced' as const;
type Slot = SheetKey | typeof UNPLACED;

/**
 * Every way to walk one hero back toward its current vector: each (grown, shrunk) pair settled
 * by the smaller of the two moves, and — when there is more than one pair — the whole hero.
 * Banked points are a slot of their own, so undoing "spend 1 banked point on Speed" is a pair.
 */
function revertsFor(
  heroId: string,
  current: Readonly<Record<SheetKey, number>>,
  proposed: Readonly<Record<SheetKey, number>>,
): Revert[] {
  const diff = new Map<Slot, number>();
  let placedDiff = 0;
  for (const key of RESPEC_KEYS) {
    const delta = proposed[key] - current[key];
    placedDiff += delta;
    if (delta !== 0) diff.set(key, delta);
  }
  if (placedDiff !== 0) diff.set(UNPLACED, -placedDiff);

  const grown = [...diff].filter(([, delta]) => delta > 0);
  const shrunk = [...diff].filter(([, delta]) => delta < 0);
  const reverts: Revert[] = [];
  for (const [from, grew] of grown) {
    for (const [to, shrank] of shrunk) {
      const points = Math.min(grew, -shrank);
      reverts.push({
        heroId,
        points,
        apply: (pts) => {
          const next = { ...pts };
          if (from !== UNPLACED) next[from] -= points;
          if (to !== UNPLACED) next[to] += points;
          return next;
        },
      });
    }
  }
  if (reverts.length > 1) {
    const points = grown.reduce((sum, [, delta]) => sum + delta, 0);
    reverts.push({ heroId, points, apply: () => ({ ...current }) });
  }
  return reverts;
}

/**
 * Walks a proposal back toward the current vectors, smallest change first, keeping each step
 * while the proposal is still worth at least `POINTS_TRIM_MAX_LOSS_PCT` short of its own value —
 * so a change that buys almost nothing is not offered as one the player has to make. The bound is
 * on the total, not per change: five 0.1% changes are not all dropped for 0.5% between them.
 */
export function trimTowardCurrent(input: TrimTowardCurrentInput): TrimTowardCurrentResult {
  const { current, proposed, proposedValue, currentValue, evaluate, maxEvaluations } = input;
  const copy = (vectors: PointVectors) => new Map([...vectors].map(([id, pts]) => [id, { ...pts }] as const));
  if (!Number.isFinite(proposedValue)) return { vectors: copy(proposed), value: proposedValue, evaluations: 0 };

  const target = Math.max(currentValue, proposedValue - (Math.abs(proposedValue) * POINTS_TRIM_MAX_LOSS_PCT) / 100);
  if (currentValue >= target) {
    const vectors = copy(proposed);
    for (const [heroId, pts] of current) if (vectors.has(heroId)) vectors.set(heroId, { ...pts });
    return { vectors, value: currentValue, evaluations: 0 };
  }

  const heroIds = [...proposed.keys()].filter((id) => current.has(id)).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  let vectors = copy(proposed);
  let value = proposedValue;
  let evaluations = 0;
  search: for (;;) {
    const reverts = heroIds
      .flatMap((heroId) => revertsFor(heroId, current.get(heroId)!, vectors.get(heroId)!))
      .sort((a, b) => a.points - b.points);
    for (const revert of reverts) {
      if (evaluations >= maxEvaluations) break search;
      const trial = new Map(vectors);
      trial.set(revert.heroId, revert.apply(vectors.get(revert.heroId)!));
      const trialValue = evaluate(trial);
      evaluations += 1;
      if (trialValue >= target) {
        vectors = trial;
        value = trialValue;
        continue search;
      }
    }
    break;
  }
  return { vectors, value, evaluations };
}
