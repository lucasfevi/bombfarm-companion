import type { ApplyPointsUnit, ApplyUnitVerdict, CommitVector } from '@bombfarm/contracts';
import { RESPEC_COST_GOLD_PER_LEVEL, requiresPointReset } from '../respec-cost';
import { commitVectorEquals, pointsToCommitVector } from './apply-commit-vector';
import type { TeamPlan } from './types';

export type HeroAllocationReading = { alloc: CommitVector; spent: number };

export function derivePointsUnits(plan: Pick<TeamPlan, 'pointResets' | 'perHero'>): ApplyPointsUnit[] {
  const levelByHeroId = new Map(plan.perHero.map((row) => [row.heroId, row.level]));
  return plan.pointResets.map((reset, index) => {
    const needsRespec = requiresPointReset(reset.ptsBefore, reset.pts);
    const level = levelByHeroId.get(reset.heroId) ?? (needsRespec ? reset.resetCostGold / RESPEC_COST_GOLD_PER_LEVEL : 0);
    const vectorBefore = pointsToCommitVector(reset.ptsBefore);
    const vector = pointsToCommitVector(reset.pts);
    return {
      index,
      heroId: reset.heroId,
      level,
      needsRespec,
      respecGold: reset.resetCostGold,
      vectorBefore,
      vector,
      pointsPlaced: pointsPlacedByStep(vectorBefore, vector, needsRespec),
    };
  });
}

/** After a refund every point goes on again; with nothing refunded only the points added do. */
function pointsPlacedByStep(vectorBefore: CommitVector, vector: CommitVector, needsRespec: boolean): number {
  return needsRespec ? vectorTotal(vector) : vectorTotal(vector) - vectorTotal(vectorBefore);
}

export function preflightPointsUnit(unit: ApplyPointsUnit, reading: HeroAllocationReading): ApplyUnitVerdict {
  if (commitVectorEquals(reading.alloc, unit.vector)) {
    return { index: unit.index, status: 'done' };
  }
  if (reading.alloc.every((value) => value === 0) && reading.spent === 0) {
    return { index: unit.index, status: 'pendingCommit' };
  }
  if (commitVectorEquals(reading.alloc, unit.vectorBefore)) {
    return { index: unit.index, status: unit.needsRespec ? 'pendingFull' : 'pendingCommit' };
  }
  return { index: unit.index, status: 'conflict', reason: 'allocationChanged' };
}

export type ServerAllocationReading = HeroAllocationReading & { available: number | null };

/**
 * `vectorBefore` is inferred from the stat sheet, and a stat at its cap hides points the sheet
 * cannot show — so against the server's own allocation a mismatch is not evidence the player moved
 * anything, and treating it as one skipped such a hero on every run. A paid reset refunds whatever
 * is placed before the absolute commit, so it holds whatever the allocation; only a target the hero
 * does not own enough points for, or an add-only commit that would have to take points off, cannot.
 */
export function preflightPointsUnitAgainstServer(unit: ApplyPointsUnit, reading: ServerAllocationReading): ApplyUnitVerdict {
  const verdict = preflightPointsUnit(unit, reading);
  if (verdict.status !== 'conflict') return verdict;
  const pointsOwned = reading.available === null ? unit.level : reading.spent + reading.available;
  if (vectorTotal(unit.vector) > pointsOwned) return verdict;
  if (unit.needsRespec) return { index: unit.index, status: 'pendingFull' };
  const onlyAdds = unit.vector.every((value, index) => value >= reading.alloc[index]);
  return onlyAdds ? { index: unit.index, status: 'pendingCommit' } : verdict;
}

function vectorTotal(values: CommitVector): number {
  return values.reduce((sum, value) => sum + value, 0);
}

export function preflightPointsUnitsOffline(
  units: readonly ApplyPointsUnit[],
  heroIds: ReadonlySet<string>,
): ApplyUnitVerdict[] {
  return units.map((unit) =>
    heroIds.has(unit.heroId)
      ? { index: unit.index, status: 'pending' as const }
      : { index: unit.index, status: 'conflict' as const, reason: 'heroMissing' as const },
  );
}
