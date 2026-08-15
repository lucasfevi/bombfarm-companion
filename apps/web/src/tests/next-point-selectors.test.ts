import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { emptyLoadout } from '@bombfarm/domain/gear';
import { ZERO_PTS } from '@bombfarm/domain/planner-constants';
import { computeHeroFarmBases, rankNextPointForFarm } from '@bombfarm/domain/farm-point-rank';
import { normalizeHero, type AccountShared } from '@/shared/lib/storage';
import { resetPlannerStoreForTests, usePlannerStore } from '@/shared/stores';
import {
  selectFarmPoolBases,
  getFarmPoolBasesComputeCount,
  resetFarmPoolBasesComputeCount,
  selectDraftFarmBasis,
  getDraftFarmBasisComputeCount,
  resetDraftFarmBasisComputeCount,
  selectNextPointRanking,
  resetNextPointRankingComputeCount,
  getFarmRankComputeCount,
  resetFarmRankComputeCount,
  selectNextPointBest,
} from '@/shared/stores/selectors/next-point-selectors';
import { selectBestStat, selectBestGainPct } from '@/shared/stores';
import { buildAccount, resolveEnabledHeroIds } from '@/shared/stores/selectors/farm-ranking-selectors';

/** A hero with real damage/energy so the farm/DPS math is not degenerate. */
function farmHero(id: string, overrides: Partial<{ battleAllowed: boolean; attack: number }> = {}) {
  return normalizeHero({
    id,
    name: `Hero ${id}`,
    sourceId: `src-${id}`,
    updatedAt: 1,
    rarity: 'Raro',
    level: 20,
    stars: 1,
    naked: {
      attack: overrides.attack ?? 200,
      energy: 300,
      speed: 60,
      critChance: 10,
      critDmg: 50,
      penetration: 0,
      cdr: 5,
      luck: 0,
    },
    gearedOverride: {
      attack: overrides.attack ?? 200,
      energy: 300,
      speed: 60,
      critChance: 10,
      critDmg: 50,
      penetration: 0,
      cdr: 5,
      luck: 0,
    },
    loadout: emptyLoadout(),
    pts: ZERO_PTS(),
    battleAllowed: overrides.battleAllowed ?? true,
  });
}

function resetAllCaches() {
  resetFarmPoolBasesComputeCount();
  resetDraftFarmBasisComputeCount();
  resetNextPointRankingComputeCount();
  resetFarmRankComputeCount();
}

/** Sets the roster AND loads the given hero's fields into the live draft — the same two steps
 *  `commitActiveHero` performs, without its persist-lock/microtask side effects. */
function activateHero(heroes: ReturnType<typeof farmHero>[], activeId: string) {
  usePlannerStore.getState().hydrateRoster(heroes, activeId);
  const active = heroes.find((h) => h.id === activeId)!;
  usePlannerStore.getState().applyHero(active);
}

