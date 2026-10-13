import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PASS_ADDS, xpPerProp } from '@bombfarm/domain/phase-wiki';
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
  selectFarmPass,
  selectFarmXpBonusUnknown,
  selectFarmXpPerPropMult,
} from '@/shared/stores/selectors/farm-ranking-selectors';
import { selectAccountShared } from '@/shared/stores/selectors/account-selectors';
import { normalizeAccount } from '@/shared/lib/account-shared';
import { resetPlannerStoreForTests, usePlannerStore } from '@/shared/stores';
import { phaseXpPerPropMult } from '@bombfarm/farm/core';

function farmHero(id: string, overrides: Partial<{ battleAllowed: boolean; xpRunePct: number }> = {}) {
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
    ...(overrides.xpRunePct !== undefined
      ? { runes: [{ axis: 'xp', strengthPct: overrides.xpRunePct, playSecondsLeft: 600, rarity: 0 }] }
      : {}),
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
      expectRecompute(() => usePlannerStore.getState().setFarmReturnBonus('on'));
    });

    it('farmPass', () => {
      expectRecompute(() => usePlannerStore.getState().setFarmPass(true));
    });

    it('treeXpMult', () => {
      expectRecompute(() =>
        usePlannerStore.getState().applyAccountImport({
          tree: { danoTotal: 1, critChance: 0, critDmg: 0, speed: 0, energy: 0, teamCoinPct: 0, luckFlatPct: 0, xpMult: 2.35 },
          houseIdx: null,
          houseLevel: null,
          phase: null,
        }),
      );
    });

    it('farmBoost', () => {
      expectRecompute(() => usePlannerStore.getState().setFarmBoost({ gold: false, xp: true, drop: false }));
    });
  });
});

