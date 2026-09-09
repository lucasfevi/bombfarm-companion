import { describe, expect, it } from 'vitest';
import { defsForSlot, SLOTS } from '@bombfarm/domain/gear';
import { dominates, statsForEntry } from '@bombfarm/domain/team-plan/dominance';
import { generateMoves } from '@bombfarm/domain/team-plan/solver-moves';
import { polishDominatedPlacements } from '@bombfarm/domain/team-plan/waterfall-guards';
import type { AssignmentState } from '@bombfarm/domain/team-plan/solver-assignment';
import type { InventoryItem } from '@bombfarm/domain/inventory';
import type { HeroPlanContext, PoolEntry, TeamPlanInput } from '@bombfarm/domain/team-plan/types';

/**
 * Deliberately fixture-free. The whole team-plan group is held out of the capture regime today, so
 * a test written against `TEAM_PLAN_FIXTURE` would report green having executed nothing. Every
 * claim below is about the catalog and the rule, both of which are always available.
 */

function entryFor(defId: string, rarityIdx: number, level: number, upgrade: number, slot: string): PoolEntry {
  return {
    key: `${defId}|${rarityIdx}|${level}|${upgrade}`,
    defId,
    rarityIdx,
    level,
    upgrade,
    effectiveUpgrade: upgrade,
    slot,
    count: 1,
    itemIds: [],
  };
}

function statsOf(defId: string, rarityIdx: number, level: number, upgrade: number, slot = 'amuleto') {
  return statsForEntry(entryFor(defId, rarityIdx, level, upgrade, slot));
}

function heroCtx(heroId: string, level: number): HeroPlanContext {
  return {
    heroId,
    name: heroId,
    level,
    stars: 0,
    rarity: 'Raro',
    birth: {
      attack: 100,
      energy: 100,
      speed: 50,
      critChance: 10,
      critDmg: 50,
      penetration: 0,
      cdr: 0,
      luck: 0,
    },
    sheetOther: { speed: 0, critChanceFlat: 0, critDmgFlat: 0, penetration: 0, cdr: 0 },
    mods: {
      drainMult: 1,
      penetrationPp: 0,
      rangeCells: 0,
      dmgMult: 1,
      gateAttackMult: 1,
      sheetCritChanceFlat: 0,
      sheetPenetrationRaw: 0,
      sheetCritDmgFlat: 0,
    },
    treeSheet: { danoStatic: 1, energyPct: 0, speedPct: 0, critChancePct: 0, critDmgPct: 0, luckFlatPct: 0 },
    scope: 'optimize',
    abilities: {},
    pts: { attack: 0, energy: 0, speed: 0, critChance: 0, critDmg: 0, penetration: 0, cdr: 0, luck: 0 },
  };
}

function itemFor(id: string, defId: string, rarityIdx: number, level: number, upgrade: number, slot: string, equippedBy: string | null = null): InventoryItem {
  return {
    id,
    defId,
    rarityIdx,
    level,
    upgrade,
    slot,
    equipped: equippedBy != null,
    equippedBy,
    defResolved: true,
    marketBlocked: false,
  };
}

const CLAY_AMULET = { defId: 'clay_amuleto', level: 40 };
const COAL_AMULET = { defId: 'coal_amuleto', level: 30 };