describe('next-point-selectors', () => {
  beforeEach(() => {
    resetPlannerStoreForTests();
    resetAllCaches();
  });

  afterEach(() => {
    resetPlannerStoreForTests();
    resetAllCaches();
  });

  describe('selectFarmPoolBases', () => {
    it('returns the SAME object identity on a cache hit', () => {
      activateHero([farmHero('a'), farmHero('b')], 'a');
      const first = selectFarmPoolBases(usePlannerStore.getState());
      const second = selectFarmPoolBases(usePlannerStore.getState());
      expect(second).toBe(first);
    });

    it('recomputes when a dep changes and the identity changes with it', () => {
      activateHero([farmHero('a'), farmHero('b')], 'a');
      const before = selectFarmPoolBases(usePlannerStore.getState());
      usePlannerStore.getState().hydrateRoster([farmHero('a'), farmHero('b'), farmHero('c')], 'a');
      const after = selectFarmPoolBases(usePlannerStore.getState());
      expect(after).not.toBe(before);
    });

    it('excludes the active hero — only the OTHER pool heroes are extracted', () => {
      activateHero([farmHero('a'), farmHero('b'), farmHero('c')], 'a');
      const bases = selectFarmPoolBases(usePlannerStore.getState());
      expect(bases.map((b) => b.heroId).sort()).toEqual(['b', 'c']);
    });
  });

  describe('selectDraftFarmBasis', () => {
    it('returns the SAME object identity on a cache hit', () => {
      activateHero([farmHero('a')], 'a');
      const first = selectDraftFarmBasis(usePlannerStore.getState());
      const second = selectDraftFarmBasis(usePlannerStore.getState());
      expect(second).toBe(first);
    });

    it('is null when there is no active hero', () => {
      expect(selectDraftFarmBasis(usePlannerStore.getState())).toBeNull();
    });

    it('recomputes when a draft field changes (e.g. level)', () => {
      activateHero([farmHero('a')], 'a');
      const before = selectDraftFarmBasis(usePlannerStore.getState());
      usePlannerStore.getState().setHeroLevel(30);
      const after = selectDraftFarmBasis(usePlannerStore.getState());
      expect(after).not.toBe(before);
    });
  });

  describe('composed bases equal the whole-pool extraction when the draft equals the stored record', () => {
    it('rankNextPointForFarm produces the SAME rows/phase whether the pool is spliced or extracted directly', () => {
      const heroes = [farmHero('a'), farmHero('b', { attack: 150 }), farmHero('c', { attack: 90 })];
      activateHero(heroes, 'a');
      usePlannerStore.getState().setRankMode('farm');

      const state = usePlannerStore.getState();
      const viaSelector = selectNextPointRanking(state);
      expect(viaSelector.mode).toBe('farm');
      expect(viaSelector.fallback).toBeNull();

      const account: AccountShared = buildAccount(state);
      const wholePoolBases = computeHeroFarmBases({
        heroes,
        account,
        enabledHeroIds: resolveEnabledHeroIds(state),
      });
      const direct = rankNextPointForFarm({
        bases: wholePoolBases,
        account,
        heroId: 'a',
        objective: { kind: 'gold' },
        maxPhase: state.maxPhase,
        returnBonus: state.farmReturnBonus,
      });

      expect(direct.outcome).toBe('ranked');
      expect(viaSelector.rows).toEqual(direct.rows);
      expect(viaSelector.phase).toBe(direct.phase);
      expect(viaSelector.addedToPool).toBe(false);
    });
  });

  describe('mode dispatch and the farm compute counter', () => {
    it('under rankMode "dps", the farm compute counter stays 0 through a full render', () => {
      activateHero([farmHero('a'), farmHero('b')], 'a');
      usePlannerStore.getState().setRankMode('dps');
      const result = selectNextPointRanking(usePlannerStore.getState());
      expect(result.mode).toBe('dps');
      expect(result.fallback).toBeNull();
      expect(getFarmRankComputeCount()).toBe(0);
      expect(getFarmPoolBasesComputeCount()).toBe(0);
      expect(getDraftFarmBasisComputeCount()).toBe(0);
    });

    it('rises to exactly 1 after switching to farm', () => {
      activateHero([farmHero('a'), farmHero('b')], 'a');
      usePlannerStore.getState().setRankMode('dps');
      selectNextPointRanking(usePlannerStore.getState());
      expect(getFarmRankComputeCount()).toBe(0);

      usePlannerStore.getState().setRankMode('farm');
      selectNextPointRanking(usePlannerStore.getState());
      expect(getFarmRankComputeCount()).toBe(1);

      // A second read with nothing changed must not spend a second farm rank call.
      selectNextPointRanking(usePlannerStore.getState());
      expect(getFarmRankComputeCount()).toBe(1);
    });
  });

  describe('identity stability under both modes', () => {
    it('two consecutive calls on an unchanged store are toBe-identical under dps', () => {
      activateHero([farmHero('a')], 'a');
      usePlannerStore.getState().setRankMode('dps');
      const first = selectNextPointRanking(usePlannerStore.getState());
      const second = selectNextPointRanking(usePlannerStore.getState());
      expect(second).toBe(first);
    });

    it('two consecutive calls on an unchanged store are toBe-identical under farm', () => {
      activateHero([farmHero('a'), farmHero('b')], 'a');
      usePlannerStore.getState().setRankMode('farm');
      const first = selectNextPointRanking(usePlannerStore.getState());
      const second = selectNextPointRanking(usePlannerStore.getState());
      expect(second).toBe(first);
    });
  });

  describe('fallback outcomes — pipeline rows plus a named fallback, never a table of zeros', () => {
    it('emptyPool: no roster at all, short-circuited before the domain call', () => {
      usePlannerStore.getState().setRankMode('farm');
      const result = selectNextPointRanking(usePlannerStore.getState());
      expect(result.mode).toBe('farm');
      expect(result.fallback).toBe('emptyPool');
      expect(result.rows).toHaveLength(7);
    });

    it('emptyPool: the fallback rows are the pipeline\'s own DPS ranking, not zeros', () => {
      usePlannerStore.getState().setRankMode('dps');
      const dpsRows = selectNextPointRanking(usePlannerStore.getState()).rows;
      usePlannerStore.getState().setRankMode('farm');
      const farmFallbackRows = selectNextPointRanking(usePlannerStore.getState()).rows;
      expect(farmFallbackRows).toEqual(dpsRows);
    });

    it('allDegenerate: every enabled hero has zero throughput — falls back with a named reason', () => {
      const degenerate = normalizeHero({
        id: 'z',
        name: 'Degenerate',
        sourceId: 'src-z',
        updatedAt: 1,
        rarity: 'Raro',
        level: 5,
        stars: 0,
        naked: { attack: 0, energy: 0, speed: 0, critChance: 0, critDmg: 0, penetration: 0, cdr: 0, luck: 0 },
        gearedOverride: { attack: 0, energy: 0, speed: 0, critChance: 0, critDmg: 0, penetration: 0, cdr: 0, luck: 0 },
        loadout: emptyLoadout(),
        pts: ZERO_PTS(),
        battleAllowed: true,
      });
      activateHero([degenerate], 'z');
      usePlannerStore.getState().setRankMode('farm');
      const result = selectNextPointRanking(usePlannerStore.getState());
      expect(result.mode).toBe('farm');
      expect(result.fallback).toBe('allDegenerate');
      expect(result.rows).toHaveLength(7);
    });

    it('noBaseline: zero field slots make every phase infeasible — falls back with a named reason', () => {
      activateHero([farmHero('a')], 'a');
      usePlannerStore.getState().applyAccountImport({ tree: null, houseIdx: null, houseLevel: null, phase: null, slots: 0 });
      usePlannerStore.getState().setRankMode('farm');
      const result = selectNextPointRanking(usePlannerStore.getState());
      expect(result.mode).toBe('farm');
      expect(result.fallback).toBe('noBaseline');
      expect(result.rows).toHaveLength(7);
    });
  });

  describe('a hero outside the pool is ranked as if added (addedToPool)', () => {
    it('with the active hero disabled in farmPoolOverrides, addedToPool is true, the composed bases contain them, and the ranking differs from the pool-without-them', () => {
      const heroes = [farmHero('a'), farmHero('b'), farmHero('c', { attack: 400 })];
      activateHero(heroes, 'a');
      usePlannerStore.getState().setFarmHeroEnabled('a', false);
      usePlannerStore.getState().setRankMode('farm');

      const result = selectNextPointRanking(usePlannerStore.getState());
      expect(result.mode).toBe('farm');
      expect(result.fallback).toBeNull();
      expect(result.addedToPool).toBe(true);

      // Ranking WITHOUT the disabled hero at all (pool = b, c only) must differ from the
      // "ranked as if added" result above — proving the disabled hero's basis genuinely joined
      // the squad computation rather than being silently dropped.
      const state = usePlannerStore.getState();
      const account = buildAccount(state);
      const withoutA = computeHeroFarmBases({ heroes, account, enabledHeroIds: ['b', 'c'] });
      const withoutARank = rankNextPointForFarm({
        bases: withoutA,
        account,
        heroId: 'b',
        objective: { kind: 'gold' },
        maxPhase: state.maxPhase,
        returnBonus: state.farmReturnBonus,
      });
      expect(withoutARank.outcome).toBe('ranked');
      expect(result.rows).not.toEqual(withoutARank.rows);
    });

    it('an active hero NOT present in the roster at all is still ranked, appended at the end', () => {
      // hydrateRoster with an activeHeroId that names no roster hero — a brand-new unsaved draft.
      usePlannerStore.getState().hydrateRoster([farmHero('a')], 'brand-new');
      const draft = farmHero('brand-new');
      usePlannerStore.getState().applyHero(draft);
      usePlannerStore.getState().setRankMode('farm');

      const result = selectNextPointRanking(usePlannerStore.getState());
      expect(result.mode).toBe('farm');
      expect(result.addedToPool).toBe(true);
      expect(result.fallback).toBeNull();
      expect(result.rows).toHaveLength(7);
    });
  });

  describe('selectNextPointBest / selectBestStat / selectBestGainPct — re-exported from the barrel under the same names', () => {
    it('selectBestStat / selectBestGainPct agree with selectNextPointBest', () => {
      activateHero([farmHero('a'), farmHero('b')], 'a');
      usePlannerStore.getState().setRankMode('dps');
      const state = usePlannerStore.getState();
      const best = selectNextPointBest(state);
      expect(selectBestStat(state)).toBe(best.stat);
      expect(selectBestGainPct(state)).toBe(best.gainPct);
    });
  });
});
