import { describe, expect, it } from 'vitest';
import { forgeForecast } from '@bombfarm/domain/forge';
import type { InventoryViewItem } from '@bombfarm/domain/inventory-view';
import { bagUpgradeOf, bagUpgrades, forgeQueueExpectedGold, resolveForgeQueue } from './forge-queue-view';

function item(id: string, upgrade: number, level = 30): InventoryViewItem {
  return { id, upgrade, level, rarityIdx: 1, defId: `def-${id}` } as unknown as InventoryViewItem;
}

describe('resolveForgeQueue', () => {
  it('pairs each piece with its bag row and prices the climb from where the row stands now', () => {
    const rows = resolveForgeQueue(
      [
        { itemId: 'a', target: 12 },
        { itemId: 'gone', target: 10 },
        { itemId: 'done', target: 8 },
        { itemId: 'odd', target: 10 },
      ],
      [item('a', 9), item('done', 8), item('odd', 0, 31)],
    );
    expect(rows.map((row) => row.item?.id ?? null)).toEqual(['a', null, 'done', 'odd']);
    expect(rows[0]?.forecast).toEqual(forgeForecast(9, 12, 30, 1));
    expect(rows.slice(1).map((row) => row.forecast)).toEqual([null, null, null]);
  });

  it('sums the expected gold over the rows it could price, and has no total when it priced none', () => {
    const priced = resolveForgeQueue(
      [
        { itemId: 'a', target: 12 },
        { itemId: 'b', target: 8 },
        { itemId: 'gone', target: 10 },
      ],
      [item('a', 9), item('b', 0)],
    );
    expect(forgeQueueExpectedGold(priced)).toBeCloseTo(forgeForecast(9, 12, 30, 1).gold + forgeForecast(0, 8, 30, 1).gold);
    expect(forgeQueueExpectedGold(resolveForgeQueue([{ itemId: 'gone', target: 10 }], []))).toBeNull();
  });

  it('bagUpgrades maps every bag row to where it stands', () => {
    expect(bagUpgrades([item('a', 9), item('b', 0)])).toEqual(new Map([['a', 9], ['b', 0]]));
  });

  it('bagUpgradeOf reads one piece off the raw payload, and null once the piece has left it', () => {
    const bag = [
      { id: 'a', def_id: 'ash_ring', upgrade: 12 },
      { id: 'b', def_id: 'ash_helm' },
      null,
      { def_id: 'no-id', upgrade: 3 },
    ];
    expect(bagUpgradeOf(bag, 'a')).toBe(12);
    expect(bagUpgradeOf(bag, 'b')).toBe(0);
    expect(bagUpgradeOf(bag, 'gone')).toBeNull();
    expect(bagUpgradeOf(undefined, 'a')).toBeNull();
  });
});
