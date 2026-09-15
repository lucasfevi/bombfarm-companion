import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { InventoryItem } from '@bombfarm/domain/inventory';
import { emptyLoadout } from '@bombfarm/domain/gear';
import { ZERO_PTS } from '@bombfarm/domain/planner-constants';
import { countOptimizeScopeHeroes } from '@/features/team-plan/model/build-team-plan-input';
import { normalizeHero } from '@/shared/lib/storage';
import { resetPlannerStoreForTests, usePlannerStore, type PlannerStore } from '@/shared/stores';
import {
  selectOptimizeScopeHeroCount,
  selectTeamPlanInputsUsable,
} from '@/shared/stores/selectors/team-plan-selectors';

function hero(id: string, battleAllowed = true) {
  return normalizeHero({
    id,
    name: id,
    sourceId: `src-${id}`,
    updatedAt: 1,
    rarity: 'Raro',
    level: 20,
    stars: 0,
    naked: { attack: 10, energy: 10, speed: 10, critChance: 0, critDmg: 10, penetration: 0, cdr: 0, luck: 0 },
    gearedOverride: { attack: 10, energy: 10, speed: 10, critChance: 0, critDmg: 10, penetration: 0, cdr: 0, luck: 0 },
    loadout: emptyLoadout(),
    pts: ZERO_PTS(),
    battleAllowed,
  });
}

const item: InventoryItem = {
  id: '1',
  defId: 'ember_calca',
  rarityIdx: 2,
  level: 10,
  upgrade: 8,
  slot: 'calca',
  equipped: false,
  equippedBy: null,
  defResolved: true,
  marketBlocked: false,
};

function pool(items: InventoryItem[]): Pick<PlannerStore, 'inventory'> {
  return { inventory: { version: 1, importedAt: 1, items } };
}

/** The toolbar's own guard, restated: no roster, an empty pool, nobody in scope, or a gold plan with no ceiling. */
const fixtures: { name: string; arrange: () => void; usable: boolean }[] = [
  {
    name: 'no roster',
    arrange: () => usePlannerStore.setState({ ...pool([item]), maxPhase: 137 }),
    usable: false,
  },
  {
    name: 'roster but empty pool',
    arrange: () => {
      usePlannerStore.getState().hydrateRoster([hero('a')], 'a');
      usePlannerStore.setState({ ...pool([]), maxPhase: 137 });
    },
    usable: false,
  },
  {
    name: 'all heroes leave-alone',
    arrange: () => {
      usePlannerStore.getState().hydrateRoster([hero('a'), hero('b')], 'a');
      usePlannerStore.setState({
        ...pool([item]),
        maxPhase: 137,
        scopeByHeroId: { a: 'leaveAlone', b: 'leaveAlone' },
      });
    },
    usable: false,
  },
  {
    name: 'farm objective with no max phase',
    arrange: () => {
      usePlannerStore.getState().hydrateRoster([hero('a')], 'a');
      usePlannerStore.setState({ ...pool([item]), maxPhase: null, objective: 'farm', targetPhase: null });
    },
    usable: false,
  },
  {
    name: 'usable',
    arrange: () => {
      usePlannerStore.getState().hydrateRoster([hero('a')], 'a');
      usePlannerStore.setState({ ...pool([item]), maxPhase: 137, objective: 'farm' });
    },
    usable: true,
  },
];

describe('the usable-inputs selector', () => {
  beforeEach(() => {
    resetPlannerStoreForTests();
  });

  afterEach(() => {
    resetPlannerStoreForTests();
  });

  it("agrees with the toolbar's enabling conditions over the four blocking fixtures and one usable one", () => {
    const answers = fixtures.map(({ arrange }) => {
      resetPlannerStoreForTests();
      arrange();
      return selectTeamPlanInputsUsable(usePlannerStore.getState());
    });

    expect(answers).toEqual([false, false, false, false, true]);
    expect(fixtures.map(({ usable }) => usable)).toEqual(answers);
  });

  it('the scope count moved without changing its answer', () => {
    usePlannerStore.getState().hydrateRoster([hero('a'), hero('b'), hero('c'), hero('d', false)], 'a');
    usePlannerStore.setState({ scopeByHeroId: { a: 'optimize', b: 'donate', c: 'leaveAlone' } });
    const state = usePlannerStore.getState();

    expect(selectOptimizeScopeHeroCount(state)).toBe(1);
    expect(countOptimizeScopeHeroes(state)).toBe(selectOptimizeScopeHeroCount(state));
    expect(countOptimizeScopeHeroes).toBe(selectOptimizeScopeHeroCount);
  });
});
