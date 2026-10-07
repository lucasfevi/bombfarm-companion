/**
 * Claims about ANY account, driven on seeded synthetic rosters rather than a capture.
 *
 * The committed captures already pin what the solver does on two real accounts. What they cannot
 * say is that the guarantees survive a roster nobody has seen — so every assertion here is a
 * relation the plan owes its own input, computed from that input and the plan's own published
 * action lists, never by re-running the search. A failure names the seed; re-run it to reproduce.
 *
 * Each shape below declares which branches it is in the table to reach, and each is checked per
 * shape rather than summed across the table: a floor that only holds in aggregate goes green
 * while a shape that once covered the saturated regime, the empty forge list or an out-of-scope
 * hero quietly stops doing so.
 */
import { describe, expect, it } from 'vitest';
import { FORJA_MAX, SLOTS } from '@bombfarm/domain/gear';
import type { EquippedItem } from '@bombfarm/domain/gear/types';
import type { InventoryItem } from '@bombfarm/domain/inventory';
import { SHEET_KEYS } from '@bombfarm/domain/planner-constants';
import { runTeamPlan } from '@bombfarm/domain/team-plan/solver';
import type { TeamPlan, TeamPlanInput } from '@bombfarm/domain/team-plan/types';
import { syntheticTeamPlanInput, type SyntheticRosterOptions } from './helpers/synthetic-roster';

const MAX_EVALUATIONS = 1_500;

type RosterShape = {
  seed: number;
  options: SyntheticRosterOptions;
  reaches: {
    /** The plan orders forge work; `false` is the shape whose floor of 0 must empty the list. */
    forgeWork: boolean;
    saturated: boolean;
    outOfScopeHero: boolean;
  };
};

const ROSTERS: readonly RosterShape[] = [
  {
    seed: 1,
    options: { heroCount: 3, spareItemCount: 10, forgeFloor: 10, fieldSlots: 3, outOfScope: 'leaveAlone' },
    reaches: { forgeWork: true, saturated: false, outOfScopeHero: true },
  },
  {
    seed: 7,
    options: { heroCount: 4, spareItemCount: 12, forgeFloor: 0, fieldSlots: 4 },
    reaches: { forgeWork: false, saturated: false, outOfScopeHero: false },
  },
  {
    seed: 97,
    options: { heroCount: 5, spareItemCount: 16, forgeFloor: 15, fieldSlots: 5 },
    reaches: { forgeWork: true, saturated: false, outOfScopeHero: false },
  },
  {
    seed: 4242,
    options: { heroCount: 6, spareItemCount: 20, forgeFloor: 10, fieldSlots: 1 },
    reaches: { forgeWork: true, saturated: true, outOfScopeHero: false },
  },
  {
    seed: 987654,
    options: { heroCount: 5, spareItemCount: 18, forgeFloor: 12, fieldSlots: 1, outOfScope: 'donate' },
    reaches: { forgeWork: true, saturated: true, outOfScopeHero: true },
  },
];

type Case = { shape: RosterShape; input: TeamPlanInput; plan: TeamPlan };

const cases = new Map<number, Case>();

function caseFor(seed: number): Case {
  const cached = cases.get(seed);
  if (cached) return cached;
  const shape = ROSTERS.find((entry) => entry.seed === seed)!;
  const input = syntheticTeamPlanInput(shape.seed, shape.options);
  const result = runTeamPlan(input, { maxEvaluations: MAX_EVALUATIONS });
  if (result.blocked) {
    throw new Error(`seed ${seed}: plan blocked for ${result.heroNames.join(', ')}`);
  }
  const built: Case = { shape, input, plan: result.plan };
  cases.set(seed, built);
  return built;
}

function itemsById(input: TeamPlanInput): Map<string, InventoryItem> {
  return new Map(input.inventory.map((item) => [item.id, item]));
}

function scopeOf(input: TeamPlanInput, heroId: string): string {
  return input.scopeByHeroId[heroId] ?? 'optimize';
}