describe('gear dominance reads the catalog, not the beta-era set rule', () => {
  it('every set in a slot rolls the same stats in the same order', () => {
    for (const slot of SLOTS) {
      const defs = defsForSlot(slot);
      expect(defs.length).toBeGreaterThan(1);
      const orders = new Set(defs.map((def) => def.valores.map((roll) => roll.stat).join('>')));
      expect(orders.size, `slot ${slot} rolls ${orders.size} distinct stat orders`).toBe(1);
    }
  });

  it('a Brass helm rolls Luck, so the counter-example the single-set rule rested on is gone', () => {
    const brass = defsForSlot('elmo').find((def) => def.id === 'brass_elmo');
    const dune = defsForSlot('elmo').find((def) => def.id === 'dune_elmo');
    expect(brass).toBeDefined();
    expect(dune).toBeDefined();
    expect(brass!.valores.map((roll) => roll.stat)).toEqual(dune!.valores.map((roll) => roll.stat));
    // Incomum onward takes the first two rolls, and Luck is the second on every helm.
    expect(brass!.valores.slice(0, 2).map((roll) => roll.stat)).toContain('sorte');
  });

  it('a clay amulet beats a coal amulet of the same rarity and forge, across sets', () => {
    const clay = statsOf(CLAY_AMULET.defId, 2, CLAY_AMULET.level, 12);
    const coal = statsOf(COAL_AMULET.defId, 2, COAL_AMULET.level, 12);
    expect(dominates(clay, coal)).toBe(true);
    expect(dominates(coal, clay)).toBe(false);
  });

  it('an epic clay amulet beats a rare coal amulet even unforged against a forged one', () => {
    const epicClay = statsOf(CLAY_AMULET.defId, 3, CLAY_AMULET.level, 12);
    const rareCoal = statsOf(COAL_AMULET.defId, 2, COAL_AMULET.level, 12);
    expect(dominates(epicClay, rareCoal)).toBe(true);
  });

  it('a higher rarity of the same piece still dominates, the rule that always held', () => {
    const epic = statsOf(CLAY_AMULET.defId, 3, CLAY_AMULET.level, 12);
    const rare = statsOf(CLAY_AMULET.defId, 2, CLAY_AMULET.level, 12);
    expect(dominates(epic, rare)).toBe(true);
    expect(dominates(rare, epic)).toBe(false);
  });

  it('identical rolls dominate neither way, so interchangeable pieces are not pruned as losers', () => {
    const left = statsOf(CLAY_AMULET.defId, 2, CLAY_AMULET.level, 12);
    const right = statsOf(CLAY_AMULET.defId, 2, CLAY_AMULET.level, 12);
    expect(dominates(left, right)).toBe(false);
    expect(dominates(right, left)).toBe(false);
  });

  it('an unresolved def compares as incomparable rather than as a dominated empty item', () => {
    const unknown = statsOf('not_a_real_def', 3, 40, 12);
    const clay = statsOf(CLAY_AMULET.defId, 2, CLAY_AMULET.level, 12);
    expect(dominates(clay, unknown)).toBe(true);
    expect(dominates(unknown, clay)).toBe(false);
  });
});

describe('generateMoves candidate pruning', () => {
  const clayId = 'clay-epic';
  const coalId = 'coal-rare';
  const itemById = new Map<string, InventoryItem>([
    [clayId, itemFor(clayId, CLAY_AMULET.defId, 3, CLAY_AMULET.level, 12, 'amuleto')],
    [coalId, itemFor(coalId, COAL_AMULET.defId, 2, COAL_AMULET.level, 12, 'amuleto')],
  ]);
  const emptySlots = () => Object.fromEntries(SLOTS.map((slot) => [slot, null]));

  it('does not offer the coal amulet to a hero who could equip the clay one instead', () => {
    const ctx = heroCtx('high', 90);
    const moves = generateMoves({
      contexts: [ctx],
      slots: { high: emptySlots() },
      pool: new Set([clayId, coalId]),
      itemById,
      heroDpsById: { high: 1 },
      forgeFloor: 12,
    });
    const offered = moves.filter((move) => move.kind === 'assign' && move.slot === 'amuleto');
    expect(offered.map((move) => (move.kind === 'assign' ? move.itemId : ''))).toEqual([clayId]);
  });

  it('still offers the coal amulet to a hero too low to equip the clay one', () => {
    // The clay piece is level 40; this hero is 35, so pruning it away would leave the slot empty.
    const ctx = heroCtx('low', 35);
    const moves = generateMoves({
      contexts: [ctx],
      slots: { low: emptySlots() },
      pool: new Set([clayId, coalId]),
      itemById,
      heroDpsById: { low: 1 },
      forgeFloor: 12,
    });
    const offered = moves.filter((move) => move.kind === 'assign' && move.slot === 'amuleto');
    expect(offered.map((move) => (move.kind === 'assign' ? move.itemId : ''))).toEqual([coalId]);
  });
});

