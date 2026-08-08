import { describe, expect, it } from 'vitest';
import { SLOTS } from '@bombfarm/domain/gear';
import type { InventoryItem } from '@bombfarm/domain/inventory';
import type { AssignmentState } from '@bombfarm/domain/gear-plan/solver-assignment';
import { buildForgeList } from '@bombfarm/domain/gear-plan/waterfall';

function item(partial: Partial<InventoryItem> & Pick<InventoryItem, 'id'>): InventoryItem {
  return {
    defId: 'ember_arma',
    rarityIdx: 0,
    level: 10,
    upgrade: 0,
    slot: 'arma',
    equipped: false,
    equippedBy: null,
    defResolved: true,
    marketBlocked: false,
    ...partial,
  };
}

function emptySlots(): Record<string, string | null> {
  return Object.fromEntries(SLOTS.map((slot) => [slot, null]));
}

describe('buildForgeList', () => {
  it('recommends forging an item the final assignment equips on a hero', () => {
    const inventory = [item({ id: 'a' })];
    const assignment: AssignmentState = {
      slots: { hero1: { ...emptySlots(), arma: 'a' } },
      pool: new Set(),
    };
    const list = buildForgeList(inventory, 10, new Set(['hero1']), assignment);
    expect(list).toEqual([{ itemId: 'a', defId: 'ember_arma', from: 0, to: 10 }]);
  });

  it('does not recommend forging an item the final assignment leaves in the shared pool', () => {
    // Regression: a present `{ heroId: null }` entry (definitely in the pool) must not fall
    // through to the `item.equippedBy` fallback meant only for items absent from the assignment.
    const inventory = [item({ id: 'a', equippedBy: 'donateHero' })];
    const assignment: AssignmentState = {
      slots: { hero1: emptySlots() },
      pool: new Set(['a']),
    };
    const list = buildForgeList(inventory, 10, new Set(['hero1', 'donateHero']), assignment);
    expect(list).toEqual([]);
  });

  it('falls back to the current equip state for an item absent from the assignment (e.g. leaveAlone)', () => {
    const inventory = [item({ id: 'a', equippedBy: 'frozenHero' })];
    const assignment: AssignmentState = {
      slots: { hero1: emptySlots() },
      pool: new Set(),
    };
    const list = buildForgeList(inventory, 10, new Set(['hero1', 'frozenHero']), assignment);
    expect(list).toEqual([{ itemId: 'a', defId: 'ember_arma', from: 0, to: 10 }]);
  });

  it('does not recommend forging an item absent from the assignment and not currently equipped', () => {
    const inventory = [item({ id: 'a', equippedBy: null })];
    const assignment: AssignmentState = { slots: { hero1: emptySlots() }, pool: new Set() };
    const list = buildForgeList(inventory, 10, new Set(['hero1']), assignment);
    expect(list).toEqual([]);
  });

  it('returns an empty list when forgeFloor is 0, regardless of assignment', () => {
    const inventory = [item({ id: 'a' })];
    const assignment: AssignmentState = {
      slots: { hero1: { ...emptySlots(), arma: 'a' } },
      pool: new Set(),
    };
    const list = buildForgeList(inventory, 0, new Set(['hero1']), assignment);
    expect(list).toEqual([]);
  });

  it('skips items already at or above the forge floor', () => {
    const inventory = [item({ id: 'a', upgrade: 10 })];
    const assignment: AssignmentState = {
      slots: { hero1: { ...emptySlots(), arma: 'a' } },
      pool: new Set(),
    };
    const list = buildForgeList(inventory, 10, new Set(['hero1']), assignment);
    expect(list).toEqual([]);
  });

  it('skips items owned by a hero outside the roster (foreign owner)', () => {
    const inventory = [item({ id: 'a', equippedBy: 'strangerHero' })];
    const assignment: AssignmentState = { slots: { hero1: emptySlots() }, pool: new Set() };
    const list = buildForgeList(inventory, 10, new Set(['hero1']), assignment);
    expect(list).toEqual([]);
  });

  it('skips unresolved-def and market-blocked items', () => {
    const inventory = [
      item({ id: 'a', defResolved: false }),
      item({ id: 'b', marketBlocked: true }),
    ];
    const assignment: AssignmentState = {
      slots: { hero1: { ...emptySlots(), arma: 'a', elmo: 'b' } },
      pool: new Set(),
    };
    const list = buildForgeList(inventory, 10, new Set(['hero1']), assignment);
    expect(list).toEqual([]);
  });
});
