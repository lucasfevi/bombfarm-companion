import { describe, expect, it } from 'vitest';
import { capFirstPts, capOf, generateCapMoves, pointsToCap, speedPointsToWalkInsideFuse } from '@bombfarm/domain/farm-stat-caps';
import { buildCandidateSheet, budgetOf, REOPT_KEYS, zeroedRespecKeys } from '@bombfarm/domain/points-reopt-core';
import type { HeroFarmBasis } from '@bombfarm/domain/farm-rate';
import type { SheetKey } from '@bombfarm/domain/planner-constants';
import type { HeroSheet } from '@bombfarm/domain/model';

const ZERO: Record<SheetKey, number> = {
  attack: 0,
  energy: 0,
  speed: 0,
  luck: 0,
  critChance: 0,
  critDmg: 0,
  penetration: 0,
  cdr: 0,
};

const SHEET: HeroSheet = {
  rarity: 'Raro',
  attack: 1000,
  energy: 500,
  speed: 100,
  critChance: 60,
  critDmg: 300,
  penetration: 20,
  cdr: 30,
  attackPerPoint: 5,
  energyPerPoint: 3,
};

function basisWith(overrides: Partial<HeroFarmBasis> = {}): HeroFarmBasis {
  return {
    heroId: 'h1',
    pts: { ...ZERO },
    effective: SHEET,
    effectiveDelta: { attack: 5, energy: 3, speed: 0.5, critChance: 0.7, critDmg: 6, penetration: 0.4, cdr: 0.23, luck: 0.03 },
    ...overrides,
  } as HeroFarmBasis;
}

function sheetOf(basis: HeroFarmBasis, pts: Record<SheetKey, number>) {
  return buildCandidateSheet(basis.effective, basis.pts, basis.effectiveDelta, pts);
}

describe('pointsToCap', () => {
  it('is the fewest points that reach the cap', () => {
    const basis = basisWith();
    const need = pointsToCap(basis, ZERO, 'cdr')!;
    expect(sheetOf(basis, { ...ZERO, cdr: need }).cdr).toBeGreaterThanOrEqual(80);
    expect(sheetOf(basis, { ...ZERO, cdr: need - 1 }).cdr).toBeLessThan(80);
  });

  it('caps crit chance where the team aura at full presence tops it up to 100', () => {
    const basis = basisWith({ critPointCeiling: 80, critCeilingBindsSheet: true });
    expect(capOf(basis, 'critChance')).toBe(80);
    const need = pointsToCap(basis, ZERO, 'critChance')!;
    expect(sheetOf(basis, { ...ZERO, critChance: need }).critChance).toBeGreaterThanOrEqual(80);
    expect(sheetOf(basis, { ...ZERO, critChance: need - 1 }).critChance).toBeLessThan(80);
  });

  it('is negative by the points that can come off a stat spent past its cap', () => {
    const basis = basisWith();
    const need = pointsToCap(basis, ZERO, 'cdr')!;
    expect(pointsToCap(basis, { ...ZERO, cdr: need + 3 }, 'cdr')).toBe(-3);
  });

  it('is null when a point buys nothing on the stat', () => {
    const basis = basisWith({ effectiveDelta: { ...basisWith().effectiveDelta, cdr: 0 } });
    expect(pointsToCap(basis, ZERO, 'cdr')).toBeNull();
  });
});

describe('generateCapMoves', () => {
  const basis = basisWith();
  const moves = generateCapMoves(basis, REOPT_KEYS);
  const start = { ...ZERO, attack: 150, critDmg: 150, speed: 40 };

  it('reaches a cap in one move from a build far below it', () => {
    const capped = moves.map((move) => move(start, 0)).filter((pts) => pts && sheetOf(basis, pts).cdr >= 80);
    expect(capped.length).toBeGreaterThan(0);
    for (const pts of capped) {
      expect(budgetOf(pts!)).toBe(budgetOf(start));
      expect(pointsToCap(basis, pts!, 'cdr')).toBe(0);
    }
  });

  it('spends banked points on the cap before taking any from a stat', () => {
    const need = pointsToCap(basis, start, 'cdr')!;
    const fromBank = moves.map((move) => move(start, need)).find((pts) => pts && pts.cdr === need);
    expect(fromBank).toEqual({ ...start, cdr: need });
  });

  it('moves the points spent past a cap onto another stat', () => {
    const need = pointsToCap(basis, ZERO, 'cdr')!;
    const over = { ...start, cdr: need + 5 };
    const shed = moves.map((move) => move(over, 0)).find((pts) => pts && pts.cdr === need && pts.critDmg === start.critDmg + 5);
    expect(shed).toBeDefined();
  });
});

describe('capFirstPts', () => {
  it('buys crit chance to its cap, then cooldown, and spends the whole budget', () => {
    const basis = basisWith();
    const pts = capFirstPts(basis, 600, { cdr: true, speed: false, energyShare: 0.25, critDmgShare: 0.5 });
    expect(budgetOf(pts)).toBe(600);
    expect(pointsToCap(basis, pts, 'critChance')).toBe(0);
    expect(pointsToCap(basis, pts, 'cdr')).toBe(0);
  });

  it('leaves damage points when a cap needs more than the budget can spare', () => {
    const basis = basisWith();
    const pts = capFirstPts(basis, 100, { cdr: true, speed: false, energyShare: 0, critDmgShare: 0.5 });
    expect(budgetOf(pts)).toBe(100);
    expect(pts.attack + pts.critDmg).toBeGreaterThan(0);
  });

  it('places nothing on cooldown when the shape leaves it out', () => {
    const pts = capFirstPts(basisWith(), 400, { cdr: false, speed: false, energyShare: 0.25, critDmgShare: 0.5 });
    expect(pts.cdr).toBe(zeroedRespecKeys(ZERO).cdr);
  });
});

describe('speedPointsToWalkInsideFuse', () => {
  const basis = basisWith({
    effective: { ...SHEET, speed: 40, cdr: 80 },
  });

  it('buys the fewest speed points at which the walk fits inside the fuse', () => {
    const speed = speedPointsToWalkInsideFuse(basis, ZERO, 1000);
    expect(speed).toBeGreaterThan(0);
    expect(speed).toBeLessThan(1000);
    expect(speedPointsToWalkInsideFuse(basis, { ...ZERO, speed }, 1000)).toBe(0);
    expect(speedPointsToWalkInsideFuse(basis, { ...ZERO, speed: speed - 1 }, 1000)).toBe(1);
  });

  it('needs more speed the shorter the fuse', () => {
    const slowFuse = basisWith({ effective: { ...basis.effective, cdr: 40 } });
    expect(speedPointsToWalkInsideFuse(slowFuse, ZERO, 1000)).toBeLessThan(speedPointsToWalkInsideFuse(basis, ZERO, 1000));
  });

  it('stops at the limit when the fuse cannot be met', () => {
    expect(speedPointsToWalkInsideFuse(basis, ZERO, 3)).toBe(3);
  });

  it('puts speed in a cap-first build, not energy', () => {
    const pts = capFirstPts(basis, 600, { cdr: true, speed: true, energyShare: 0, critDmgShare: 0.5 });
    expect(pts.energy).toBe(0);
    expect(pts.speed).toBeGreaterThan(0);
    expect(budgetOf(pts)).toBe(600);
  });
});
