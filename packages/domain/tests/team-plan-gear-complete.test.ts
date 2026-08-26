import { describe, expect, it } from 'vitest';
import { SLOTS } from '@bombfarm/domain/gear';
import type { InventoryItem } from '@bombfarm/domain/inventory';
import { fillBareSlots, hasFillableBareSlot } from '@bombfarm/domain/team-plan/fill-bare-slots';
import { eligibleForHero, poolEntryForItem } from '@bombfarm/domain/team-plan/pool';
import { buildHeroPlanContexts } from '@bombfarm/domain/team-plan/hero-context';
import { runTeamPlan } from '@bombfarm/domain/team-plan/solver';
import type { AssignmentState } from '@bombfarm/domain/team-plan/solver-assignment';
import type { HeroPlanContext, TeamPlan, TeamPlanInput } from '@bombfarm/domain/team-plan/types';
import { teamPlanInputFromFixture } from './helpers/team-plan-fixtures';

/**
 * Every committed fixture sits in the UNDER-saturated regime, where the objective is a plain
 * `sum(sustained)` — monotone, so the unconstrained search already fills every bare slot and
 * these tests would pass with the rule deleted. The defect lives exclusively in the saturated
 * branch, so each case pins `fieldSlots` low enough to cross into it. Verified to matter: with
 * `fillBareSlots` disabled, `save-20260822-15heroes-tree-crit-dmg.json` at three field slots
 * strips fourteen slots to nothing, all of them `calca` / `elmo` / `bota`.
 */
const SATURATED_CASES = [
  ['save-20260818-12heroes.json', 3],
  ['save-20260822-15heroes-tree-crit-dmg.json', 3],
  ['save-20260823-13heroes-crit-points.json', 5],
] as const;

/** A field small enough that the roster contends for it — see {@link SATURATED_CASES}. */
function contendedInput(fixture: string, fieldSlots: number): TeamPlanInput {
  const input = teamPlanInputFromFixture(fixture);
  input.account = { ...input.account, fieldSlots };
  return input;
}

function planOf(input: TeamPlanInput): TeamPlan {
  const result = runTeamPlan(input);
  expect(result.blocked).toBe(false);
  if (result.blocked) throw new Error('expected a plan');
  return result.plan;
}

function contextsOf(input: TeamPlanInput): HeroPlanContext[] {
  const built = buildHeroPlanContexts(input.heroes, input.account, input.scopeByHeroId);
  if (built.blocked) throw new Error('expected contexts');
  return built.contexts;
}

/**
 * An equipped item is never worse than an empty slot in the game, so a plan must never tell a
 * player to strip a hero and bank the piece. The roster objective disagrees: in the saturated
 * regime it is a duty-weighted mean, so gear that buys uptime for a below-mean hero scores as a
 * loss and the unconstrained search banks it. These are the tests that hold the line.
 *
 * The line is "nothing wearable is left in the bag", NOT "no slot ever ends bare". Handing one
 * hero's helmet to a hero who does more with it is the entire point of a team plan, and the
 * donor legitimately ends bare when every remaining spare is above their level — which is
 * exactly what happens to the level-26 hero in `save-20260818-12heroes.json`, where the only
 * two spare helmets are level 30.
 */
