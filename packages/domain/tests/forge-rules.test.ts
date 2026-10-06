import { describe, expect, it } from 'vitest';
import {
  FORGE_FAIL_FLOOR,
  FORGE_GUARANTEED,
  FORGE_PITY_CAP,
  forgeChance,
  forgeCritChance,
  forgeFailLevel,
  forgeProtectable,
  forgeRollCost,
  forgeRollEssence,
  forgeScrollCost,
  nextForgeStep,
} from '@bombfarm/domain/forge';

describe('forgeChance', () => {
  it('is certain for +1…+4 and falls from 0.9 at +5 to 0.1 at +15', () => {
    expect(forgeChance(1)).toBe(1);
    expect(forgeChance(FORGE_GUARANTEED)).toBe(1);
    expect(forgeChance(5)).toBe(0.9);
    expect(forgeChance(9)).toBe(0.5);
    expect(forgeChance(12)).toBe(0.25);
    expect(forgeChance(15)).toBe(0.1);
  });

  it('adds five points per miss in a row and never passes certainty', () => {
    expect(forgeChance(15, 1)).toBeCloseTo(0.15, 12);
    expect(forgeChance(15, 5)).toBeCloseTo(0.35, 12);
    expect(forgeChance(5, 2)).toBe(1);
    expect(forgeChance(5, 50)).toBe(1);
  });

  it('is certain for every target once the miss cap is reached', () => {
    for (let target = 1; target <= 15; target++) expect(forgeChance(target, FORGE_PITY_CAP)).toBe(1);
    expect(forgeChance(15, FORGE_PITY_CAP - 1)).toBeLessThan(1);
  });

  it('throws for a target outside +1…+15, a fractional one, or a negative miss count', () => {
    expect(() => forgeChance(0)).toThrow(RangeError);
    expect(() => forgeChance(16)).toThrow(RangeError);
    expect(() => forgeChance(9.5)).toThrow(RangeError);
    expect(() => forgeChance(9, -1)).toThrow(RangeError);
  });
});

describe('forgeCritChance', () => {
  it('is one in a thousand up to +14 and nothing at +15', () => {
    expect(forgeCritChance(1)).toBe(0.001);
    expect(forgeCritChance(14)).toBe(0.001);
    expect(forgeCritChance(15)).toBe(0);
  });
});

describe('forgeFailLevel', () => {
  it('drops a miss by one level up to +11, and to the +10 floor from +12 up', () => {
    expect(forgeFailLevel(1)).toBe(0);
    expect(forgeFailLevel(5)).toBe(4);
    expect(forgeFailLevel(11)).toBe(10);
    expect(forgeFailLevel(12)).toBe(FORGE_FAIL_FLOOR);
    expect(forgeFailLevel(15)).toBe(FORGE_FAIL_FLOOR);
  });

  it('never lands above the level the roll was made from', () => {
    for (let target = 1; target <= 15; target++) expect(forgeFailLevel(target)).toBeLessThanOrEqual(target - 1);
  });

  it('throws for a target outside the ladder', () => {
    expect(() => forgeFailLevel(0)).toThrow(RangeError);
    expect(() => forgeFailLevel(16)).toThrow(RangeError);
  });
});

describe('forgeRollCost and forgeRollEssence', () => {
  it('throws for an item level the table has no row for', () => {
    expect(() => forgeRollCost(15, 0, 1)).toThrow(/level 15/);
    expect(() => forgeRollEssence(310, 0, 1)).toThrow(/level 310/);
  });

  it('throws for a rarity outside 0…5', () => {
    expect(() => forgeRollCost(10, -1, 1)).toThrow(/rarity -1/);
    expect(() => forgeRollEssence(10, 6, 1)).toThrow(/rarity 6/);
  });

  it('throws for a target outside +1…+15', () => {
    expect(() => forgeRollCost(10, 0, 0)).toThrow(RangeError);
    expect(() => forgeRollEssence(10, 0, 16)).toThrow(RangeError);
  });
});

describe('forgeScrollCost', () => {
  it('prices a level-140 uncommon +14 roll at 12,320, the figure the game shows on such a piece', () => {
    expect(forgeScrollCost(140, 1, 14)).toBe(12_320);
  });

  it('only exists for +12…+15', () => {
    expect(() => forgeScrollCost(100, 2, 11)).toThrow(/scroll/);
    expect(forgeScrollCost(100, 2, 15)).toBe(120_000);
  });
});

