import { describe, expect, it } from 'vitest';
import { formatItemRosterTooltip } from '@bombfarm/domain/game-labels';
import { emptyLoadout } from '@bombfarm/domain/gear';
import type { InventoryItem } from '@bombfarm/domain/inventory';
import { ZERO_PTS } from '@bombfarm/domain/planner-constants';
import type { TeamPlan } from '@bombfarm/domain/team-plan/types';
import { FARM_RESPEC_WORTH_MAKING_PCT } from '@bombfarm/farm/core';
import { formatCompactNumber } from '@bombfarm/ui';
import { belowFloor, gainPct, planActions } from '@/features/home/model/optimizer-actions';
import { STRINGS, sub, type Lang } from '@/shared/i18n';
import { normalizeHero } from '@/shared/lib/storage';

const LANGS: readonly Lang[] = ['en', 'pt'];

function hero(id: string, name: string) {
  return normalizeHero({
    id,
    name,
    sourceId: `src-${id}`,
    updatedAt: 1,
    rarity: 'Raro',
    level: 10,
    stars: 1,
    naked: { attack: 100, energy: 100, speed: 50, critChance: 0, critDmg: 10, penetration: 0, cdr: 0, luck: 0 },
    gearedOverride: { attack: 100, energy: 100, speed: 50, critChance: 0, critDmg: 10, penetration: 0, cdr: 0, luck: 0 },
    loadout: emptyLoadout(),
    pts: ZERO_PTS(),
    battleAllowed: true,
  });
}

function item(id: string, defId: string, upgrade: number): InventoryItem {
  return {
    id,
    defId,
    rarityIdx: 2,
    level: 10,
    upgrade,
    slot: 'calca',
    equipped: false,
    equippedBy: null,
    defResolved: true,
    marketBlocked: false,
  };
}

function plan(overrides: Partial<TeamPlan>): TeamPlan {
  return {
    steps: [],
    forgeList: [],
    moveList: [],
    pointResets: [],
    perHero: [],
    proposedLoadouts: {},
    regime: 'underSaturated',
    sumDuty: 1,
    slots: 3,
    currentDps: 100,
    planDps: 120,
    forgeFloorApplied: 10,
    allowedChanges: 'both',
    scoredPhase: null,
    scoredPhaseSource: 'account',
    scoredPhaseInfeasible: false,
    gearBreakdown: { forgeDelta: 0, moveDelta: 0 },
    requiresFullPlan: false,
    gearDipDps: 0,
    runedHeroNames: [],
    run: { rounds: 1, evaluations: 1, budgetExhausted: false, elapsedMs: 1, seedUsed: 'seed' },
    ...overrides,
  };
}

function reset(heroId: string, rosterGainObjective: number): TeamPlan['pointResets'][number] {
  return { heroId, ptsBefore: {}, pts: {}, heroGainDpsPct: 0, rosterGainObjective, resetCostGold: 0 };
}

const HEROES = [hero('a', 'Hero a'), hero('b', 'Hero b')];
const EMBER = item('1', 'ember_calca', 8);
const nameOf = (inv: InventoryItem, lang: Lang) =>
  formatItemRosterTooltip({ ...inv, upgrade: 0 }, lang, STRINGS[lang].rankLv).title;

