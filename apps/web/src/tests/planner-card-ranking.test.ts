import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { emptyLoadout } from '@bombfarm/domain/gear';
import { ZERO_PTS } from '@bombfarm/domain/planner-constants';
import { rankRosterByDps } from '@bombfarm/domain/roster-dps';
import {
  getHomeRankingComputeCount,
  resetHomeRankingCacheForTests,
  selectHomeRankingRows,
} from '@/features/home/model/planner-card-ranking';
import { normalizeHero } from '@/shared/lib/storage';
import {
  resetPlannerStoreForTests,
  selectCombatPhase,
  selectCurrentPhase,
  selectCurrentPhaseMitigationPct,
  selectRosterAccount,
  usePlannerStore,
} from '@/shared/stores';

const ACCOUNT_FARM_PHASE = 300;

function hero(id: string, attack: number) {
  const stats = { attack, energy: 120, speed: 60, critChance: 12, critDmg: 80, penetration: 5, cdr: 10, luck: 0 };
  return normalizeHero({
    id,
    name: `Hero ${id}`,
    sourceId: `src-${id}`,
    updatedAt: 1,
    rarity: 'Raro',
    level: 40,
    stars: 3,
    naked: stats,
    gearedOverride: stats,
    loadout: emptyLoadout(),
    pts: ZERO_PTS(),
  });
}

/** Twelve heroes whose roster order is not their strength order, with one equal-strength pair. */
function hydrateTwelve(): void {
  const attacks = [500, 900, 300, 700, 700, 1100, 200, 800, 600, 1000, 400, 100];
  const heroes = attacks.map((attack, index) => hero(`h${index + 1}`, attack));
  usePlannerStore.getState().hydrateRoster(heroes, 'h1');
  usePlannerStore.getState().applyAccountImport({
    tree: null,
    houseIdx: 0,
    houseLevel: 5,
    phase: ACCOUNT_FARM_PHASE,
  });
}

const state = () => usePlannerStore.getState();

describe('the front page’s top-nine ranking', () => {
  beforeEach(() => {
    resetPlannerStoreForTests();
    resetHomeRankingCacheForTests();
  });

  afterEach(() => {
    resetPlannerStoreForTests();
    resetHomeRankingCacheForTests();
  });

  it('a twelve-hero store ranks nine rows in descending DPS', () => {
    hydrateTwelve();
    const rows = selectHomeRankingRows(state());

    expect(rows).toHaveLength(9);
    for (let index = 1; index < rows.length; index += 1) {
      expect(rows[index].dps).toBeLessThanOrEqual(rows[index - 1].dps);
    }
    expect(rows[0].heroId).toBe('h6');
    expect(rows.map((row) => row.heroId)).not.toContain('h12');
  });

  it('a four-hero store ranks four', () => {
    usePlannerStore.getState().hydrateRoster([hero('a', 300), hero('b', 900), hero('c', 600), hero('d', 100)], 'a');
    const rows = selectHomeRankingRows(state());

    expect(rows.map((row) => row.heroId)).toEqual(['b', 'c', 'a', 'd']);
  });

  it('two heroes with equal DPS keep their roster order', () => {
    hydrateTwelve();
    const rows = selectHomeRankingRows(state());
    const equalPair = rows.filter((row) => row.heroId === 'h4' || row.heroId === 'h5');

    expect(equalPair[0].dps).toBe(equalPair[1].dps);
    expect(equalPair.map((row) => row.heroId)).toEqual(['h4', 'h5']);
  });

  it('ranks once per change of heroes, account, phase or mitigation', () => {
    hydrateTwelve();
    const first = selectHomeRankingRows(state());
    expect(selectHomeRankingRows(state())).toBe(first);
    expect(getHomeRankingComputeCount()).toBe(1);

    state().patchHero(hero('h12', 1200));
    const afterHeroCommit = selectHomeRankingRows(state());
    expect(afterHeroCommit).not.toBe(first);
    expect(afterHeroCommit[0].heroId).toBe('h12');
    expect(getHomeRankingComputeCount()).toBe(2);

    state().setPhasesViewPhase(137);
    const afterPhasePick = selectHomeRankingRows(state());
    expect(afterPhasePick).not.toBe(afterHeroCommit);
    expect(getHomeRankingComputeCount()).toBe(3);

    state().setLang('en');
    expect(selectHomeRankingRows(state())).toBe(afterPhasePick);
    expect(selectHomeRankingRows(state())).toBe(afterPhasePick);
    expect(getHomeRankingComputeCount()).toBe(3);
  });

  it('the phase it ranks at is the phase the hero panels agree on', () => {
    hydrateTwelve();
    state().setPhasesViewPhase(137);
    const pinnedToExplorer = selectHomeRankingRows(state());

    expect(selectCurrentPhase(state())).toBe(137);
    expect(pinnedToExplorer).toEqual(
      rankRosterByDps(
        {
          heroes: state().heroes,
          account: selectRosterAccount(state()),
          phase: selectCurrentPhase(state()),
          mitigationPct: selectCurrentPhaseMitigationPct(state()),
        },
        9,
      ),
    );

    state().setPlannerPhaseOverride(42);
    expect(selectCombatPhase(state())).toBe(42);
    expect(selectCurrentPhase(state())).toBe(137);
    expect(selectHomeRankingRows(state())).toBe(pinnedToExplorer);
  });
});
