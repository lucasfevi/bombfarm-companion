import { describe, expect, it } from 'vitest';
import { derivePlateauBounds, squadEnergyShare } from '@bombfarm/domain/farm-optimize-search';
import type { HeroFarmBasis } from '@bombfarm/domain/farm-rate';

describe('derivePlateauBounds on synthetic ladders, which need no capture', () => {
  it('spans every contiguous rung within tolerance on both sides of the winner', () => {
    const ladder = [
      { share: 0.4, value: 90 },
      { share: 0.45, value: 96 },
      { share: 0.5, value: 99 },
      { share: 0.55, value: 100 },
      { share: 0.6, value: 97 },
      { share: 0.65, value: 80 },
    ];
    expect(derivePlateauBounds(ladder, 0.55, 100, 5)).toEqual({ min: 0.45, max: 0.6 });
  });

  it('collapses to the winning share when the nearest rung falls below tolerance', () => {
    expect(derivePlateauBounds([{ share: 0.5, value: 50 }], 0.52, 100, 1)).toEqual({ min: 0.52, max: 0.52 });
  });

  it('collapses to the winning share on an empty ladder', () => {
    expect(derivePlateauBounds([], 0.33, 100, 1)).toEqual({ min: 0.33, max: 0.33 });
  });
});

describe('squadEnergyShare', () => {
  const zero = { attack: 0, energy: 0, speed: 0, critChance: 0, critDmg: 0, penetration: 0, cdr: 0, luck: 0 };
  const basis = { heroId: 'a', pts: { ...zero, attack: 30, energy: 10, speed: 20 } } as unknown as HeroFarmBasis;

  it('divides energy by the attack-and-energy pool, skipping a searchable id with no basis', () => {
    expect(squadEnergyShare([basis], ['a', 'missing'], new Map([['a', 60]]), null)).toBeCloseTo(10 / 40);
  });

  it('is 0 when no searchable hero has a pool', () => {
    expect(squadEnergyShare([basis], ['missing'], new Map(), null)).toBe(0);
  });
});