type Replay = {
  /** itemId → the hero wearing it once the move list is applied, or `null` for the bag. */
  placement: Map<string, string | null>;
  problems: string[];
};

/**
 * Where every item ends up, obtained by applying the plan's move list to the inventory the plan
 * was given — the player's own reading of the instructions, independent of the assignment the
 * search settled on. An unequip whose stated origin is not where the item actually sits is itself
 * a problem, so replaying is also how the stated origins are checked.
 */
function replayMoveList(input: TeamPlanInput, plan: TeamPlan): Replay {
  const placement = new Map<string, string | null>(
    input.inventory.map((item) => [item.id, item.equippedBy]),
  );
  const problems: string[] = [];
  for (const move of plan.moveList) {
    if (!placement.has(move.itemId)) {
      problems.push(`${move.phase} ${move.itemId}: not an item of this inventory`);
      continue;
    }
    if (move.phase === 'unequip') {
      const worn = placement.get(move.itemId) ?? null;
      if (worn !== move.fromHeroId) {
        problems.push(
          `unequip ${move.itemId}: claims ${move.fromHeroId ?? 'the bag'}, sits on ${worn ?? 'the bag'}`,
        );
      }
      placement.set(move.itemId, null);
      continue;
    }
    placement.set(move.itemId, move.toHeroId);
  }
  return { placement, problems };
}

function equippedMatches(item: InventoryItem, equipped: EquippedItem): boolean {
  return (
    item.defId === equipped.defId &&
    item.rarityIdx === equipped.rarityIdx &&
    item.level === equipped.level &&
    item.upgrade === equipped.upgrade
  );
}

function describeEquipped(equipped: EquippedItem | null | undefined): string {
  if (!equipped) return 'nothing';
  return `${equipped.defId} r${equipped.rarityIdx} nv${equipped.level} +${equipped.upgrade}`;
}

