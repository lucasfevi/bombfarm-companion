import { describe, expect, it } from 'vitest';
import {
  FORGE_SAFE,
  forgeChance,
  forgeCritChance,
  forgeFailFloor,
  forgeRollCost,
  forgeSafeJumpCost,
  nextForgeStep,
} from '@bombfarm/domain/forge';

describe('forgeChance', () => {
  it('is certain for +1…+8 and falls from 0.8 at +9 to 0.2 at +15', () => {
    expect(forgeChance(1)).toBe(1);
    expect(forgeChance(8)).toBe(1);
    expect(forgeChance(9)).toBe(0.8);
    expect(forgeChance(12)).toBe(0.5);
    expect(forgeChance(15)).toBe(0.2);
  });

  it('throws for a target outside +1…+15 or one that is not a whole level', () => {
    expect(() => forgeChance(0)).toThrow(RangeError);
    expect(() => forgeChance(16)).toThrow(RangeError);
    expect(() => forgeChance(9.5)).toThrow(RangeError);
  });
});

describe('forgeCritChance', () => {
  it('is one in a thousand up to +14 and nothing at +15', () => {
    expect(forgeCritChance(1)).toBe(0.001);
    expect(forgeCritChance(14)).toBe(0.001);
    expect(forgeCritChance(15)).toBe(0);
  });
});

describe('forgeFailFloor', () => {
  it('sends a failed +9…+14 back to +8 and a failed +15 back to +0', () => {
    expect(forgeFailFloor(9)).toBe(8);
    expect(forgeFailFloor(14)).toBe(8);
    expect(forgeFailFloor(15)).toBe(0);
  });

  it('throws for a target outside the ladder', () => {
    expect(() => forgeFailFloor(0)).toThrow(RangeError);
    expect(() => forgeFailFloor(16)).toThrow(RangeError);
  });
});

describe('forgeRollCost', () => {
  it('throws for an item level the table has no row for', () => {
    expect(() => forgeRollCost(15, 0, 1)).toThrow(/level 15/);
    expect(() => forgeRollCost(310, 0, 1)).toThrow(/level 310/);
  });

  it('throws for a rarity outside 0…5', () => {
    expect(() => forgeRollCost(10, -1, 1)).toThrow(/rarity -1/);
    expect(() => forgeRollCost(10, 6, 1)).toThrow(/rarity 6/);
  });

  it('throws for a target outside +1…+15', () => {
    expect(() => forgeRollCost(10, 0, 0)).toThrow(RangeError);
    expect(() => forgeRollCost(10, 0, 16)).toThrow(RangeError);
  });
});

describe('nextForgeStep', () => {
  it('is done once the item sits at or above the target', () => {
    expect(nextForgeStep(12, 12, 300, 5)).toEqual({ kind: 'done' });
    expect(nextForgeStep(15, 12, 300, 5)).toEqual({ kind: 'done' });
    expect(nextForgeStep(0, 0, 10, 0)).toEqual({ kind: 'done' });
  });

  it('takes the safe jump only from below +8 with a target of +8 or higher', () => {
    expect(nextForgeStep(0, 8, 10, 0)).toEqual({ kind: 'safe', target: FORGE_SAFE, cost: 14_200 });
    expect(nextForgeStep(7, 15, 10, 0)).toEqual({ kind: 'safe', target: FORGE_SAFE, cost: 14_200 });
    expect(nextForgeStep(8, 15, 10, 0).kind).toBe('roll');
  });

  it('climbs one step at a time when the target is below +8, because a safe jump would overshoot', () => {
    expect(nextForgeStep(3, 7, 10, 0)).toEqual({ kind: 'roll', target: 4, chance: 1, failTo: 8, cost: 1_250 });
    expect(nextForgeStep(6, 7, 10, 0)).toEqual({ kind: 'roll', target: 7, chance: 1, failTo: 8, cost: 3_200 });
  });

  it('rolls for the next level above +8, carrying its chance, its fail floor and its cost', () => {
    expect(nextForgeStep(8, 15, 300, 5)).toEqual({
      kind: 'roll',
      target: 9,
      chance: 0.8,
      failTo: 8,
      cost: forgeRollCost(300, 5, 9),
    });
    expect(nextForgeStep(14, 15, 300, 5)).toEqual({
      kind: 'roll',
      target: 15,
      chance: 0.2,
      failTo: 0,
      cost: forgeRollCost(300, 5, 15),
    });
  });

  it('prices the safe jump at the safe-jump cost and a roll at that single roll', () => {
    const safe = nextForgeStep(2, 10, 200, 3);
    expect(safe.kind === 'safe' && safe.cost).toBe(forgeSafeJumpCost(200, 3));
    const roll = nextForgeStep(10, 12, 200, 3);
    expect(roll.kind === 'roll' && roll.cost).toBe(forgeRollCost(200, 3, 11));
  });

  it('throws for a target above the ladder rather than inventing a level', () => {
    expect(() => nextForgeStep(15, 16, 300, 5)).toThrow(RangeError);
  });
});