describe('the XP the board prints', () => {
  const TREE = { danoTotal: 1, critChance: 0, critDmg: 0, speed: 0, energy: 0, teamCoinPct: 0, luckFlatPct: 0 };

  beforeEach(() => {
    resetPlannerStoreForTests();
    usePlannerStore.getState().hydrateRoster([farmHero('a')], null);
  });

  afterEach(() => {
    resetPlannerStoreForTests();
  });

  function xpRows() {
    return selectFarmRankingRows(usePlannerStore.getState()).rows.filter((row) => (row.xpPerHour ?? 0) > 0);
  }

  function importXpMult(xpMult: number) {
    usePlannerStore.getState().applyAccountImport({ tree: { ...TREE, xpMult }, houseIdx: null, houseLevel: null, phase: null });
  }

  it('scales exactly with the account XP multiplier, which used to never reach it', () => {
    importXpMult(1);
    const bare = xpRows();
    importXpMult(2.35);
    const scaled = xpRows();
    expect(bare.length).toBeGreaterThan(0);
    for (const row of bare) {
      const match = scaled.find((candidate) => candidate.phase === row.phase)!;
      expect((match.xpPerHour ?? Number.NaN) / (row.xpPerHour ?? Number.NaN)).toBeCloseTo(2.35, 9);
      expect(match.goldPerHour).toBe(row.goldPerHour);
    }
  });

  it('an xp Boost adds its 100% inside the Pass bracket: ×2.3 over ×1.3', () => {
    importXpMult(2.35);
    usePlannerStore.getState().setFarmPass(true);
    const passOnly = xpRows();
    usePlannerStore.getState().setFarmBoost({ gold: false, xp: true, drop: false });
    const boosted = xpRows();
    for (const row of passOnly) {
      const match = boosted.find((candidate) => candidate.phase === row.phase)!;
      expect((match.xpPerHour ?? Number.NaN) / (row.xpPerHour ?? Number.NaN)).toBeCloseTo(2.3 / 1.3, 9);
      expect(match.goldPerHour).toBe(row.goldPerHour);
    }
  });

  it('with no save imported, XP is priced at ×1 and the board says it leaves the account bonuses out', () => {
    expect(selectFarmXpBonusUnknown(usePlannerStore.getState())).toBe(true);
    expect(xpRows().length).toBeGreaterThan(0);
    importXpMult(2.35);
    expect(selectFarmXpBonusUnknown(usePlannerStore.getState())).toBe(false);
  });

  it('an imported save with an unusable XP multiplier withholds every XP figure, and nothing else', () => {
    importXpMult(1);
    const priced = selectFarmRankingRows(usePlannerStore.getState()).rows;
    usePlannerStore.getState().applyAccountImport({ tree: { ...TREE, xpMult: null }, houseIdx: null, houseLevel: null, phase: null });
    const state = usePlannerStore.getState();
    const withheld = selectFarmRankingRows(state).rows;
    expect(withheld.length).toBe(priced.length);
    expect(withheld.every((row) => row.xpPerHour === null)).toBe(true);
    expect(withheld.map((row) => row.goldPerHour)).toEqual(priced.map((row) => row.goldPerHour));
    expect(selectFarmXpPerPropMult(state)).toBeNull();
    expect(selectFarmXpBonusUnknown(state)).toBe(false);
  });

  it('a withheld XP multiplier survives the saved-account round trip instead of reloading as ×1', () => {
    usePlannerStore.getState().applyAccountImport({ tree: { ...TREE, xpMult: null }, houseIdx: null, houseLevel: null, phase: null });
    const reloaded = normalizeAccount(
      JSON.parse(JSON.stringify(selectAccountShared(usePlannerStore.getState()))) as Parameters<typeof normalizeAccount>[0],
    );
    expect(reloaded.tree.xpMult).toBeNull();
    resetPlannerStoreForTests();
    usePlannerStore.getState().hydrateAccount(reloaded);
    expect(usePlannerStore.getState().treeXpMult).toBeNull();
  });

  it('the Phases panel per-prop XP times the row props/hr is the row XP/hr, phase for phase', () => {
    importXpMult(2.35);
    usePlannerStore.getState().setFarmPass(true);
    usePlannerStore.getState().setFarmReturnBonus('on');
    usePlannerStore.getState().setFarmBoost({ gold: true, xp: true, drop: false });
    const mult = selectFarmXpPerPropMult(usePlannerStore.getState());
    expect(mult).toBeCloseTo(2.35 * (1 + 1 + 0.3 + 1), 12);
    for (const row of xpRows()) {
      expect(row.xpPerHour).toBeCloseTo(row.propsPerHour * xpPerProp(row.phase) * (mult ?? Number.NaN), 4);
    }
  });

  it('and so it does for a squad carrying an XP rune, whose mix moves with the kill shares', () => {
    usePlannerStore.getState().hydrateRoster([farmHero('a'), farmHero('b', { xpRunePct: 9 })], null);
    importXpMult(2.35);
    usePlannerStore.getState().setFarmPass(true);
    const state = usePlannerStore.getState();
    const mult = selectFarmXpPerPropMult(state);
    const rows = selectFarmRankingRows(state).rows;
    const runed = xpRows();
    expect(runed.some((row) => row.xpRuneMix > 1 && row.xpRuneMix < 1.09)).toBe(true);
    for (const row of runed) {
      const perProp = xpPerProp(row.phase) * (phaseXpPerPropMult(mult, rows, row.phase) ?? Number.NaN);
      expect(row.xpPerHour).toBeCloseTo(row.propsPerHour * perProp, 4);
    }
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

  it('defaults to off, with no Pass', () => {
    expect(selectFarmReturnBonus(usePlannerStore.getState())).toBe('off');
    expect(selectFarmPass(usePlannerStore.getState())).toBe(false);
  });
});

describe('the Pass reaches the board', () => {
  beforeEach(() => {
    resetPlannerStoreForTests();
  });

  afterEach(() => {
    resetPlannerStoreForTests();
  });

  it('multiplies gold per hour by one plus the Pass gold add when the Return Bonus is off', () => {
    usePlannerStore.getState().hydrateRoster([farmHero('a')], null);
    const phase = 5;
    const goldPerHour = () =>
      selectFarmRankingRows(usePlannerStore.getState()).rows.find((row) => row.phase === phase)!
        .goldPerHour;
    const bare = goldPerHour();
    usePlannerStore.getState().setFarmPass(true);
    const withPass = goldPerHour();
    expect(bare).toBeGreaterThan(0);
    expect(withPass / bare).toBeCloseTo(1 + PASS_ADDS.gold[1] - PASS_ADDS.gold[0], 6);
  });
});

describe('the roster identity invariant, observed through the board', () => {
  beforeEach(() => {
    resetPlannerStoreForTests();
    resetFarmRankingComputeCount();
    usePlannerStore.getState().hydrateRoster([farmHero('a')], null);
    selectFarmRankingRows(usePlannerStore.getState());
    expect(getFarmRankingComputeCount()).toBe(1);
  });

  afterEach(() => {
    resetPlannerStoreForTests();
    resetFarmRankingComputeCount();
  });

  // The NON-mutation counterpart to the per-member loop above: a no-op autosave patch must leave
  // `state.heroes` alone. See `patchHeroInList` in `@/shared/lib/storage` for what a fresh
  // roster array does to this tuple and why it failed silently.
  // The IMPORT path holds the same contract via `importHeroes`; its cases live in
  // `farm-board-import-identity.test.ts` (this suite sits at its own max-lines cap).
  it('a NO-OP autosave patch does not recompute the board: the roster array keeps its identity', () => {
    const before = usePlannerStore.getState().heroes;
    const rows = selectFarmRankingRows(usePlannerStore.getState());
    const rebuilt = normalizeHero({ ...structuredClone(before[0]), updatedAt: before[0].updatedAt + 700 });
    usePlannerStore.getState().patchHero(rebuilt);

    const state = usePlannerStore.getState();
    expect(state.heroes).toBe(before);
    expect(selectFarmRankingRows(state)).toBe(rows);
    expect(getFarmRankingComputeCount()).toBe(1);
  });

  it('an autosave patch that DID change the hero still recomputes the board', () => {
    const before = usePlannerStore.getState().heroes;
    const rows = selectFarmRankingRows(usePlannerStore.getState());
    usePlannerStore.getState().patchHero({ ...before[0], level: before[0].level + 1 });

    const state = usePlannerStore.getState();
    expect(state.heroes).not.toBe(before);
    expect(selectFarmRankingRows(state)).not.toBe(rows);
    expect(getFarmRankingComputeCount()).toBe(2);
  });
});