describe.each(ROSTERS)('runTeamPlan on synthetic roster seed $seed', ({ seed }) => {
  it('supplies the gear, the scope mix and the regime the shape declares it covers', () => {
    const { shape, input, plan } = caseFor(seed);
    const levels = input.heroes.map((hero) => hero.level);
    const weakest = Math.min(...levels);
    const strongest = Math.max(...levels);
    const bag = input.inventory.filter((item) => item.equippedBy === null);

    expect(bag.length, `seed ${seed}: nothing spare to place`).toBeGreaterThan(0);
    expect(
      bag.filter((item) => item.level > strongest).map((item) => item.id),
      `seed ${seed}: no item is out of reach of every hero`,
    ).not.toEqual([]);
    expect(
      bag.filter((item) => item.level > weakest && item.level <= strongest).map((item) => item.id),
      `seed ${seed}: no item splits the roster by level`,
    ).not.toEqual([]);
    expect(
      bag.filter((item) => item.marketBlocked).map((item) => item.id),
      `seed ${seed}: no market-blocked spare`,
    ).not.toEqual([]);
    expect(
      bag.filter((item) => !item.defResolved).map((item) => item.id),
      `seed ${seed}: no unresolvable spare`,
    ).not.toEqual([]);

    const outOfScope = input.heroes
      .map((hero) => hero.heroId)
      .filter((heroId) => scopeOf(input, heroId) !== 'optimize');
    expect(outOfScope.length > 0, `seed ${seed}: out-of-scope heroes ${outOfScope.join(', ')}`).toBe(
      shape.reaches.outOfScopeHero,
    );

    expect(
      plan.moveList.filter((move) => move.phase === 'equip').map((move) => move.itemId),
      `seed ${seed}: the plan equips nothing, so every equip clause is vacuous`,
    ).not.toEqual([]);
    expect(plan.pointResets.map((reset) => reset.heroId), `seed ${seed}: no point reset`).not.toEqual([]);
    expect(plan.forgeList.length > 0, `seed ${seed}: forge list has ${plan.forgeList.length} entries`).toBe(
      shape.reaches.forgeWork,
    );
    expect(plan.regime, `seed ${seed}`).toBe(shape.reaches.saturated ? 'saturated' : 'underSaturated');
  });

  // A sign claim, not a magnitude one: measured headroom on these shapes is roughly sevenfold, so
  // this catches a plan that goes backwards, never one that merely leaves value on the table.
  it('never returns a plan that scores below the roster it was given, and reports steps that add up', () => {
    const { plan } = caseFor(seed);
    const today = plan.steps.find((step) => step.id === 'today');
    const respec = plan.steps.find((step) => step.id === 'respec');
    expect(today && respec, `seed ${seed}: waterfall is missing a step`).toBeTruthy();
    expect(plan.planDps, `seed ${seed}`).toBeGreaterThanOrEqual(plan.currentDps - 1e-9);
    expect(respec!.objective, `seed ${seed}`).toBeGreaterThanOrEqual(today!.objective - 1e-9);
    expect(today!.delta, `seed ${seed}`).toBe(0);
    const summed = plan.steps.reduce((total, step) => total + step.delta, 0);
    expect(summed, `seed ${seed}`).toBeCloseTo(plan.planDps - plan.currentDps, 9);
  });

  it('names only items the inventory supplied, from origins the inventory agrees with', () => {
    const { input, plan } = caseFor(seed);
    const known = new Set(input.inventory.map((item) => item.id));
    const invented = [
      ...plan.moveList.map((move) => move.itemId),
      ...plan.forgeList.map((action) => action.itemId),
    ]
      .filter((itemId) => !known.has(itemId))
      .sort();
    expect(invented, `seed ${seed}: item ids no inventory supplied`).toEqual([]);
    expect(replayMoveList(input, plan).problems, `seed ${seed}`).toEqual([]);
  });

  it('equips no item onto two heroes and leaves no hero slot holding two items', () => {
    const { input, plan } = caseFor(seed);
    const byId = itemsById(input);
    const equippedTwice: string[] = [];
    const seenEquip = new Set<string>();
    for (const move of plan.moveList) {
      if (move.phase !== 'equip') continue;
      if (seenEquip.has(move.itemId)) equippedTwice.push(move.itemId);
      seenEquip.add(move.itemId);
    }
    expect(equippedTwice.sort(), `seed ${seed}: equipped more than once`).toEqual([]);

    const occupants = new Map<string, string[]>();
    for (const [itemId, heroId] of replayMoveList(input, plan).placement) {
      if (heroId === null) continue;
      const slot = byId.get(itemId)?.slot;
      if (!slot) continue;
      const key = `${heroId}/${slot}`;
      occupants.set(key, [...(occupants.get(key) ?? []), itemId]);
    }
    const contested = [...occupants]
      .filter(([, ids]) => ids.length > 1)
      .map(([key, ids]) => `${key}: ${[...ids].sort().join(', ')}`)
      .sort();
    expect(contested, `seed ${seed}: slots holding more than one item`).toEqual([]);
  });

  it('ends up where its own move list says it does, slot for slot', () => {
    const { input, plan } = caseFor(seed);
    const byId = itemsById(input);
    const { placement } = replayMoveList(input, plan);
    const wornAfter = new Map<string, string>();
    for (const [itemId, heroId] of placement) {
      const slot = byId.get(itemId)?.slot;
      if (heroId === null || !slot) continue;
      wornAfter.set(`${heroId}/${slot}`, itemId);
    }
    const disagreements: string[] = [];
    let compared = 0;
    for (const [heroId, loadout] of Object.entries(plan.proposedLoadouts)) {
      for (const slot of SLOTS) {
        const proposed = loadout[slot] ?? null;
        const itemId = wornAfter.get(`${heroId}/${slot}`);
        const item = itemId ? byId.get(itemId) : undefined;
        if (!item) {
          if (proposed) {
            disagreements.push(`${heroId}/${slot}: proposes ${describeEquipped(proposed)}, the moves leave it empty`);
          }
          continue;
        }
        compared++;
        if (!proposed) {
          disagreements.push(`${heroId}/${slot}: proposes nothing, the moves leave ${item.id} on it`);
          continue;
        }
        if (!equippedMatches(item, proposed)) {
          disagreements.push(
            `${heroId}/${slot}: proposes ${describeEquipped(proposed)}, the moves leave ${item.id} (${describeEquipped(
              { defId: item.defId, rarityIdx: item.rarityIdx, level: item.level, upgrade: item.upgrade },
            )})`,
          );
        }
      }
    }
    expect(compared, `seed ${seed}: no filled slot to compare`).toBeGreaterThan(0);
    expect(disagreements, `seed ${seed}: move list and proposed loadouts disagree`).toEqual([]);
  });

  it('draws every equip from the pool the input declares, at a level the wearer can carry', () => {
    const { input, plan } = caseFor(seed);
    const byId = itemsById(input);
    const levelByHeroId = new Map(input.heroes.map((hero) => [hero.heroId, hero.level]));
    const refused: string[] = [];
    let checked = 0;
    for (const move of plan.moveList) {
      if (move.phase !== 'equip' || move.toHeroId === null) continue;
      const item = byId.get(move.itemId);
      if (!item) continue;
      checked++;
      if (item.marketBlocked) refused.push(`${move.itemId}: market-blocked`);
      if (!item.defResolved) refused.push(`${move.itemId}: unresolved definition`);
      if (item.slot !== move.slot) {
        refused.push(`${move.itemId}: catalog slot ${item.slot}, moved as ${move.slot}`);
      }
      if (item.equippedBy && scopeOf(input, item.equippedBy) === 'leaveAlone') {
        refused.push(`${move.itemId}: taken off a hero the player left alone`);
      }
      const level = levelByHeroId.get(move.toHeroId);
      if (level === undefined) {
        refused.push(`${move.itemId}: equipped onto ${move.toHeroId}, who is not on the roster`);
      } else if (item.level > level) {
        refused.push(`${move.itemId}: level ${item.level} onto a level ${level} hero`);
      }
    }
    expect(checked, `seed ${seed}: no equip to check`).toBeGreaterThan(0);
    expect(refused.sort(), `seed ${seed}: equips the pool does not allow`).toEqual([]);
  });

  it('leaves in the bag every item no hero on the roster is high enough to wear', () => {
    const { input, plan } = caseFor(seed);
    const strongest = Math.max(...input.heroes.map((hero) => hero.level));
    const outOfReach = input.inventory.filter((item) => item.level > strongest);
    expect(outOfReach.map((item) => item.id), `seed ${seed}: nothing is out of reach`).not.toEqual([]);
    const { placement } = replayMoveList(input, plan);
    const worn = outOfReach
      .filter((item) => (placement.get(item.id) ?? null) !== null)
      .map((item) => `${item.id}: level ${item.level} worn by ${placement.get(item.id)}`)
      .sort();
    expect(worn, `seed ${seed}: items above every hero level, worn anyway`).toEqual([]);
  });

  it('proposes no forge below the floor it applied, and none on gear the plan leaves in the bag', () => {
    const { input, plan } = caseFor(seed);
    const byId = itemsById(input);
    const { placement } = replayMoveList(input, plan);
    expect([0, input.forgeFloor], `seed ${seed}: applied floor`).toContain(plan.forgeFloorApplied);
    const violations: string[] = [];
    for (const action of plan.forgeList) {
      const item = byId.get(action.itemId);
      if (!item) continue;
      if (action.to < plan.forgeFloorApplied) {
        violations.push(
          `${action.itemId}: forged to ${action.to}, below the applied floor ${plan.forgeFloorApplied}`,
        );
      }
      if (action.to > FORJA_MAX) violations.push(`${action.itemId}: forged to ${action.to}, past the cap`);
      if (action.from !== item.upgrade) {
        violations.push(`${action.itemId}: starts at ${action.from}, the inventory says ${item.upgrade}`);
      }
      if (action.from >= action.to) {
        violations.push(`${action.itemId}: ${action.from} → ${action.to} is not forge work`);
      }
      if ((placement.get(action.itemId) ?? null) === null) {
        violations.push(`${action.itemId}: forged but left in the bag`);
      }
    }
    expect(violations.sort(), `seed ${seed}: forge actions`).toEqual([]);
    if (plan.forgeFloorApplied === 0) expect(plan.forgeList, `seed ${seed}`).toEqual([]);
  });

  it('spends no more stat points than the hero level grants, and never a negative one', () => {
    const { input, plan } = caseFor(seed);
    const levelByHeroId = new Map(input.heroes.map((hero) => [hero.heroId, hero.level]));
    const overspent: string[] = [];
    for (const reset of plan.pointResets) {
      const level = levelByHeroId.get(reset.heroId);
      if (level === undefined) {
        overspent.push(`${reset.heroId}: not on the roster`);
        continue;
      }
      const spent = SHEET_KEYS.reduce((sum, key) => sum + (reset.pts[key] ?? 0), 0);
      if (spent > level) overspent.push(`${reset.heroId}: spends ${spent} of ${level}`);
      const negative = SHEET_KEYS.filter((key) => (reset.pts[key] ?? 0) < 0);
      if (negative.length > 0) overspent.push(`${reset.heroId}: negative on ${negative.join(', ')}`);
      const fractional = SHEET_KEYS.filter((key) => !Number.isInteger(reset.pts[key] ?? 0));
      if (fractional.length > 0) overspent.push(`${reset.heroId}: fractional on ${fractional.join(', ')}`);
      if (scopeOf(input, reset.heroId) !== 'optimize') {
        overspent.push(`${reset.heroId}: re-spent although the player put it out of scope`);
      }
    }
    expect(overspent.sort(), `seed ${seed}: point resets`).toEqual([]);
  });

  it('charges the run no evaluation past the cap it was given', () => {
    const { plan } = caseFor(seed);
    expect(plan.run.evaluations, `seed ${seed}`).toBeGreaterThan(0);
    expect(plan.run.evaluations, `seed ${seed}`).toBeLessThanOrEqual(MAX_EVALUATIONS);
  });
});

