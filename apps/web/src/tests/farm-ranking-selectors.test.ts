import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { emptyLoadout } from '@bombfarm/domain/gear';
import { ZERO_PTS } from '@bombfarm/domain/planner-constants';
import { normalizeHero } from '@/shared/lib/storage';
import {
  getFarmRankingComputeCount,
  resetFarmRankingCache,
  resetFarmRankingComputeCount,
  selectFarmPoolEntries,
  selectFarmRankingRows,
  selectFarmReturnBonus,
} from '@/shared/stores/selectors/farm-ranking-selectors';
import { resetPlannerStoreForTests, usePlannerStore } from '@/shared/stores';

function farmHero(id: string, overrides: Partial<{ battleAllowed: boolean }> = {}) {
  return normalizeHero({
    id,
    name: `Hero ${id}`,
    sourceId: `src-${id}`,
    updatedAt: 1,
    rarity: 'Raro',
    level: 10,
    stars: 1,
    naked: { attack: 100, energy: 100, speed: 50, critChance: 0, critDmg: 10, penetration: 0, cdr: 0, luck: 0 },
    gearedOverride: {
      attack: 100,
      energy: 100,
      speed: 50,
      critChance: 0,
      critDmg: 10,
      penetration: 0,
      cdr: 0,
      luck: 0,
    },
    loadout: emptyLoadout(),
    pts: ZERO_PTS(),
    battleAllowed: overrides.battleAllowed ?? true,
  });
}

