import { describe, expect, it } from 'vitest';
import {
  COMMIT_INDEX,
  COMMIT_ORDER,
  commitVectorEquals,
  derivePointsUnits,
  pointsToCommitVector,
  preflightPointsUnit,
  preflightPointsUnitsOffline,
  type HeroAllocationReading,
} from '@bombfarm/domain/team-plan';
import type { TeamPlan } from '@bombfarm/domain/team-plan';

const ZERO_STATS = { attack: 0, energy: 0, speed: 0, critChance: 0, critDmg: 0, penetration: 0, cdr: 0, luck: 0 };

function perHeroRow(heroId: string, level: number): TeamPlan['perHero'][number] {
  return {
    heroId,
    heroName: heroId,
    level,
    before: 0,
    after: 0,
    delta: 0,
    combatStatsBefore: ZERO_STATS,
    combatStatsAfter: ZERO_STATS,
    sheetStatsBefore: ZERO_STATS,
    sheetStatsAfter: ZERO_STATS,
    hitBefore: 0,
    hitAfter: 0,
  };
}

function pointReset(
  heroId: string,
  ptsBefore: Record<string, number>,
  pts: Record<string, number>,
  resetCostGold: number,
): TeamPlan['pointResets'][number] {
  return { heroId, ptsBefore, pts, heroGainDpsPct: 0, rosterGainObjective: 0, resetCostGold };
}

describe('COMMIT_ORDER / COMMIT_INDEX — the server index order', () => {
  it('pins every key to its server index by value', () => {
    expect(COMMIT_INDEX.attack).toBe(0);
    expect(COMMIT_INDEX.energy).toBe(1);
    expect(COMMIT_INDEX.speed).toBe(2);
    expect(COMMIT_INDEX.luck).toBe(3);
    expect(COMMIT_INDEX.critChance).toBe(4);
    expect(COMMIT_INDEX.critDmg).toBe(5);
    expect(COMMIT_INDEX.penetration).toBe(6);
    expect(COMMIT_INDEX.cdr).toBe(7);
  });

  it('has exactly eight entries', () => {
    expect(COMMIT_ORDER).toHaveLength(8);
    expect(Object.keys(COMMIT_INDEX)).toHaveLength(8);
  });

  it('is NOT the sheet-key field order (misallocation red state)', () => {
    const sheetKeyOrderPts = {
      attack: 1,
      energy: 2,
      speed: 3,
      critChance: 4,
      critDmg: 5,
      penetration: 6,
      cdr: 7,
      luck: 8,
    };
    const vector = pointsToCommitVector(sheetKeyOrderPts);
    expect(vector).not.toEqual(Object.values(sheetKeyOrderPts));
  });
});

