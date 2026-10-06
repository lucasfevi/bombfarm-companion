import { describe, expect, it } from 'vitest';
import {
  MAX_STONE_RANGES,
  addStoneRange,
  joinStoneRanges,
  removeStoneRange,
  resolveStoneRanges,
  setStoneRangeEnd,
  setStoneRarity,
  stoneForTarget,
  stonePpForTarget,
  stonesByTarget,
  stonesCanBeUsed,
} from './forge-stones';

const FROM = 8;
const TO = 15;

describe('resolveStoneRanges', () => {
  it('is one range of no stone, from the next target to the plan target, when nothing is chosen', () => {
    expect(resolveStoneRanges([], FROM, TO)).toEqual([{ from: 9, to: 15, rarity: null }]);
  });

  it('runs the last range to the target whatever its stored end says', () => {
    const resolved = resolveStoneRanges(
      [
        { upTo: 12, rarity: 0 },
        { upTo: 13, rarity: 2 },
      ],
      FROM,
      TO,
    );
    expect(resolved).toEqual([
      { from: 9, to: 12, rarity: 0 },
      { from: 13, to: 15, rarity: 2 },
    ]);
  });

  it('drops ranges the piece has climbed past and ranges beyond a lowered target', () => {
    const stored = [
      { upTo: 10, rarity: 0 },
      { upTo: 13, rarity: 1 },
      { upTo: 15, rarity: 2 },
    ];
    expect(resolveStoneRanges(stored, 10, TO)).toEqual([
      { from: 11, to: 13, rarity: 1 },
      { from: 14, to: 15, rarity: 2 },
    ]);
    expect(resolveStoneRanges(stored, FROM, 12)).toEqual([
      { from: 9, to: 10, rarity: 0 },
      { from: 11, to: 12, rarity: 1 },
    ]);
  });

  it('has nothing to resolve once the piece is at or past the target', () => {
    expect(resolveStoneRanges([{ upTo: 15, rarity: 1 }], 15, 15)).toEqual([]);
  });
});

describe('editing ranges', () => {
  const two = [
    { upTo: 12, rarity: null },
    { upTo: 15, rarity: 3 },
  ];

  it('sets the stone of one range and leaves the rest alone', () => {
    expect(setStoneRarity(two, FROM, TO, 0, 1)).toEqual([
      { upTo: 12, rarity: 1 },
      { upTo: 15, rarity: 3 },
    ]);
    expect(setStoneRarity([], FROM, TO, 0, 4)).toEqual([{ upTo: 15, rarity: 4 }]);
  });

  it('moves an end and the next range starts after it', () => {
    const moved = setStoneRangeEnd(two, FROM, TO, 0, 10);
    expect(resolveStoneRanges(moved, FROM, TO)).toEqual([
      { from: 9, to: 10, rarity: null },
      { from: 11, to: 15, rarity: 3 },
    ]);
  });

  it('keeps every range at least one target wide when an end is pushed too far', () => {
    expect(resolveStoneRanges(setStoneRangeEnd(two, FROM, TO, 0, 30), FROM, TO)[1]).toEqual({ from: 15, to: 15, rarity: 3 });
    expect(resolveStoneRanges(setStoneRangeEnd(two, FROM, TO, 0, 2), FROM, TO)[0]).toEqual({ from: 9, to: 9, rarity: null });
  });

  it('has no end to move on the last range', () => {
    expect(setStoneRangeEnd(two, FROM, TO, 1, 13)).toEqual(two);
  });

  it('splits the last range, the new one keeping its stone, up to the cap', () => {
    let ranges = setStoneRarity([], FROM, TO, 0, 2);
    for (let count = 1; count < MAX_STONE_RANGES; count++) {
      ranges = addStoneRange(ranges, FROM, TO);
      expect(resolveStoneRanges(ranges, FROM, TO)).toHaveLength(count + 1);
    }
    expect(resolveStoneRanges(ranges, FROM, TO).every((range) => range.rarity === 2)).toBe(true);
    expect(addStoneRange(ranges, FROM, TO)).toEqual(ranges);
  });

  it('cannot split a range that is a single target', () => {
    const single = [{ upTo: 9, rarity: 1 }];
    expect(addStoneRange(single, 8, 9)).toEqual(single);
  });

  it('removes a range into its neighbour, and never the only one', () => {
    const three = [
      { upTo: 10, rarity: 0 },
      { upTo: 12, rarity: 1 },
      { upTo: 15, rarity: 2 },
    ];
    expect(resolveStoneRanges(removeStoneRange(three, FROM, TO, 1), FROM, TO)).toEqual([
      { from: 9, to: 10, rarity: 0 },
      { from: 11, to: 15, rarity: 2 },
    ]);
    expect(resolveStoneRanges(removeStoneRange(three, FROM, TO, 2), FROM, TO)).toEqual([
      { from: 9, to: 10, rarity: 0 },
      { from: 11, to: 15, rarity: 1 },
    ]);
    expect(removeStoneRange([{ upTo: 15, rarity: 1 }], FROM, TO, 0)).toEqual([{ upTo: 15, rarity: 1 }]);
  });
});

describe('what the forecast reads', () => {
  const resolved = resolveStoneRanges(
    [
      { upTo: 12, rarity: 0 },
      { upTo: 13, rarity: null },
      { upTo: 15, rarity: 5 },
    ],
    FROM,
    TO,
  );

  it('is a stone per target, indexed by target minus one, and nothing at all when no stone is chosen', () => {
    const byTarget = stonesByTarget(resolved);
    expect(byTarget?.slice(8)).toEqual([0, 0, 0, 0, null, 5, 5]);
    expect(stonesByTarget(resolveStoneRanges([], FROM, TO))).toBeUndefined();
  });

  it('reads the stone and its points for one target, and none for a target that always lands', () => {
    expect(stoneForTarget(resolved, 14)).toBe(5);
    expect(stoneForTarget(resolved, 13)).toBeNull();
    expect(stonePpForTarget(resolved, 14)).toBeCloseTo(0.6, 12);
    expect(stonePpForTarget(resolveStoneRanges([{ upTo: 4, rarity: 5 }], 0, 4), 3)).toBe(0);
  });

  it('can be used only where some chosen target is not already certain', () => {
    expect(stonesCanBeUsed(resolved)).toBe(true);
    expect(stonesCanBeUsed(resolveStoneRanges([{ upTo: 4, rarity: 5 }], 0, 4))).toBe(false);
    expect(stonesCanBeUsed(resolveStoneRanges([], FROM, TO))).toBe(false);
  });
});

describe('joinStoneRanges', () => {
  it('folds every range into one that runs to the target and keeps the first stone', () => {
    const ranges = [
      { upTo: 11, rarity: 1 },
      { upTo: 15, rarity: 4 },
    ];
    expect(joinStoneRanges(ranges, FROM, TO)).toEqual([{ upTo: TO, rarity: 1 }]);
  });

  it('leaves a plan with no ranges as it was', () => {
    expect(joinStoneRanges([], FROM, TO)).toEqual([{ upTo: TO, rarity: null }]);
  });
});