describe('selectFarmRankingRows', () => {
  beforeEach(() => {
    resetPlannerStoreForTests();
    resetFarmRankingComputeCount();
  });

  afterEach(() => {
    resetPlannerStoreForTests();
    resetFarmRankingComputeCount();
  });

  it('empty roster short-circuits to no-roster, without a full compute', () => {
    const result = selectFarmRankingRows(usePlannerStore.getState());
    expect(result.reason).toBe('no-roster');
    expect(result.rows).toEqual([]);
  });

  it('roster with every hero disabled short-circuits to no-heroes-enabled', () => {
    usePlannerStore.getState().hydrateRoster([farmHero('a', { battleAllowed: false })], null);
    const result = selectFarmRankingRows(usePlannerStore.getState());
    expect(result.reason).toBe('no-heroes-enabled');
    expect(result.rows).toEqual([]);
  });

  it('a farmPoolOverrides override of false on an otherwise-allowed hero disables it', () => {
    usePlannerStore.getState().hydrateRoster([farmHero('a')], null);
    usePlannerStore.getState().setFarmHeroEnabled('a', false);
    const result = selectFarmRankingRows(usePlannerStore.getState());
    expect(result.reason).toBe('no-heroes-enabled');
  });

  it('one enabled hero computes all 600 rows, reason null', () => {
    usePlannerStore.getState().hydrateRoster([farmHero('a')], null);
    const result = selectFarmRankingRows(usePlannerStore.getState());
    expect(result.reason).toBeNull();
    expect(result.rows).toHaveLength(600);
  });

  it('N invocations with unchanged deps -> 1 compute, same object identity', () => {
    usePlannerStore.getState().hydrateRoster([farmHero('a')], null);
    const a = selectFarmRankingRows(usePlannerStore.getState());
    const b = selectFarmRankingRows(usePlannerStore.getState());
    const c = selectFarmRankingRows(usePlannerStore.getState());
    expect(getFarmRankingComputeCount()).toBe(1);
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it('an unrelated field write (heroName-equivalent: toast) leaves compute count and identity unchanged', () => {
    usePlannerStore.getState().hydrateRoster([farmHero('a')], null);
    const before = selectFarmRankingRows(usePlannerStore.getState());
    const countBefore = getFarmRankingComputeCount();
    usePlannerStore.getState().flashToast('hello');
    const after = selectFarmRankingRows(usePlannerStore.getState());
    expect(getFarmRankingComputeCount()).toBe(countBefore);
    expect(after).toBe(before);
  });

  it('resetFarmRankingCache forces a recompute even with structurally-equal deps', () => {
    usePlannerStore.getState().hydrateRoster([farmHero('a')], null);
    selectFarmRankingRows(usePlannerStore.getState());
    const countBefore = getFarmRankingComputeCount();
    resetFarmRankingCache();
    selectFarmRankingRows(usePlannerStore.getState());
    expect(getFarmRankingComputeCount()).toBe(countBefore + 1);
  });

  // Each of the 15 dep-tuple members drives a recompute.
  describe('every dep-tuple member drives a recompute', () => {
    beforeEach(() => {
      usePlannerStore.getState().hydrateRoster([farmHero('a')], null);
      selectFarmRankingRows(usePlannerStore.getState());
    });

    function expectRecompute(mutate: () => void) {
      const before = getFarmRankingComputeCount();
      mutate();
      selectFarmRankingRows(usePlannerStore.getState());
      expect(getFarmRankingComputeCount()).toBe(before + 1);
    }

    it('heroes (roster membership)', () => {
      expectRecompute(() =>
        usePlannerStore.getState().hydrateRoster([farmHero('a'), farmHero('b')], null),
      );
    });

    it('treeDanoTotal', () => {
      expectRecompute(() =>
        usePlannerStore.getState().applyAccountImport({
          tree: { danoTotal: 2, critChance: 0, critDmg: 0, speed: 0, energy: 0, teamCoinPct: 0, luckFlatPct: 0 },
          houseIdx: null,
          houseLevel: null,
          phase: null,
        }),
      );
    });

    it('treeCritChance', () => {
      expectRecompute(() =>
        usePlannerStore.getState().applyAccountImport({
          tree: { danoTotal: 1, critChance: 5, critDmg: 0, speed: 0, energy: 0, teamCoinPct: 0, luckFlatPct: 0 },
          houseIdx: null,
          houseLevel: null,
          phase: null,
        }),
      );
    });

    it('treeCritDmg', () => {
      expectRecompute(() =>
        usePlannerStore.getState().applyAccountImport({
          tree: { danoTotal: 1, critChance: 0, critDmg: 5, speed: 0, energy: 0, teamCoinPct: 0, luckFlatPct: 0 },
          houseIdx: null,
          houseLevel: null,
          phase: null,
        }),
      );
    });

    it('treeSpeed', () => {
      expectRecompute(() =>
        usePlannerStore.getState().applyAccountImport({
          tree: { danoTotal: 1, critChance: 0, critDmg: 0, speed: 5, energy: 0, teamCoinPct: 0, luckFlatPct: 0 },
          houseIdx: null,
          houseLevel: null,
          phase: null,
        }),
      );
    });

    it('treeEnergy', () => {
      expectRecompute(() =>
        usePlannerStore.getState().applyAccountImport({
          tree: { danoTotal: 1, critChance: 0, critDmg: 0, speed: 0, energy: 5, teamCoinPct: 0, luckFlatPct: 0 },
          houseIdx: null,
          houseLevel: null,
          phase: null,
        }),
      );
    });

    it('treeTeamCoinPct', () => {
      expectRecompute(() =>
        usePlannerStore.getState().applyAccountImport({
          tree: { danoTotal: 1, critChance: 0, critDmg: 0, speed: 0, energy: 0, teamCoinPct: 5, luckFlatPct: 0 },
          houseIdx: null,
          houseLevel: null,
          phase: null,
        }),
      );
    });

    it('treeLuckFlatPct', () => {
      expectRecompute(() =>
        usePlannerStore.getState().applyAccountImport({
          tree: { danoTotal: 1, critChance: 0, critDmg: 0, speed: 0, energy: 0, teamCoinPct: 0, luckFlatPct: 5 },
          houseIdx: null,
          houseLevel: null,
          phase: null,
        }),
      );
    });

    it('teamBuffs', () => {
      expectRecompute(() =>
        usePlannerStore.getState().setTeamBuffs({ ...usePlannerStore.getState().teamBuffs, grito_guerra: 3 }),
      );
    });

    it('houseIdx', () => {
      expectRecompute(() => usePlannerStore.getState().setHouseIdx(2));
    });

    it('houseLevel', () => {
      expectRecompute(() => usePlannerStore.getState().setHouseLevel(4));
    });

    it('slots (casa field slots)', () => {
      expectRecompute(() =>
        usePlannerStore.getState().applyAccountImport({
          tree: null,
          houseIdx: null,
          houseLevel: null,
          phase: null,
          slots: 5,
        }),
      );
    });

    it('maxPhase', () => {
      expectRecompute(() =>
        usePlannerStore.getState().applyAccountImport({
          tree: null,
          houseIdx: null,
          houseLevel: null,
          phase: null,
          maxPhase: 42,
        }),
      );
    });

    it('farmPoolOverrides', () => {
      expectRecompute(() => usePlannerStore.getState().setFarmHeroEnabled('a', false));
    });

    it('farmReturnBonus', () => {
      expectRecompute(() => usePlannerStore.getState().setFarmReturnBonus('vip'));
    });
  });
});

describe('selectFarmPoolEntries / selectFarmReturnBonus', () => {
  beforeEach(() => {
    resetPlannerStoreForTests();
  });

  afterEach(() => {
    resetPlannerStoreForTests();
  });

  it('reflects battleAllowed by default, and an override once set', () => {
    usePlannerStore
      .getState()
      .hydrateRoster([farmHero('a'), farmHero('b', { battleAllowed: false })], null);
    expect(selectFarmPoolEntries(usePlannerStore.getState())).toEqual([
      { heroId: 'a', heroName: 'Hero a', enabled: true },
      { heroId: 'b', heroName: 'Hero b', enabled: false },
    ]);

    usePlannerStore.getState().setFarmHeroEnabled('a', false);
    expect(selectFarmPoolEntries(usePlannerStore.getState())[0]).toEqual({
      heroId: 'a',
      heroName: 'Hero a',
      enabled: false,
    });
  });

  it('defaults to off', () => {
    expect(selectFarmReturnBonus(usePlannerStore.getState())).toBe('off');
  });
});
