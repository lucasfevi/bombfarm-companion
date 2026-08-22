import { describe, expect, it } from 'vitest';
import { combineDrainRate, DRAIN_RATE_FLOOR, DRAIN_REDUCTION_CAP } from '@bombfarm/domain/drain';
import { fieldSeconds, POINT_GAIN, type Context, type HeroSheet } from '@bombfarm/domain/model';

const baseCtx = (): Context => ({
  restSeconds: 12 * 60,
  mitigation: 0.067,
  blastRange: 1,
  cycleModel: 'serial',
  walkDelay: 0.15,
  drainMult: 1,
});

const sampleHero = (): HeroSheet => ({
  rarity: 'Raro',
  attack: 400,
  energy: 400,
  speed: 55,
  critChance: 12,
  critDmg: 80,
  penetration: 8,
  cdr: 10,
  attackPerPoint: POINT_GAIN.attackNative,
  energyPerPoint: POINT_GAIN.energyNative,
});

describe('combineDrainRate — constants', () => {
  it('caps each term at 0.20 and floors the combined rate at 0.60', () => {
    expect(DRAIN_REDUCTION_CAP).toBe(0.2);
    expect(DRAIN_RATE_FLOOR).toBe(0.6);
  });
});

describe('combineDrainRate — corners', () => {
  it('neither reduction: base rate is exactly 1.00', () => {
    expect(combineDrainRate(1, 1)).toBe(1);
  });

  it('self reduction only: 0.80', () => {
    expect(combineDrainRate(0.8, 1)).toBeCloseTo(0.8, 10);
  });

  it('aura reduction only: 0.80', () => {
    expect(combineDrainRate(1, 0.8)).toBeCloseTo(0.8, 10);
  });

  it('both at their caps: additive floor of 0.60, not the multiplicative 0.64', () => {
    expect(combineDrainRate(0.8, 0.8)).toBeCloseTo(0.6, 10);
  });
});

describe('combineDrainRate — defensive clamping', () => {
  it('an out-of-range self multiplier still only removes the 0.20 cap', () => {
    expect(combineDrainRate(0.5, 1)).toBeCloseTo(0.8, 10);
  });

  it('an out-of-range aura multiplier still only removes the 0.20 cap', () => {
    expect(combineDrainRate(1, 0.5)).toBeCloseTo(0.8, 10);
  });

  it('the floor is not breached even when both inputs claim reductions past the cap', () => {
    expect(combineDrainRate(0, 0)).toBeCloseTo(DRAIN_RATE_FLOOR, 10);
    expect(combineDrainRate(-5, -5)).toBeCloseTo(DRAIN_RATE_FLOOR, 10);
  });

  it('a multiplier above 1 (would increase drain) contributes zero reduction, not a negative one', () => {
    expect(combineDrainRate(1.5, 1)).toBe(1);
  });
});

describe('combineDrainRate — fieldSeconds regression', () => {
  it('a both-ability hero gets exactly 16/15 (~1.0667x) the field time the old multiplicative formula gave', () => {
    const hero = sampleHero();
    const oldDrainMult = 0.8 * 0.8; // the multiplicative combination this fix replaces
    const newDrainMult = combineDrainRate(0.8, 0.8);

    const oldField = fieldSeconds(hero, { ...baseCtx(), drainMult: oldDrainMult });
    const newField = fieldSeconds(hero, { ...baseCtx(), drainMult: newDrainMult });

    expect(newField / oldField).toBeCloseTo(16 / 15, 10);
  });
});
