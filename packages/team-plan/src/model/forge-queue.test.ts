import { describe, expect, it } from 'vitest';
import { forgeForecast } from '@bombfarm/domain/forge';
import { buildForgeQueue, forgeLadderRungs } from './forge-queue';
import type { GearFlowRow } from './gear-flow-rows';

function row(overrides: Partial<GearFlowRow>): GearFlowRow {
  return {
    itemId: 'i1',
    defId: 'glove_ash',
    rarityIdx: 2,
    slot: 'glove',
    level: 80,
    upgrade: 0,
    forgeFails: 0,
    originHeroId: null,
    destHeroId: 'h1',
    forge: null,
    ...overrides,
  };
}

describe('forgeLadderRungs', () => {
  it('draws +1…+15: held below the start, sure up to +4, a roll per step above, and beyond the target', () => {
    const rungs = forgeLadderRungs(2, 11);
    expect(rungs).toHaveLength(15);
    expect(rungs.slice(0, 2).map((r) => r.kind)).toEqual(['held', 'held']);
    expect(rungs.slice(2, 4).map((r) => r.kind)).toEqual(['sure', 'sure']);
    expect(rungs.slice(4, 11).map((r) => r.kind)).toEqual(Array(7).fill('roll'));
    expect(rungs.slice(11).map((r) => r.kind)).toEqual(['beyond', 'beyond', 'beyond', 'beyond']);
  });

  it('carries each roll’s own chance and where a miss lands, one level down from +12 and never under +10', () => {
    const rungs = forgeLadderRungs(10, 15);
    const rolls = rungs.filter((r) => r.kind === 'roll');
    expect(rolls.map((r) => (r.kind === 'roll' ? r.chance : NaN))).toEqual([0.3, 0.25, 0.2, 0.15, 0.1]);
    expect(rolls.map((r) => (r.kind === 'roll' ? r.failTo : NaN))).toEqual([10, 10, 11, 12, 13]);
  });
});

describe('buildForgeQueue', () => {
  it('prices a piece from the misses in a row it carries, only while the climb starts where it stands', () => {
    const queue = buildForgeQueue([
      row({ itemId: 'a', upgrade: 13, forgeFails: 3, forge: { from: 13, to: 14 } }),
      row({ itemId: 'b', upgrade: 11, forgeFails: 3, forge: { from: 13, to: 14 } }),
    ]);
    expect(queue.entries[0].forecast).toEqual(forgeForecast(13, 14, 80, 2, 3));
    expect(queue.entries[1].forecast).toEqual(forgeForecast(13, 14, 80, 2, 0));
  });

  it('lists only the rows with a forge chore, in the order given, and prices each from the forge table', () => {
    const queue = buildForgeQueue([
      row({ itemId: 'kept' }),
      row({ itemId: 'a', forge: { from: 0, to: 13 } }),
      row({ itemId: 'b', level: 50, rarityIdx: 1, forge: { from: 8, to: 10 } }),
    ]);
    expect(queue.entries.map((e) => e.row.itemId)).toEqual(['a', 'b']);
    expect(queue.entries[0].forecast).toEqual(forgeForecast(0, 13, 80, 2));
    expect(queue.entries[1].forecast).toEqual(forgeForecast(8, 10, 50, 1));
  });

  it('sums the priced entries into one total', () => {
    const queue = buildForgeQueue([
      row({ itemId: 'a', forge: { from: 0, to: 13 } }),
      row({ itemId: 'b', level: 50, rarityIdx: 1, forge: { from: 8, to: 10 } }),
    ]);
    const [a, b] = queue.entries.map((e) => e.forecast!);
    expect(queue.total).toEqual({ rolls: a.rolls + b.rolls, gold: a.gold + b.gold, essence: a.essence + b.essence });
  });

  it('leaves an item off the forge table unpriced rather than throwing, and the total covers the rest', () => {
    const queue = buildForgeQueue([
      row({ itemId: 'odd', level: 85, forge: { from: 0, to: 9 } }),
      row({ itemId: 'a', forge: { from: 0, to: 13 } }),
    ]);
    expect(queue.entries[0].forecast).toBeNull();
    const { rolls, gold, essence } = forgeForecast(0, 13, 80, 2);
    expect(queue.total).toEqual({ rolls, gold, essence });
  });

  it('has no total when nothing needs forging', () => {
    expect(buildForgeQueue([row({})])).toEqual({ entries: [], total: null });
  });
});
