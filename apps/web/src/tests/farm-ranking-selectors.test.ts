import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { emptyLoadout } from '@bombfarm/domain/gear';
import { ZERO_PTS } from '@bombfarm/domain/planner-constants';
import { gateFarmRespec, type FarmRespecResult } from '@bombfarm/domain/farm-optimize';
import { normalizeHero, type AccountShared } from '@/shared/lib/storage';
import {
  computeFarmRespecShouldSurface,
  getFarmRankingComputeCount,
  getFarmRespecGateComputeCount,
  getFarmRespecRowsComputeCount,
  getFarmRespecSolveCount,
  readFarmRespecDepTuple,
  resetFarmRankingCache,
  resetFarmRankingComputeCount,
  resetFarmRespecGateComputeCount,
  resetFarmRespecRowsComputeCount,
  resetFarmRespecSolveCount,
  runFarmRespecSolve,
  selectFarmBoardRows,
  selectFarmPoolEntries,
  selectFarmRankingRows,
  selectFarmRespecGate,
  selectFarmRespecIsStale,
  selectFarmRespecStatus,
  selectFarmRespecView,
  selectFarmReRankActive,
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

/** Used only by the new Farm Respec Advisor describe blocks below — the shipped
 *  `selectFarmRankingRows` describe block above keeps its own original two reset calls
 *  untouched. */
function resetAllFarmCaches() {
  resetFarmRankingComputeCount();
  resetFarmRespecGateComputeCount();
  resetFarmRespecSolveCount();
  resetFarmRespecRowsComputeCount();
}

describe('selectFarmRankingRows', () => {
  beforeEach(() => {
    resetPlannerStoreForTests();
    resetFarmRankingComputeCount();
    resetFarmRespecGateComputeCount();
    resetFarmRespecSolveCount();
    resetFarmRespecRowsComputeCount();
  });

  afterEach(() => {
    resetPlannerStoreForTests();
    resetFarmRankingComputeCount();
    resetFarmRespecGateComputeCount();
    resetFarmRespecSolveCount();
    resetFarmRespecRowsComputeCount();
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

const MINIMAL_ACCOUNT: AccountShared = {
  tree: { danoTotal: 1, critChance: 0, critDmg: 0, speed: 0, energy: 0, teamCoinPct: 0, luckFlatPct: 0 },
  teamBuffs: {},
  context: { houseIdx: 0, houseLevel: 0, phase: null, mitigationPct: 1, rankMode: 'dps', targetProp: 'stone' },
  slots: 9,
  maxPhase: null,
};

/**
 * The 16 mutators readFarmRespecDepTuple must react to: the 15 inherited from the ranking
 * tuple (mirrors the "every dep-tuple member drives a recompute" list above), plus the
 * objective, appended last. Reused by the Tier 1 recompute test, the staleness test and the
 * proposed-rows compute-count test so all three drive the exact same 16 members.
 */
function respecTupleMutators(): { name: string; mutate: () => void }[] {
  return [
    {
      name: 'heroes',
      mutate: () => usePlannerStore.getState().hydrateRoster([farmHero('a'), farmHero('b')], null),
    },
    {
      name: 'treeDanoTotal',
      mutate: () =>
        usePlannerStore.getState().applyAccountImport({
          tree: { danoTotal: 2, critChance: 0, critDmg: 0, speed: 0, energy: 0, teamCoinPct: 0, luckFlatPct: 0 },
          houseIdx: null,
          houseLevel: null,
          phase: null,
        }),
    },
    {
      name: 'treeCritChance',
      mutate: () =>
        usePlannerStore.getState().applyAccountImport({
          tree: { danoTotal: 1, critChance: 5, critDmg: 0, speed: 0, energy: 0, teamCoinPct: 0, luckFlatPct: 0 },
          houseIdx: null,
          houseLevel: null,
          phase: null,
        }),
    },
    {
      name: 'treeCritDmg',
      mutate: () =>
        usePlannerStore.getState().applyAccountImport({
          tree: { danoTotal: 1, critChance: 0, critDmg: 5, speed: 0, energy: 0, teamCoinPct: 0, luckFlatPct: 0 },
          houseIdx: null,
          houseLevel: null,
          phase: null,
        }),
    },
    {
      name: 'treeSpeed',
      mutate: () =>
        usePlannerStore.getState().applyAccountImport({
          tree: { danoTotal: 1, critChance: 0, critDmg: 0, speed: 5, energy: 0, teamCoinPct: 0, luckFlatPct: 0 },
          houseIdx: null,
          houseLevel: null,
          phase: null,
        }),
    },
    {
      name: 'treeEnergy',
      mutate: () =>
        usePlannerStore.getState().applyAccountImport({
          tree: { danoTotal: 1, critChance: 0, critDmg: 0, speed: 0, energy: 5, teamCoinPct: 0, luckFlatPct: 0 },
          houseIdx: null,
          houseLevel: null,
          phase: null,
        }),
    },
    {
      name: 'treeTeamCoinPct',
      mutate: () =>
        usePlannerStore.getState().applyAccountImport({
          tree: { danoTotal: 1, critChance: 0, critDmg: 0, speed: 0, energy: 0, teamCoinPct: 5, luckFlatPct: 0 },
          houseIdx: null,
          houseLevel: null,
          phase: null,
        }),
    },
    {
      name: 'treeLuckFlatPct',
      mutate: () =>
        usePlannerStore.getState().applyAccountImport({
          tree: { danoTotal: 1, critChance: 0, critDmg: 0, speed: 0, energy: 0, teamCoinPct: 0, luckFlatPct: 5 },
          houseIdx: null,
          houseLevel: null,
          phase: null,
        }),
    },
    {
      name: 'teamBuffs',
      mutate: () =>
        usePlannerStore
          .getState()
          .setTeamBuffs({ ...usePlannerStore.getState().teamBuffs, grito_guerra: 3 }),
    },
    { name: 'houseIdx', mutate: () => usePlannerStore.getState().setHouseIdx(2) },
    { name: 'houseLevel', mutate: () => usePlannerStore.getState().setHouseLevel(4) },
    {
      name: 'slots',
      mutate: () =>
        usePlannerStore
          .getState()
          .applyAccountImport({ tree: null, houseIdx: null, houseLevel: null, phase: null, slots: 5 }),
    },
    {
      name: 'maxPhase',
      mutate: () =>
        usePlannerStore
          .getState()
          .applyAccountImport({ tree: null, houseIdx: null, houseLevel: null, phase: null, maxPhase: 42 }),
    },
    { name: 'farmPoolOverrides', mutate: () => usePlannerStore.getState().setFarmHeroEnabled('a', false) },
    { name: 'farmReturnBonus', mutate: () => usePlannerStore.getState().setFarmReturnBonus('vip') },
    { name: 'farmObjective', mutate: () => usePlannerStore.getState().setFarmObjective('chests') },
  ];
}

/** Sets a FRESH proposal directly (bypassing the T5 solve action, which does not exist in this
 *  file's scope) so the staleness/rows tests can start from a known-fresh state. */
function primeFreshProposal() {
  const state = usePlannerStore.getState();
  const result = runFarmRespecSolve(state);
  usePlannerStore.setState({
    farmRespecProposal: { deps: readFarmRespecDepTuple(usePlannerStore.getState()), result },
    farmRespecStatus: 'done',
  });
}

describe('readFarmRespecDepTuple', () => {
  beforeEach(() => {
    resetPlannerStoreForTests();
    resetAllFarmCaches();
  });

  afterEach(() => {
    resetPlannerStoreForTests();
    resetAllFarmCaches();
  });

  it('has 16 members — the 15 ranking members plus the objective, appended last', () => {
    usePlannerStore.getState().hydrateRoster([farmHero('a')], null);
    const tuple = readFarmRespecDepTuple(usePlannerStore.getState());
    expect(tuple).toHaveLength(16);
    expect(tuple[15]).toBe(usePlannerStore.getState().farmObjective);
  });

  it('changing the objective changes ONLY the 16th entry — the first 15 stay identity-equal', () => {
    usePlannerStore.getState().hydrateRoster([farmHero('a')], null);
    const before = readFarmRespecDepTuple(usePlannerStore.getState());
    usePlannerStore.getState().setFarmObjective('blend');
    const after = readFarmRespecDepTuple(usePlannerStore.getState());
    for (let index = 0; index < 15; index++) {
      expect(Object.is(before[index], after[index]), `entry ${index} changed unexpectedly`).toBe(true);
    }
    expect(before[15]).toBe('gold');
    expect(after[15]).toBe('blend');
  });
});

describe('selectFarmRespecGate (Tier 1)', () => {
  beforeEach(() => {
    resetPlannerStoreForTests();
    resetAllFarmCaches();
  });

  afterEach(() => {
    resetPlannerStoreForTests();
    resetAllFarmCaches();
  });

  it('empty roster short-circuits to no-roster WITHOUT calling gateFarmRespec', () => {
    // gateFarmRespec's return type always populates `result`; a null result here is the proof
    // the domain call never happened, not merely that the reason field was set.
    const gate = selectFarmRespecGate(usePlannerStore.getState());
    expect(gate.reason).toBe('no-roster');
    expect(gate.result).toBeNull();
    expect(gate.shouldSurface).toBe(false);
  });

  it('every hero disabled short-circuits to no-heroes-enabled WITHOUT calling gateFarmRespec', () => {
    usePlannerStore.getState().hydrateRoster([farmHero('a', { battleAllowed: false })], null);
    const gate = selectFarmRespecGate(usePlannerStore.getState());
    expect(gate.reason).toBe('no-heroes-enabled');
    expect(gate.result).toBeNull();
    expect(gate.shouldSurface).toBe(false);
  });

  it('a farmPoolOverrides override of false on an otherwise-allowed hero also short-circuits to no-heroes-enabled', () => {
    usePlannerStore.getState().hydrateRoster([farmHero('a')], null);
    usePlannerStore.getState().setFarmHeroEnabled('a', false);
    const gate = selectFarmRespecGate(usePlannerStore.getState());
    expect(gate.reason).toBe('no-heroes-enabled');
  });

  it('N invocations with unchanged deps -> 1 compute, same object identity', () => {
    usePlannerStore.getState().hydrateRoster([farmHero('a')], null);
    const a = selectFarmRespecGate(usePlannerStore.getState());
    const b = selectFarmRespecGate(usePlannerStore.getState());
    const c = selectFarmRespecGate(usePlannerStore.getState());
    expect(getFarmRespecGateComputeCount()).toBe(1);
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it('resetFarmRespecGateComputeCount forces a recompute even with structurally-equal deps', () => {
    usePlannerStore.getState().hydrateRoster([farmHero('a')], null);
    selectFarmRespecGate(usePlannerStore.getState());
    resetFarmRespecGateComputeCount();
    selectFarmRespecGate(usePlannerStore.getState());
    expect(getFarmRespecGateComputeCount()).toBe(1);
  });

  it('(structural) shouldSurface is gainPct alone — paybackHours never gates, at any value including null', () => {
    expect(
      computeFarmRespecShouldSurface({ gainPct: 5, paybackHours: null } as FarmRespecResult),
    ).toBe(true);
    expect(
      computeFarmRespecShouldSurface({ gainPct: 0.9, paybackHours: 0.1 } as FarmRespecResult),
    ).toBe(false);
  });

  it('(structural) a hand-forced out-of-range blend weight clamps to 1 without throwing', () => {
    let result: FarmRespecResult | undefined;
    expect(() => {
      result = gateFarmRespec({
        heroes: [farmHero('a')],
        account: MINIMAL_ACCOUNT,
        enabledHeroIds: ['a'],
        objective: { kind: 'blend', weight: 7 },
        maxPhase: null,
        returnBonus: 'off',
      });
    }).not.toThrow();
    expect(result?.objective.weight).toBe(1);
    expect(result?.objective.kind).toBe('gold');
  });

  describe('every one of the 16 tuple members drives a gate recompute, and NEVER a solve', () => {
    beforeEach(() => {
      usePlannerStore.getState().hydrateRoster([farmHero('a')], null);
      selectFarmRespecGate(usePlannerStore.getState());
    });

    for (const { name, mutate } of respecTupleMutators()) {
      it(name, () => {
        const gateBefore = getFarmRespecGateComputeCount();
        mutate();
        selectFarmRespecGate(usePlannerStore.getState());
        expect(getFarmRespecGateComputeCount()).toBe(gateBefore + 1);
        expect(getFarmRespecSolveCount()).toBe(0);
      });
    }
  });
});

describe('runFarmRespecSolve (Tier 2 — a plain function, not a selector)', () => {
  beforeEach(() => {
    resetPlannerStoreForTests();
    resetAllFarmCaches();
  });

  afterEach(() => {
    resetPlannerStoreForTests();
    resetAllFarmCaches();
  });

  it('increments the solve counter and returns a full-tier result', () => {
    usePlannerStore.getState().hydrateRoster([farmHero('a')], null);
    const result = runFarmRespecSolve(usePlannerStore.getState());
    expect(getFarmRespecSolveCount()).toBe(1);
    expect(result.tier).toBe('full');
  });

  it('has no memo of its own — every call solves again; idempotency is the slice action\'s job', () => {
    usePlannerStore.getState().hydrateRoster([farmHero('a')], null);
    runFarmRespecSolve(usePlannerStore.getState());
    runFarmRespecSolve(usePlannerStore.getState());
    expect(getFarmRespecSolveCount()).toBe(2);
  });

  it('resetFarmRespecSolveCount resets the counter to 0', () => {
    usePlannerStore.getState().hydrateRoster([farmHero('a')], null);
    runFarmRespecSolve(usePlannerStore.getState());
    resetFarmRespecSolveCount();
    expect(getFarmRespecSolveCount()).toBe(0);
  });
});

describe('staleness derivations (an input change invalidates the proposal and reverts re-rank)', () => {
  beforeEach(() => {
    resetPlannerStoreForTests();
    resetAllFarmCaches();
    usePlannerStore.getState().hydrateRoster([farmHero('a')], null);
    primeFreshProposal();
  });

  afterEach(() => {
    resetPlannerStoreForTests();
    resetAllFarmCaches();
  });

  it('a fresh proposal is not stale, and view/status/reRank read through it', () => {
    usePlannerStore.getState().setFarmRespecReRank(true);
    const state = usePlannerStore.getState();
    expect(selectFarmRespecIsStale(state)).toBe(false);
    expect(selectFarmRespecView(state)).toBe(state.farmRespecProposal);
    expect(selectFarmRespecStatus(state)).toBe('done');
    expect(selectFarmReRankActive(state)).toBe(true);
  });

  for (const { name, mutate } of respecTupleMutators()) {
    it(`${name} change invalidates the proposal: view -> null, status -> idle, reRank -> false`, () => {
      usePlannerStore.getState().setFarmRespecReRank(true);
      mutate();
      const state = usePlannerStore.getState();
      expect(selectFarmRespecIsStale(state)).toBe(true);
      expect(selectFarmRespecView(state)).toBeNull();
      expect(selectFarmRespecStatus(state)).toBe('idle');
      expect(selectFarmReRankActive(state)).toBe(false);
    });
  }
});

describe('selectFarmBoardRows (proposed rows compute ONLY in re-rank mode)', () => {
  beforeEach(() => {
    resetPlannerStoreForTests();
    resetAllFarmCaches();
    usePlannerStore.getState().hydrateRoster([farmHero('a')], null);
    primeFreshProposal();
  });

  afterEach(() => {
    resetPlannerStoreForTests();
    resetAllFarmCaches();
  });

  it('returns selectFarmRankingRows\' own object identity when re-rank is off', () => {
    const state = usePlannerStore.getState();
    expect(Object.is(selectFarmBoardRows(state), selectFarmRankingRows(state))).toBe(true);
  });

  it('the proposed-row compute count stays 0 across every tuple member change while re-rank is off', () => {
    for (const { mutate } of respecTupleMutators()) {
      mutate();
      selectFarmBoardRows(usePlannerStore.getState());
    }
    expect(getFarmRespecRowsComputeCount()).toBe(0);
  });

  it('flipping re-rank on computes once; flipping off then on again with unchanged inputs reuses the memo', () => {
    usePlannerStore.getState().setFarmRespecReRank(true);
    selectFarmBoardRows(usePlannerStore.getState());
    expect(getFarmRespecRowsComputeCount()).toBe(1);

    usePlannerStore.getState().setFarmRespecReRank(false);
    usePlannerStore.getState().setFarmRespecReRank(true);
    selectFarmBoardRows(usePlannerStore.getState());
    expect(getFarmRespecRowsComputeCount()).toBe(1);
  });
});

describe('resetFarmRankingCache clears all three caches', () => {
  beforeEach(() => {
    resetPlannerStoreForTests();
    resetAllFarmCaches();
  });

  afterEach(() => {
    resetPlannerStoreForTests();
    resetAllFarmCaches();
  });

  it('forces a recompute of both the ranking rows and the Tier 1 gate', () => {
    usePlannerStore.getState().hydrateRoster([farmHero('a')], null);
    selectFarmRankingRows(usePlannerStore.getState());
    selectFarmRespecGate(usePlannerStore.getState());

    resetFarmRankingCache();

    selectFarmRankingRows(usePlannerStore.getState());
    selectFarmRespecGate(usePlannerStore.getState());
    expect(getFarmRankingComputeCount()).toBe(2);
    expect(getFarmRespecGateComputeCount()).toBe(2);
  });

  it('also forces a recompute of the board-rows (re-rank) cache', () => {
    usePlannerStore.getState().hydrateRoster([farmHero('a')], null);
    primeFreshProposal();
    usePlannerStore.getState().setFarmRespecReRank(true);
    selectFarmBoardRows(usePlannerStore.getState());
    expect(getFarmRespecRowsComputeCount()).toBe(1);

    resetFarmRankingCache();

    selectFarmBoardRows(usePlannerStore.getState());
    expect(getFarmRespecRowsComputeCount()).toBe(2);
  });
});