describe('a plan never banks gear a hero could be wearing', () => {
  /** Reconstructs where the plan leaves every item: on a hero, or back in the bag. */
  function finalState(input: TeamPlanInput, plan: TeamPlan) {
    const contexts = contextsOf(input);
    const slots: AssignmentState['slots'] = {};
    for (const ctx of contexts) {
      slots[ctx.heroId] = Object.fromEntries(SLOTS.map((slot) => [slot, null]));
    }
    const equipped = new Set<string>();
    for (const move of plan.moveList) {
      if (move.phase === 'equip' && move.toHeroId) equipped.add(move.itemId);
    }
    const unequipped = new Set(
      plan.moveList.filter((move) => move.phase === 'unequip').map((move) => move.itemId),
    );
    for (const item of input.inventory) {
      if (item.equippedBy && !unequipped.has(item.id)) equipped.add(item.id);
    }
    for (const [heroId, loadout] of Object.entries(plan.proposedLoadouts)) {
      if (!slots[heroId]) continue;
      for (const slot of SLOTS) if (loadout[slot]) slots[heroId][slot] = 'taken';
    }
    const pool = new Set(
      input.inventory
        .filter((item) => item.defResolved && !item.marketBlocked && item.slot)
        .filter((item) => !equipped.has(item.id))
        .map((item) => item.id),
    );
    return {
      contexts,
      assignment: { slots, pool } satisfies AssignmentState,
      itemById: new Map(input.inventory.map((item) => [item.id, item])),
    };
  }

  it.each(SATURATED_CASES)(
    'leaves no wearable spare in the bag — %s @ %i slots',
    (fixture, fieldSlots) => {
      const input = contendedInput(fixture, fieldSlots);
      const plan = planOf(input);
      expect(plan.regime).toBe('saturated');
      const { contexts, assignment, itemById } = finalState(input, plan);
      expect(hasFillableBareSlot(assignment, contexts, itemById, input.forgeFloor)).toBe(false);
    },
  );

  it.each(SATURATED_CASES)(
    'empties a slot only when nothing left in the bag fits that hero — %s @ %i slots',
    (fixture, fieldSlots) => {
      const input = contendedInput(fixture, fieldSlots);
      const plan = planOf(input);
      const todayByHeroId = new Map(input.heroes.map((hero) => [hero.heroId, hero.loadout]));
      const { contexts, assignment, itemById } = finalState(input, plan);
      const ctxById = new Map(contexts.map((ctx) => [ctx.heroId, ctx]));

      const bankedAnyway: string[] = [];
      for (const [heroId, proposed] of Object.entries(plan.proposedLoadouts)) {
        const today = todayByHeroId.get(heroId);
        const ctx = ctxById.get(heroId);
        if (!today || !ctx) continue;
        for (const slot of SLOTS) {
          if (!today[slot] || proposed[slot]) continue;
          const wearable = [...assignment.pool].some((itemId) => {
            const item = itemById.get(itemId);
            return item ? eligibleForHero(poolEntryForItem(item, input.forgeFloor), ctx, slot) : false;
          });
          if (wearable) bankedAnyway.push(`${ctx.name} (${heroId}) ${slot}`);
        }
      }
      expect(bankedAnyway).toEqual([]);
    },
  );
});

