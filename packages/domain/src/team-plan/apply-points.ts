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
  const total = (values: CommitVector) => values.reduce((sum, value) => sum + value, 0);
  return needsRespec ? total(vector) : total(vector) - total(vectorBefore);
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