describe('pointsToCommitVector', () => {
  it('returns the eight values in COMMIT_ORDER', () => {
    const pts = { attack: 10, energy: 20, speed: 30, luck: 40, critChance: 50, critDmg: 60, penetration: 70, cdr: 80 };
    expect(pointsToCommitVector(pts)).toEqual([10, 20, 30, 40, 50, 60, 70, 80]);
  });

  it('reads a missing key as 0', () => {
    expect(pointsToCommitVector({ attack: 5 })).toEqual([5, 0, 0, 0, 0, 0, 0, 0]);
    expect(pointsToCommitVector({})).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('throws RangeError for a negative value', () => {
    expect(() => pointsToCommitVector({ luck: -1 })).toThrow(RangeError);
  });

  it('throws RangeError for a non-integer value', () => {
    expect(() => pointsToCommitVector({ cdr: 1.5 })).toThrow(RangeError);
  });
});

describe('commitVectorEquals', () => {
  const a = [1, 2, 3, 4, 5, 6, 7, 8] as const;

  it('is true for two equal vectors', () => {
    expect(commitVectorEquals(a, [1, 2, 3, 4, 5, 6, 7, 8])).toBe(true);
  });

  it('is false when any entry differs', () => {
    expect(commitVectorEquals(a, [1, 2, 3, 4, 5, 6, 7, 9])).toBe(false);
  });
});

describe('derivePointsUnits', () => {
  it('carries level from perHero, needsRespec, respecGold, vectors, pointsPlaced and acceptance-order index', () => {
    const plan: Pick<TeamPlan, 'pointResets' | 'perHero'> = {
      perHero: [perHeroRow('hero-1', 135)],
      pointResets: [pointReset('hero-1', { attack: 10 }, { attack: 5, luck: 20 }, 135_000)],
    };
    const [unit] = derivePointsUnits(plan);
    expect(unit).toMatchObject({
      index: 0,
      heroId: 'hero-1',
      level: 135,
      needsRespec: true,
      respecGold: 135_000,
      pointsPlaced: 25,
    });
    expect(unit!.vectorBefore).toEqual([10, 0, 0, 0, 0, 0, 0, 0]);
    expect(unit!.vector).toEqual([5, 0, 0, 20, 0, 0, 0, 0]);
  });

  it('falls back to resetCostGold / 1000 when perHero is missing the hero and a respec is needed', () => {
    const plan: Pick<TeamPlan, 'pointResets' | 'perHero'> = {
      perHero: [],
      pointResets: [pointReset('hero-2', { attack: 10 }, { attack: 5 }, 80_000)],
    };
    const [unit] = derivePointsUnits(plan);
    expect(unit!.level).toBe(80);
  });

  it('falls back to 0 when perHero is missing the hero and no respec is needed', () => {
    const plan: Pick<TeamPlan, 'pointResets' | 'perHero'> = {
      perHero: [],
      pointResets: [pointReset('hero-3', { attack: 5 }, { attack: 10 }, 0)],
    };
    const [unit] = derivePointsUnits(plan);
    expect(unit!.level).toBe(0);
    expect(unit!.needsRespec).toBe(false);
  });

  it('counts only the points the commit adds when nothing is refunded � a level-56 hero with one free point places 1, not 56', () => {
    const plan: Pick<TeamPlan, 'pointResets' | 'perHero'> = {
      perHero: [perHeroRow('hero-4', 56)],
      pointResets: [pointReset('hero-4', { attack: 30, luck: 25 }, { attack: 30, luck: 26 }, 0)],
    };
    const [unit] = derivePointsUnits(plan);
    expect(unit!.needsRespec).toBe(false);
    expect(unit!.pointsPlaced).toBe(1);
  });

  it('preserves acceptance order across multiple resets', () => {
    const plan: Pick<TeamPlan, 'pointResets' | 'perHero'> = {
      perHero: [perHeroRow('hero-a', 10), perHeroRow('hero-b', 20)],
      pointResets: [
        pointReset('hero-b', { attack: 1 }, { attack: 2 }, 0),
        pointReset('hero-a', { attack: 1 }, { attack: 2 }, 0),
      ],
    };
    const units = derivePointsUnits(plan);
    expect(units.map((u) => u.heroId)).toEqual(['hero-b', 'hero-a']);
    expect(units.map((u) => u.index)).toEqual([0, 1]);
  });
});

describe('preflightPointsUnit — the four verdicts, in precedence order', () => {
  const baseUnit = derivePointsUnits({
    perHero: [perHeroRow('hero-1', 135)],
    pointResets: [pointReset('hero-1', { attack: 10 }, { attack: 5, luck: 20 }, 135_000)],
  })[0]!;

  function reading(alloc: readonly number[], spent: number): HeroAllocationReading {
    return { alloc: alloc as unknown as HeroAllocationReading['alloc'], spent };
  }

  it('done when alloc equals vector', () => {
    expect(preflightPointsUnit(baseUnit, reading([5, 0, 0, 20, 0, 0, 0, 0], 25))).toEqual({ index: 0, status: 'done' });
  });

  it('done when both vectorBefore and vector are all zeros and alloc is all zeros too (vector equality precedes the all-zeros rule)', () => {
    const zeroPlan = derivePointsUnits({
      perHero: [perHeroRow('hero-z', 10)],
      pointResets: [pointReset('hero-z', {}, {}, 0)],
    });
    const unit = zeroPlan[0]!;
    expect(preflightPointsUnit(unit, reading([0, 0, 0, 0, 0, 0, 0, 0], 0))).toEqual({ index: 0, status: 'done' });
  });

  it('pendingCommit when alloc is all zeros and spent is 0 (a hero respec\'d by hand)', () => {
    expect(preflightPointsUnit(baseUnit, reading([0, 0, 0, 0, 0, 0, 0, 0], 0))).toEqual({ index: 0, status: 'pendingCommit' });
  });

  it('pendingFull when alloc equals vectorBefore and the unit needsRespec', () => {
    expect(preflightPointsUnit(baseUnit, reading([10, 0, 0, 0, 0, 0, 0, 0], 10))).toEqual({ index: 0, status: 'pendingFull' });
  });

  it('pendingCommit when alloc equals vectorBefore and the unit does not need a respec', () => {
    const unit = derivePointsUnits({
      perHero: [perHeroRow('hero-1', 135)],
      pointResets: [pointReset('hero-1', { attack: 5 }, { attack: 10 }, 0)],
    })[0]!;
    expect(preflightPointsUnit(unit, reading([5, 0, 0, 0, 0, 0, 0, 0], 5))).toEqual({ index: 0, status: 'pendingCommit' });
  });

  it('conflict(allocationChanged) otherwise', () => {
    expect(preflightPointsUnit(baseUnit, reading([1, 1, 1, 1, 1, 1, 1, 1], 8))).toEqual({
      index: 0,
      status: 'conflict',
      reason: 'allocationChanged',
    });
  });

  it('a level-1 hero with one unplaced point reads pendingCommit (documented harmless case)', () => {
    const unit = derivePointsUnits({
      perHero: [perHeroRow('hero-1', 1)],
      pointResets: [pointReset('hero-1', { attack: 0 }, { attack: 1 }, 0)],
    })[0]!;
    expect(preflightPointsUnit(unit, reading([0, 0, 0, 0, 0, 0, 0, 0], 0))).toEqual({ index: 0, status: 'pendingCommit' });
  });
});

describe('preflightPointsUnitsOffline', () => {
  const units = derivePointsUnits({
    perHero: [perHeroRow('hero-1', 10), perHeroRow('hero-2', 20)],
    pointResets: [
      pointReset('hero-1', { attack: 1 }, { attack: 2 }, 0),
      pointReset('hero-2', { attack: 1 }, { attack: 2 }, 0),
    ],
  });

  it('pending for a hero on the roster, conflict(heroMissing) otherwise, nothing else', () => {
    const verdicts = preflightPointsUnitsOffline(units, new Set(['hero-1']));
    expect(verdicts).toEqual([
      { index: 0, status: 'pending' },
      { index: 1, status: 'conflict', reason: 'heroMissing' },
    ]);
  });
});
