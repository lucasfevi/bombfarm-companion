import { describe, expect, it } from 'vitest';
import { computeHeroFarmBases, heroFactsFromBasis } from '@bombfarm/domain/farm-rate';
import { critPointCeilingOf } from '@bombfarm/domain/team-aura-layer';
import { STAT_CAPS, activeDps, readCritChance, sustainedDps, type Context, type HeroSheet } from '@bombfarm/domain/model';
import type { SheetKey } from '@bombfarm/domain/planner-constants';
import { loadFarmRateFixture } from './helpers/farm-rate-fixtures';

const { heroes, account } = loadFarmRateFixture();
const basis = computeHeroFarmBases({ heroes, account }).find((candidate) => candidate.effectiveDelta.critChance > 0)!;
const manyCritPoints: Record<SheetKey, number> = { ...basis.pts, critChance: basis.pts.critChance + 1000 };
const critOf = (candidate: typeof basis, pts: Record<SheetKey, number>) =>
  heroFactsFromBasis(candidate, pts).critChancePct;

describe('critPointCeilingOf', () => {
  it('is the plain cap when the average aura already is the full aura', () => {
    expect(critPointCeilingOf(20, 20)).toBe(STAT_CAPS.critChance);
  });

  it('leaves the average aura on top of the sheet headroom the full aura allows', () => {
    expect(critPointCeilingOf(20, 16)).toBe(STAT_CAPS.critChance - 4);
  });
});

describe('a basis with a crit ceiling', () => {
  const ceiling = basis.effective.critChance + 5;

  it('stops bought crit chance at the ceiling', () => {
    expect(critOf({ ...basis, critPointCeiling: ceiling }, manyCritPoints)).toBeCloseTo(ceiling, 9);
  });

  it('prices the vector it was built at as it stands, even above the ceiling', () => {
    const above = { ...basis, critPointCeiling: basis.effective.critChance - 5 };
    expect(critOf(above, basis.pts)).toBeCloseTo(basis.effective.critChance, 9);
  });

  it('clamps the whole sheet when it binds the sheet', () => {
    const bound = { ...basis, critPointCeiling: basis.effective.critChance - 5, critCeilingBindsSheet: true };
    expect(critOf(bound, basis.pts)).toBeCloseTo(basis.effective.critChance - 5, 9);
  });

  it('adds nothing when no ceiling is set', () => {
    const { critPointCeiling: _unused, ...plain } = basis;
    expect(critOf(plain, manyCritPoints)).toBeGreaterThan(ceiling);
  });
});

describe('a sheet with a crit ceiling, scored for damage', () => {
  const sheet: HeroSheet = {
    rarity: 'Lendária',
    attack: 1000,
    energy: 400,
    speed: 100,
    critChance: 96,
    critDmg: 300,
    penetration: 50,
    cdr: 20,
    attackPerPoint: 10,
    energyPerPoint: 5,
  };
  const context: Context = { restSeconds: 30, mitigation: 0.3, blastRange: 1, ato: 1, drainMult: 1 };

  it('credits crit chance only up to the ceiling', () => {
    expect(readCritChance({ ...sheet, critCeiling: 90 })).toBe(90);
    expect(activeDps({ ...sheet, critCeiling: 90 }, context)).toBeCloseTo(
      activeDps({ ...sheet, critChance: 90 }, context),
      9,
    );
  });

  it('leaves a sheet under its ceiling as it stands', () => {
    expect(activeDps({ ...sheet, critCeiling: 99 }, context)).toBeCloseTo(activeDps(sheet, context), 9);
  });

  it('values a point bought past the ceiling at nothing', () => {
    const capped = { ...sheet, critCeiling: 96 };
    expect(sustainedDps({ ...capped, critChance: 100 }, context)).toBeCloseTo(sustainedDps(capped, context), 9);
  });
});