describe('fillBareSlots', () => {
  const hero = (heroId: string, level: number): HeroPlanContext =>
    ({ heroId, name: heroId, level, scope: 'optimize' }) as unknown as HeroPlanContext;

  const item = (id: string, over: Partial<InventoryItem> = {}): InventoryItem => ({
    id,
    defId: 'coal_calca',
    rarityIdx: 2,
    level: 30,
    upgrade: 12,
    slot: 'calca',
    equipped: false,
    equippedBy: null,
    defResolved: true,
    marketBlocked: false,
    ...over,
  });

  const emptySlots = () => Object.fromEntries(SLOTS.map((slot) => [slot, null]));

  function setup(items: InventoryItem[], heroes: HeroPlanContext[]) {
    const assignment: AssignmentState = {
      slots: Object.fromEntries(heroes.map((h) => [h.heroId, emptySlots()])),
      pool: new Set(items.map((entry) => entry.id)),
    };
    return {
      assignment,
      itemById: new Map(items.map((entry) => [entry.id, entry])),
      baseline: { slots: assignment.slots, pool: new Set(assignment.pool) },
    };
  }

  it('fills a bare slot from the bag', () => {
    const heroes = [hero('a', 40)];
    const { assignment, itemById, baseline } = setup([item('i1')], heroes);
    const out = fillBareSlots({
      assignment,
      contexts: heroes,
      itemById,
      forgeFloor: 10,
      baseline,
      heroOrder: ['a'],
    });
    expect(out.slots.a.calca).toBe('i1');
    expect(out.pool.has('i1')).toBe(false);
  });

  it('will not hand a hero an item above their level', () => {
    const heroes = [hero('a', 29)];
    const { assignment, itemById, baseline } = setup([item('i1', { level: 30 })], heroes);
    const out = fillBareSlots({
      assignment,
      contexts: heroes,
      itemById,
      forgeFloor: 10,
      baseline,
      heroOrder: ['a'],
    });
    expect(out.slots.a.calca).toBeNull();
    expect(out.pool.has('i1')).toBe(true);
  });

  it('gives the better item to whoever picks first', () => {
    const heroes = [hero('a', 80), hero('b', 80)];
    const items = [item('low', { level: 30 }), item('high', { defId: 'iron_calca', level: 70 })];
    const { assignment, itemById, baseline } = setup(items, heroes);
    const out = fillBareSlots({
      assignment,
      contexts: heroes,
      itemById,
      forgeFloor: 10,
      baseline,
      heroOrder: ['b', 'a'],
    });
    expect(out.slots.b.calca).toBe('high');
    expect(out.slots.a.calca).toBe('low');
  });

  it('prefers the copy the hero is already wearing today, so no churn move is emitted', () => {
    const heroes = [hero('a', 40)];
    // Two interchangeable copies; `mine` is the one sitting in the baseline slot.
    const items = [item('aaa-other'), item('mine')];
    const { assignment, itemById } = setup(items, heroes);
    const baseline: AssignmentState = {
      slots: { a: { ...emptySlots(), calca: 'mine' } },
      pool: new Set(['aaa-other']),
    };
    const out = fillBareSlots({
      assignment,
      contexts: heroes,
      itemById,
      forgeFloor: 10,
      baseline,
      heroOrder: ['a'],
    });
    expect(out.slots.a.calca).toBe('mine');
  });

  it('does not touch a hero who is out of scope', () => {
    const benched = { ...hero('a', 40), scope: 'leaveAlone' } as HeroPlanContext;
    const { assignment, itemById, baseline } = setup([item('i1')], [benched]);
    const out = fillBareSlots({
      assignment,
      contexts: [benched],
      itemById,
      forgeFloor: 10,
      baseline,
      heroOrder: ['a'],
    });
    expect(out.slots.a.calca).toBeNull();
  });

  it('leaves the input assignment untouched', () => {
    const heroes = [hero('a', 40)];
    const { assignment, itemById, baseline } = setup([item('i1')], heroes);
    fillBareSlots({
      assignment,
      contexts: heroes,
      itemById,
      forgeFloor: 10,
      baseline,
      heroOrder: ['a'],
    });
    expect(assignment.slots.a.calca).toBeNull();
    expect(assignment.pool.has('i1')).toBe(true);
  });
});

describe('contested-field disclosure', () => {
  it('names the heroes whose uptime dilutes a full field', () => {
    const input = contendedInput('save-20260822-15heroes-tree-crit-dmg.json', 3);
    const plan = planOf(input);
    expect(plan.regime).toBe('saturated');
    const contention = plan.disclosures.fieldContention;
    expect(contention).not.toBeNull();
    if (!contention) return;
    expect(contention.sumDuty).toBeGreaterThanOrEqual(contention.slots);
    expect(contention.meanActiveDps).toBeGreaterThan(0);
    // Every named hero must really sit below the break-even the banner quotes.
    const activeByName = new Map(plan.perHero.map((row) => [row.heroName, row]));
    for (const name of contention.dilutingHeroNames) {
      expect(activeByName.has(name)).toBe(true);
    }
  });

  it('is null when the field is not contested', () => {
    const plan = planOf(teamPlanInputFromFixture('payload-20260812-8heroes.json'));
    expect(plan.regime).toBe('underSaturated');
    expect(plan.disclosures.fieldContention).toBeNull();
  });
});