describe('the roster table keeps covering every branch it is there for', () => {
  it('declares at least one shape for each of forge work, an empty forge list, saturation and an out-of-scope hero', () => {
    const declaring = (predicate: (shape: RosterShape) => boolean) =>
      ROSTERS.filter(predicate).map((shape) => shape.seed);
    expect(declaring((shape) => shape.reaches.forgeWork), 'forge work').not.toEqual([]);
    expect(declaring((shape) => !shape.reaches.forgeWork), 'an empty forge list').not.toEqual([]);
    expect(declaring((shape) => shape.reaches.saturated), 'the saturated regime').not.toEqual([]);
    expect(declaring((shape) => !shape.reaches.saturated), 'the under-saturated regime').not.toEqual([]);
    expect(declaring((shape) => shape.reaches.outOfScopeHero), 'an out-of-scope hero').not.toEqual([]);
    expect(declaring((shape) => !shape.reaches.outOfScopeHero), 'an all-optimize roster').not.toEqual([]);
  });
});

describe('the evaluation budget', () => {
  const shape = ROSTERS[0]!;

  it('reports itself exhausted, and spends no evaluation past the cap, when the cap cannot converge', () => {
    const cap = 4;
    const result = runTeamPlan(syntheticTeamPlanInput(shape.seed, shape.options), { maxEvaluations: cap });
    if (result.blocked) throw new Error('plan blocked');
    expect(result.plan.run.budgetExhausted).toBe(true);
    expect(result.plan.run.evaluations).toBeGreaterThanOrEqual(cap);
    expect(result.plan.run.evaluations).toBeLessThanOrEqual(cap);
  });

  it('converges without reporting itself exhausted when the cap is generous', () => {
    const generous = 50_000;
    const result = runTeamPlan(syntheticTeamPlanInput(shape.seed, shape.options), {
      maxEvaluations: generous,
    });
    if (result.blocked) throw new Error('plan blocked');
    expect(result.plan.run.budgetExhausted).toBe(false);
    expect(result.plan.run.evaluations).toBeGreaterThan(0);
    expect(result.plan.run.evaluations).toBeLessThan(generous);
  });
});