describe('polishDominatedPlacements', () => {
  const clayId = 'clay-epic';
  const coalId = 'coal-rare';
  const wornId = 'coal-worn';
  const heroId = 'hero';

  const itemById = new Map<string, InventoryItem>([
    [clayId, itemFor(clayId, CLAY_AMULET.defId, 3, CLAY_AMULET.level, 12, 'amuleto')],
    [coalId, itemFor(coalId, COAL_AMULET.defId, 2, COAL_AMULET.level, 12, 'amuleto')],
    [wornId, itemFor(wornId, COAL_AMULET.defId, 2, COAL_AMULET.level, 12, 'amuleto', heroId)],
  ]);

  const contexts = [heroCtx(heroId, 90)];

  const gearInput = {
    heroes: [],
    inventory: [...itemById.values()],
    account: {
      treeSheet: { danoStatic: 1, energyPct: 0, speedPct: 0, critChancePct: 0, critDmgPct: 0, luckFlatPct: 0 },
      houseIdx: 0,
      houseLevel: 1,
      phase: 10,
      mitigationPct: 0,
      slots: 3,
      fieldSlots: 3,
      cycleSecs: null,
      cycleSecsHouseIdx: null,
      cycleSecsLevel: null,
      maxPhase: 100,
    },
    scopeByHeroId: { [heroId]: 'optimize' as const },
    forgeFloor: 12,
    objective: 'dps' as const,
    allowedChanges: 'both' as const,
    targetPhase: null,
  } as unknown as TeamPlanInput;

  const currentPts = { [heroId]: contexts[0]!.pts };

  function assignmentWith(amuleto: string | null, pool: string[]): AssignmentState {
    return {
      slots: { [heroId]: { ...Object.fromEntries(SLOTS.map((slot) => [slot, null])), amuleto } },
      pool: new Set(pool),
    };
  }

  it('hands over the dominating free piece on a slot the plan is already changing', () => {
    const baseline = assignmentWith(wornId, [clayId, coalId]);
    const plan = assignmentWith(coalId, [clayId, wornId]);

    const polished = polishDominatedPlacements({
      contexts,
      gearInput,
      itemById,
      baselineAssignment: baseline,
      planAssignment: plan,
      currentPts,
      floor: 12,
    });

    expect(polished.slots[heroId]?.amuleto).toBe(clayId);
    expect(polished.pool.has(coalId)).toBe(true);
  });

  it('leaves a slot the plan does not touch alone, so it never invents a chore', () => {
    // Same dominating clay amulet sitting free — but the plan keeps what the hero already wears,
    // and improving that would add an unequip/equip the search never asked for.
    const baseline = assignmentWith(wornId, [clayId, coalId]);
    const plan = assignmentWith(wornId, [clayId, coalId]);

    const polished = polishDominatedPlacements({
      contexts,
      gearInput,
      itemById,
      baselineAssignment: baseline,
      planAssignment: plan,
      currentPts,
      floor: 12,
    });

    expect(polished.slots[heroId]?.amuleto).toBe(wornId);
  });

  it('leaves a placement alone when nothing free dominates it', () => {
    const baseline = assignmentWith(coalId, [clayId, wornId]);
    const plan = assignmentWith(clayId, [coalId, wornId]);

    const polished = polishDominatedPlacements({
      contexts,
      gearInput,
      itemById,
      baselineAssignment: baseline,
      planAssignment: plan,
      currentPts,
      floor: 12,
    });

    expect(polished.slots[heroId]?.amuleto).toBe(clayId);
  });
});