describe("the optimizer card's first actions", () => {
  it('lists equips in list order, then forges, then resets, with a contribution only on a reset', () => {
    const solved = plan({
      pointResets: [reset('src-a', 1234)],
      forgeList: [{ itemId: '1', defId: 'ember_calca', from: 8, to: 10 }],
      moveList: [
        { phase: 'unequip', itemId: '1', defId: 'ember_calca', slot: 'calca', fromHeroId: 'src-a', toHeroId: null },
        { phase: 'equip', itemId: '2', defId: 'ember_calca', slot: 'calca', fromHeroId: null, toHeroId: 'src-b' },
        { phase: 'equip', itemId: '1', defId: 'ember_calca', slot: 'calca', fromHeroId: 'src-a', toHeroId: 'src-b' },
      ],
    });
    for (const lang of LANGS) {
      const { rows } = planActions(solved, [EMBER, item('2', 'ember_calca', 0)], HEROES, STRINGS[lang], lang);
      expect(rows.map((row) => row.kind)).toEqual(['equip', 'move', 'forge', 'reset']);
      expect(rows.map((row) => row.contribution)).toEqual([null, null, null, `+${formatCompactNumber(1234, lang, 1)}`]);
      expect(rows[3]?.contribution).toBe(lang === 'en' ? '+1.2k' : '+1,2k');
    }
    const negative = planActions(plan({ pointResets: [reset('src-a', -50)] }), [], HEROES, STRINGS.en, 'en');
    expect(negative.rows[0]?.contribution).toBe('-50');
  });

  it('names a move when the item leaves a hero and an equip when it comes from the pool', () => {
    const solved = plan({
      moveList: [
        { phase: 'unequip', itemId: '1', defId: 'ember_calca', slot: 'calca', fromHeroId: 'src-a', toHeroId: null },
        { phase: 'equip', itemId: '1', defId: 'ember_calca', slot: 'calca', fromHeroId: 'src-a', toHeroId: 'src-b' },
        { phase: 'equip', itemId: '2', defId: 'ember_calca', slot: 'calca', fromHeroId: null, toHeroId: 'src-a' },
      ],
    });
    for (const lang of LANGS) {
      const t = STRINGS[lang];
      const { rows } = planActions(solved, [EMBER, item('2', 'ember_calca', 0)], HEROES, t, lang);
      expect(rows).toHaveLength(2);
      expect(rows[0]).toEqual({
        kind: 'move',
        text: sub(t.homeCardOptimizerActionMove, { item: nameOf(EMBER, lang), hero: 'Hero b' }),
        contribution: null,
      });
      expect(rows[1]).toEqual({
        kind: 'equip',
        text: sub(t.homeCardOptimizerActionEquip, { item: nameOf(EMBER, lang), hero: 'Hero a' }),
        contribution: null,
      });
    }
    const en = planActions(solved, [EMBER, item('2', 'ember_calca', 0)], HEROES, STRINGS.en, 'en');
    expect(en.rows[0]?.text).toBe('Move Ember Legs to Hero b');
    expect(en.rows[1]?.text).toBe('Equip Ember Legs on Hero a');
  });

  it('names gear by set and slot without its forge level', () => {
    const solved = plan({
      forgeList: [
        { itemId: '1', defId: 'ember_calca', from: 8, to: 12 },
        { itemId: 'missing', defId: 'ghost_def', from: 0, to: 3 },
      ],
      pointResets: [reset('src-unknown', 5)],
    });
    for (const lang of LANGS) {
      const t = STRINGS[lang];
      const { rows } = planActions(solved, [EMBER], HEROES, t, lang);
      expect(rows[0]?.text).toBe(sub(t.homeCardOptimizerActionForge, { item: nameOf(EMBER, lang), from: 8, to: 12 }));
      const suffixed = formatItemRosterTooltip(EMBER, lang, t.rankLv).title;
      expect(suffixed.endsWith(' +8')).toBe(true);
      expect(rows[0]?.text).not.toContain(suffixed);
      expect(rows[1]?.text).toBe(sub(t.homeCardOptimizerActionForge, { item: 'ghost_def', from: 0, to: 3 }));
      expect(rows[2]?.text).toBe(sub(t.homeCardOptimizerActionReset, { hero: 'src-unknown' }));
    }
    const en = planActions(solved, [EMBER], HEROES, STRINGS.en, 'en');
    expect(en.rows[0]?.text).toBe('Forge Ember Legs from +8 to +12');
    expect(en.rows[2]?.text).toBe("Reset src-unknown's points");
  });

  it('counts distinct items across moves and forges, and resets separately', () => {
    const movedAndForged = plan({
      moveList: [
        { phase: 'unequip', itemId: '1', defId: 'ember_calca', slot: 'calca', fromHeroId: 'src-a', toHeroId: null },
        { phase: 'equip', itemId: '1', defId: 'ember_calca', slot: 'calca', fromHeroId: 'src-a', toHeroId: 'src-b' },
        { phase: 'equip', itemId: '2', defId: 'ember_calca', slot: 'calca', fromHeroId: null, toHeroId: 'src-b' },
      ],
      forgeList: [
        { itemId: '1', defId: 'ember_calca', from: 8, to: 10 },
        { itemId: '3', defId: 'ember_calca', from: 0, to: 2 },
      ],
      pointResets: [reset('src-a', 1), reset('src-b', 2)],
    });
    const counted = planActions(movedAndForged, [EMBER], HEROES, STRINGS.en, 'en');
    expect(counted.moves).toBe(3);
    expect(counted.resets).toBe(2);
    expect(counted.rows).toHaveLength(6);

    const oneMove = plan({
      moveList: [
        { phase: 'equip', itemId: '1', defId: 'ember_calca', slot: 'calca', fromHeroId: null, toHeroId: 'src-b' },
      ],
    });
    expect(planActions(oneMove, [EMBER], HEROES, STRINGS.en, 'en')).toMatchObject({ moves: 1, resets: 0 });
    expect(planActions(plan({}), [], HEROES, STRINGS.en, 'en')).toEqual({ rows: [], moves: 0, resets: 0 });
  });

  it('a strip-only unequip counts as a move though it lists no row', () => {
    const stripOnly = plan({
      moveList: [
        { phase: 'unequip', itemId: 'x', defId: 'ember_calca', slot: 'calca', fromHeroId: 'src-a', toHeroId: null },
      ],
    });
    expect(planActions(stripOnly, [EMBER], HEROES, STRINGS.en, 'en')).toEqual({ rows: [], moves: 1, resets: 0 });

    const movedAcross = plan({
      moveList: [
        { phase: 'unequip', itemId: 'x', defId: 'ember_calca', slot: 'calca', fromHeroId: 'src-a', toHeroId: null },
        { phase: 'equip', itemId: 'x', defId: 'ember_calca', slot: 'calca', fromHeroId: 'src-a', toHeroId: 'src-b' },
      ],
    });
    const counted = planActions(movedAcross, [EMBER], HEROES, STRINGS.en, 'en');
    expect(counted.moves).toBe(1);
    expect(counted.rows).toHaveLength(1);
    expect(counted.rows[0]?.kind).toBe('move');
  });

  it("gain is the waterfall's percent and zero when the current DPS is zero", () => {
    expect(gainPct(plan({ currentDps: 100, planDps: 112 }))).toBe(12);
    expect(gainPct(plan({ currentDps: 200, planDps: 190 }))).toBe(-5);
    expect(gainPct(plan({ currentDps: 0, planDps: 112 }))).toBe(0);
  });

  it("the floor is the farm respec's worth-making percent under either objective", () => {
    expect(FARM_RESPEC_WORTH_MAKING_PCT).toBe(5);
    expect(belowFloor(plan({ currentDps: 1000, planDps: 1049 }))).toBe(true);
    expect(belowFloor(plan({ currentDps: 1000, planDps: 1050 }))).toBe(false);
    expect(belowFloor(plan({ currentDps: 1000, planDps: 1000 + FARM_RESPEC_WORTH_MAKING_PCT * 10 - 1 }))).toBe(true);
    expect(belowFloor(plan({ currentDps: 1000, planDps: 1000 + FARM_RESPEC_WORTH_MAKING_PCT * 10 }))).toBe(false);
    expect(belowFloor(plan({ currentDps: 0, planDps: 500 }))).toBe(true);
  });
});
