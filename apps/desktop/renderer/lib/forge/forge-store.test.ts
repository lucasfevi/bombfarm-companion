import { describe, expect, it } from 'vitest';
import { FORGE_MAX } from '@bombfarm/domain/forge';
import { buildInventoryView, type InventoryViewItem } from '@bombfarm/domain/inventory-view';
import { EMPTY_FORGE_FILTER } from './forge-rows';
import { INITIAL_FORGE_PLAN } from './use-forge-plan';
import { DEFAULT_FORGE_SORT, INITIAL_FORGE_SCREEN, createForgeScreenStore, resolveForgeScreen } from './forge-store';

const ROWS = [
  { id: 'g1', def_id: 'steel_luva', category: 0, set: 'steel', rarity: 2, level: 20, upgrade: 12, power: 41.6 },
  { id: 'g2', def_id: 'steel_bota', category: 0, set: 'steel', rarity: 2, level: 20, upgrade: 8, power: 30 },
];

function gear(ids: readonly string[]): InventoryViewItem[] {
  return buildInventoryView(ROWS).items.filter((item) => ids.includes(item.id));
}

describe('resolveForgeScreen', () => {
  it('hands back the piece the stored id names', () => {
    const state = { ...INITIAL_FORGE_SCREEN, selectedId: 'g1' };
    expect(resolveForgeScreen(state, gear(['g1', 'g2'])).selected?.id).toBe('g1');
  });

  it('drops a selection the bag no longer holds', () => {
    const state = { ...INITIAL_FORGE_SCREEN, selectedId: 'g1' };
    expect(resolveForgeScreen(state, gear(['g2'])).selected).toBeNull();
    expect(resolveForgeScreen(state, []).selected).toBeNull();
  });

  it('clamps a target the piece can no longer be climbed to', () => {
    const state = {
      ...INITIAL_FORGE_SCREEN,
      selectedId: 'g1',
      plan: { itemId: 'g1', target: 9, maxGold: null, attempts: null },
    };
    // g1 already stands at +12, so +9 is behind it and the lowest legal target is +13.
    expect(resolveForgeScreen(state, gear(['g1'])).plan.target).toBe(13);
    const tooHigh = { ...state, plan: { ...state.plan, target: 99 } };
    expect(resolveForgeScreen(tooHigh, gear(['g1'])).plan.target).toBe(FORGE_MAX);
  });

  it('keeps the limits but forgets the target when nothing is selected', () => {
    const state = {
      ...INITIAL_FORGE_SCREEN,
      selectedId: null,
      plan: { itemId: 'g1', target: 14, maxGold: 5_000, attempts: 3 },
    };
    const resolved = resolveForgeScreen(state, gear(['g1']));
    expect(resolved.selected).toBeNull();
    expect(resolved.plan.itemId).toBeNull();
    expect(resolved.plan.maxGold).toBe(5_000);
    expect(resolved.plan.attempts).toBe(3);
  });
});

describe('DEFAULT_FORGE_SORT', () => {
  it('opens on a column the bag table itself carries, since its headers are the only ordering here', () => {
    for (const term of DEFAULT_FORGE_SORT) expect(['name', 'forge']).toContain(term.key);
  });
});

describe('the forge screen store', () => {
  it('opens on an empty filter, the default order, nothing selected and no plan', () => {
    expect(createForgeScreenStore().getState()).toEqual({
      filter: EMPTY_FORGE_FILTER,
      sort: DEFAULT_FORGE_SORT,
      selectedId: null,
      plan: INITIAL_FORGE_PLAN,
    });
  });

  it('holds what was put in it across reads, which is what surviving a tab change means', () => {
    const store = createForgeScreenStore();
    store.setFilter({ ...EMPTY_FORGE_FILTER, forge: '8to10' });
    store.setSort([{ key: 'level', direction: 'asc' }]);
    store.select('g1');
    store.setPlan({ itemId: 'g1', target: 14, maxGold: 5_000, attempts: null });

    const held = store.getState();
    expect(held.filter.forge).toBe('8to10');
    expect(held.sort).toEqual([{ key: 'level', direction: 'asc' }]);
    expect(held.selectedId).toBe('g1');
    expect(held.plan.target).toBe(14);
    expect(store.getState()).toBe(held);
  });

  it('tells its listeners when something changed, and stays quiet when nothing did', () => {
    const store = createForgeScreenStore();
    let notifications = 0;
    const stop = store.subscribe(() => {
      notifications += 1;
    });

    store.select('g1');
    expect(notifications).toBe(1);
    store.select('g1');
    expect(notifications).toBe(1);
    store.select(null);
    expect(notifications).toBe(2);

    stop();
    store.select('g2');
    expect(notifications).toBe(2);
  });

  it('goes back to where it started when reset', () => {
    const store = createForgeScreenStore();
    store.select('g1');
    store.setSort([{ key: 'name', direction: 'asc' }]);
    store.reset();
    expect(store.getState()).toEqual(INITIAL_FORGE_SCREEN);
  });
});
