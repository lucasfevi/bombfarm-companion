import { describe, expect, it } from 'vitest';
import { forgeForecast, type ForgeOptions } from '@bombfarm/domain/forge';
import type { InventoryViewItem } from '@bombfarm/domain/inventory-view';
import type { ForgeQueueSettings } from './forge-queue-settings';
import { bagStandingOf, bagUpgrades, priceForgeQueue, resolveForgeQueue } from './forge-queue-view';

function item(id: string, upgrade: number, level = 30): InventoryViewItem {
  return { id, upgrade, level, rarityIdx: 1, defId: `def-${id}` } as unknown as InventoryViewItem;
}

const NO_STONES: number[] = [0, 0, 0, 0, 0, 0];
const PLAIN: ForgeQueueSettings = { ranges: [], stopWhenOutOfStones: true, scroll: false };
const COMMON_FROM_TEN: ForgeQueueSettings = {
  ranges: [
    { upTo: 9, rarity: null },
    { upTo: 15, rarity: 0 },
  ],
  stopWhenOutOfStones: true,
  scroll: false,
};
const STONES_FROM_TEN = [...Array<number | null>(9).fill(null), 0, 0, 0, 0, 0, 0];

function forecastOf(upgrade: number, target: number, options: ForgeOptions = {}) {
  return forgeForecast(upgrade, target, 30, 1, 0, options);
}

function rowsOf(...pieces: [string, number, number][]) {
  return resolveForgeQueue(
    pieces.map(([itemId, , target]) => ({ itemId, target })),
    pieces.map(([id, upgrade]) => item(id, upgrade)),
  );
}

describe('resolveForgeQueue', () => {
  it('pairs each piece with its bag row, and leaves a piece the bag no longer holds without one', () => {
    const rows = resolveForgeQueue(
      [
        { itemId: 'a', target: 12 },
        { itemId: 'gone', target: 10 },
      ],
      [item('a', 9)],
    );
    expect(rows.map((row) => row.item?.id ?? null)).toEqual(['a', null]);
  });

  it('bagUpgrades maps every bag row to where it stands', () => {
    expect(bagUpgrades([item('a', 9), item('b', 0)])).toEqual(
      new Map([
        ['a', 9],
        ['b', 0],
      ]),
    );
  });

  it('bagStandingOf reads one piece off the raw payload, and tells a bag without it from no bag at all', () => {
    const bag = [
      { id: 'a', def_id: 'ash_ring', upgrade: 12 },
      { id: 'b', def_id: 'ash_helm' },
      null,
      { def_id: 'no-id', upgrade: 3 },
    ];
    expect(bagStandingOf(bag, 'a')).toEqual({ kind: 'held', upgrade: 12 });
    expect(bagStandingOf(bag, 'b')).toEqual({ kind: 'held', upgrade: 0 });
    expect(bagStandingOf(bag, 'gone')).toEqual({ kind: 'gone' });
    expect(bagStandingOf(undefined, 'a')).toEqual({ kind: 'unknown' });
  });
});