describe('nextForgeStep', () => {
  it('is done once the item sits at or above the target', () => {
    expect(nextForgeStep(12, 12, 300, 5)).toEqual({ kind: 'done' });
    expect(nextForgeStep(15, 12, 300, 5)).toEqual({ kind: 'done' });
    expect(nextForgeStep(0, 0, 10, 0)).toEqual({ kind: 'done' });
  });

  it('rolls every rung one at a time, never jumping, so the guaranteed rungs are rolls at 100%', () => {
    expect(nextForgeStep(0, 15, 10, 0)).toEqual({
      kind: 'roll',
      target: 1,
      chance: 1,
      failTo: 0,
      cost: 200,
      essence: 1,
      protection: 0,
      stoneUsed: false,
      stone: null,
    });
    expect(nextForgeStep(3, 7, 10, 0)).toMatchObject({ kind: 'roll', target: 4, chance: 1, failTo: 3, cost: 1_250 });
  });

  it('carries the chance with its pity, the landing level and the gold and essence of the roll', () => {
    expect(nextForgeStep(11, 15, 300, 5, 2)).toEqual({
      kind: 'roll',
      target: 12,
      chance: 0.35,
      failTo: 10,
      cost: forgeRollCost(300, 5, 12),
      essence: forgeRollEssence(300, 5, 12),
      protection: 0,
      stoneUsed: false,
      stone: null,
    });
    expect(nextForgeStep(14, 15, 300, 5)).toMatchObject({ target: 15, chance: 0.1, failTo: 10 });
  });

  it('throws for a target above the ladder rather than inventing a level', () => {
    expect(() => nextForgeStep(15, 16, 300, 5)).toThrow(RangeError);
  });
});

describe('a Chance Stone', () => {
  it('adds its points to the one attempt, on top of the pity, capped at certainty', () => {
    const plain = nextForgeStep(13, 15, 100, 2, 0, { stonePp: 0.3 });
    expect(plain).toMatchObject({ stoneUsed: true });
    expect(plain.kind === 'roll' && plain.chance).toBeCloseTo(0.45, 12);
    const withPity = nextForgeStep(13, 15, 100, 2, 2, { stonePp: 0.3 });
    expect(withPity).toMatchObject({ stoneUsed: true });
    expect(withPity.kind === 'roll' && withPity.chance).toBeCloseTo(0.55, 12);
    expect(nextForgeStep(13, 15, 100, 2, 0, { stonePp: 0.9 })).toMatchObject({ chance: 1, stoneUsed: true });
  });

  it('is refused, and not spent, when the chance is already certain', () => {
    expect(nextForgeStep(0, 15, 100, 2, 0, { stonePp: 0.6 })).toMatchObject({ chance: 1, stoneUsed: false });
    expect(nextForgeStep(4, 15, 100, 2, 2, { stonePp: 0.6 })).toMatchObject({ chance: 1, stoneUsed: false });
  });
});

describe('the Protection Scroll', () => {
  it('is offered only where a miss would cost levels, +12…+15', () => {
    expect([10, 11, 12, 13, 14, 15].map(forgeProtectable)).toEqual([false, false, true, true, true, true]);
  });

  it('keeps the piece one level under the target on a miss, and charges its essence price', () => {
    expect(nextForgeStep(13, 15, 140, 1, 0, { protect: true })).toMatchObject({
      target: 14,
      failTo: 13,
      protection: 12_320,
    });
    expect(nextForgeStep(10, 15, 140, 1, 0, { protect: true })).toMatchObject({ target: 11, failTo: 10, protection: 0 });
  });

  it('changes nothing when it is not ticked', () => {
    expect(nextForgeStep(13, 15, 140, 1, 0, { protect: false })).toMatchObject({ failTo: 10, protection: 0 });
  });
});

describe('the Collection forge bonus', () => {
  it('is a flat addend to the chance, capped at certainty, and defaults to nothing', () => {
    expect(forgeChance(15, 0, 0.1)).toBeCloseTo(0.2, 12);
    expect(forgeChance(15, 0, 5)).toBe(1);
    expect(nextForgeStep(14, 15, 100, 2, 0, { bonus: 0.05 })).toMatchObject({ target: 15 });
    expect(nextForgeStep(14, 15, 100, 2, 0, {})).toMatchObject({ chance: 0.1 });
  });
});
