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
    originHeroId: null,
    destHeroId: 'h1',
    forge: null,
    ...overrides,
  };
}

describe('forgeLadderRungs', () => {
  it('draws +1…+15: held below the start, safe up to +8, a roll per step above, and beyond the target', () => {
    const rungs = forgeLadderRungs(3, 11);
    expect(rungs).toHaveLength(15);
    expect(rungs.slice(0, 3).map((r) => r.kind)).toEqual(['held', 'held', 'held']);
    expect(rungs.slice(3, 8).map((r) => r.kind)).toEqual(['safe', 'safe', 'safe', 'safe', 'safe']);
    expect(rungs.slice(8, 11).map((r) => r.kind)).toEqual(['roll', 'roll', 'roll']);
    expect(rungs.slice(11).map((r) => r.kind)).toEqual(['beyond', 'beyond', 'beyond', 'beyond']);
  });

  it('carries each roll’s own chance and its fail floor, +0 only for the last rung', () => {
    const rungs = forgeLadderRungs(8, 15);
    const rolls = rungs.filter((r) => r.kind === 'roll');
    expect(rolls.map((r) => (r.kind === 'roll' ? r.chance : NaN))).toEqual([0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2]);
    expect(rolls.map((r) => (r.kind === 'roll' ? r.failTo : NaN))).toEqual([8, 8, 8, 8, 8, 8, 0]);
  });
});

describe('buildForgeQueue', () => {
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
    expect(queue.total).toEqual({ rolls: a.rolls + b.rolls, safeJumps: a.safeJumps + b.safeJumps, gold: a.gold + b.gold });
  });

  it('leaves an item off the forge table unpriced rather than throwing, and the total covers the rest', () => {
    const queue = buildForgeQueue([
      row({ itemId: 'odd', level: 85, forge: { from: 0, to: 9 } }),
      row({ itemId: 'a', forge: { from: 0, to: 13 } }),
    ]);
    expect(queue.entries[0].forecast).toBeNull();
    expect(queue.total).toEqual(forgeForecast(0, 13, 80, 2));
  });

  it('has no total when nothing needs forging', () => {
    expect(buildForgeQueue([row({})])).toEqual({ entries: [], total: null });
  });
});