describe('priceForgeQueue', () => {
  it('prices a piece from the misses in a row it carries', () => {
    const carrying = { ...item('a', 13), forgeFails: 3 } as InventoryViewItem;
    const pricing = priceForgeQueue(resolveForgeQueue([{ itemId: 'a', target: 14 }], [carrying]), PLAIN, NO_STONES);
    expect(pricing.gold).toBeCloseTo(forgeForecast(13, 14, 30, 1, 3).gold);
    expect(pricing.gold).toBeLessThan(forgeForecast(13, 14, 30, 1).gold);
  });

  it('with no stone chosen and no scroll, sums the plain forecasts and expects no stones', () => {
    const pricing = priceForgeQueue(rowsOf(['a', 9, 12], ['b', 0, 8]), PLAIN, NO_STONES);
    expect(pricing.gold).toBeCloseTo(forecastOf(9, 12).gold + forecastOf(0, 8).gold);
    expect(pricing.essence).toBeCloseTo(forecastOf(9, 12).essence + forecastOf(0, 8).essence);
    expect(pricing.stonesNeeded.every((count) => count === 0)).toBe(true);
    expect(pricing.runsOutAt).toBeNull();
  });

  it('prices only the pieces it can, and has no total when it priced none', () => {
    const rows = resolveForgeQueue(
      [
        { itemId: 'a', target: 12 },
        { itemId: 'gone', target: 10 },
        { itemId: 'done', target: 8 },
        { itemId: 'odd', target: 10 },
      ],
      [item('a', 9), item('done', 8), item('odd', 0, 31)],
    );
    const pricing = priceForgeQueue(rows, PLAIN, NO_STONES);
    expect(pricing.rows.map((row) => row.spend !== null)).toEqual([true, false, false, false]);
    expect(pricing.gold).toBeCloseTo(forecastOf(9, 12).gold);
    const none = priceForgeQueue(resolveForgeQueue([{ itemId: 'gone', target: 10 }], []), PLAIN, NO_STONES);
    expect(none.gold).toBeNull();
    expect(none.essence).toBeNull();
  });

  it('adds the essence of the Protection Scroll when it is on', () => {
    const rows = rowsOf(['a', 9, 15]);
    const plain = priceForgeQueue(rows, PLAIN, NO_STONES);
    const scrolled = priceForgeQueue(rows, { ...PLAIN, scroll: true }, NO_STONES);
    expect(scrolled.essence).toBeCloseTo(forecastOf(9, 15, { protect: true }).essence);
    expect(scrolled.essence ?? 0).toBeGreaterThan(plain.essence ?? 0);
  });

  it('counts the stones the pieces should use against the stock, and takes them off it piece by piece', () => {
    const rows = rowsOf(['a', 9, 15], ['b', 9, 15]);
    const need = forecastOf(9, 15, { stones: STONES_FROM_TEN }).stones[0] ?? 0;
    const pricing = priceForgeQueue(rows, COMMON_FROM_TEN, [need * 2 + 1, 0, 0, 0, 0, 0]);
    expect(need).toBeGreaterThan(0);
    expect(pricing.stonesNeeded[0]).toBeCloseTo(need * 2);
    expect(pricing.stonesOwned[0]).toBeCloseTo(need * 2 + 1);
    expect(pricing.gold).toBeCloseTo(forecastOf(9, 15, { stones: STONES_FROM_TEN }).gold * 2);
    expect(pricing.runsOutAt).toBeNull();
  });

  describe('when the stock runs out and the queue stops', () => {
    const rows = rowsOf(['a', 9, 15], ['b', 9, 15], ['c', 9, 15]);
    const withStones = forecastOf(9, 15, { stones: STONES_FROM_TEN });
    const need = withStones.stones[0] ?? 0;

    it('counts the piece it halts at for the share the stock covers, and none after it', () => {
      const pricing = priceForgeQueue(rows, COMMON_FROM_TEN, [need * 1.5, 0, 0, 0, 0, 0]);
      expect(pricing.runsOutAt).toBe(1);
      expect(pricing.rows.map((row) => row.reached)).toEqual([true, true, false]);
      expect(pricing.rows[2]?.spend).toBeNull();
      expect(pricing.gold).toBeCloseTo(withStones.gold * 1.5);
      expect(pricing.essence).toBeCloseTo(withStones.essence * 1.5);
      expect(pricing.stonesNeeded[0]).toBeCloseTo(need * 1.5);
    });

    it('halts at the first piece when no stone is held', () => {
      const pricing = priceForgeQueue(rows, COMMON_FROM_TEN, NO_STONES);
      expect(pricing.runsOutAt).toBe(0);
      expect(pricing.gold).toBe(0);
      expect(pricing.rows.map((row) => row.reached)).toEqual([true, false, false]);
    });

    it('still counts the climb below the first stone-using level when no stone is held', () => {
      const pricing = priceForgeQueue(rowsOf(['a', 5, 15], ['b', 5, 15]), COMMON_FROM_TEN, NO_STONES);
      expect(pricing.runsOutAt).toBe(0);
      expect(pricing.gold).toBeCloseTo(forecastOf(5, 9).gold);
      expect(pricing.essence).toBeCloseTo(forecastOf(5, 9).essence);
      expect(pricing.rows.map((row) => row.reached)).toEqual([true, false]);
    });

    it('counts the climb below the stones in full and the rest for the covered share', () => {
      const from5 = forecastOf(5, 15, { stones: STONES_FROM_TEN });
      const free = forecastOf(5, 9);
      const pricing = priceForgeQueue(rowsOf(['a', 5, 15]), COMMON_FROM_TEN, [(from5.stones[0] ?? 0) / 2, 0, 0, 0, 0, 0]);
      expect(pricing.gold).toBeCloseTo(free.gold + (from5.gold - free.gold) / 2);
    });

    it('takes the scarcest kind as the limit when a piece uses two', () => {
      const split: ForgeQueueSettings = {
        ranges: [
          { upTo: 9, rarity: null },
          { upTo: 12, rarity: 0 },
          { upTo: 15, rarity: 1 },
        ],
        stopWhenOutOfStones: true,
        scroll: false,
      };
      const both = forecastOf(9, 15, { stones: [...Array<number | null>(9).fill(null), 0, 0, 0, 1, 1, 1] });
      const scarce = (both.stones[1] ?? 0) / 4;
      const pricing = priceForgeQueue(rowsOf(['a', 9, 15]), split, [100, scarce, 0, 0, 0, 0]);
      expect(pricing.runsOutAt).toBe(0);
      expect(pricing.gold).toBeCloseTo(both.gold / 4);
    });
  });

  describe('when the stock runs out and the queue rolls on', () => {
    const rows = rowsOf(['a', 9, 15], ['b', 9, 15], ['c', 9, 15]);
    const settings: ForgeQueueSettings = { ...COMMON_FROM_TEN, stopWhenOutOfStones: false };
    const withStones = forecastOf(9, 15, { stones: STONES_FROM_TEN });
    const without = forecastOf(9, 15);
    const need = withStones.stones[0] ?? 0;
    const blendedHalf = withStones.gold * 0.5 + without.gold * 0.5;

    it('blends the piece it runs out in by the share the stock covers', () => {
      const pricing = priceForgeQueue(rows, settings, [need * 1.5, 0, 0, 0, 0, 0]);
      expect(pricing.runsOutAt).toBe(1);
      expect(pricing.rows[1]?.spend?.gold).toBeCloseTo(blendedHalf);
      expect(pricing.rows[1]?.spend?.stones[0]).toBeCloseTo(need * 0.5);
    });

    it('prices every later piece without the spent kind and still counts them', () => {
      const pricing = priceForgeQueue(rows, settings, [need * 1.5, 0, 0, 0, 0, 0]);
      expect(pricing.rows.map((row) => row.reached)).toEqual([true, true, true]);
      expect(pricing.rows[2]?.spend?.gold).toBeCloseTo(without.gold);
      expect(pricing.rows[2]?.spend?.stones[0]).toBe(0);
      expect(pricing.gold).toBeCloseTo(withStones.gold + blendedHalf + without.gold);
      expect(pricing.stonesNeeded[0]).toBeCloseTo(need * 1.5);
    });

    it('prices the whole queue without stones when none is held, keeping the scroll', () => {
      const scrolled = priceForgeQueue(rows, { ...settings, scroll: true }, NO_STONES);
      const plainScroll = forecastOf(9, 15, { protect: true });
      expect(scrolled.runsOutAt).toBe(0);
      expect(scrolled.gold).toBeCloseTo(plainScroll.gold * 3);
      expect(scrolled.essence).toBeCloseTo(plainScroll.essence * 3);
    });
  });
});
