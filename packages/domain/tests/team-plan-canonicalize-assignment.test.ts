import { describe, expect, it } from 'vitest';
import { SLOTS } from '@bombfarm/domain/gear';
import type { InventoryItem } from '@bombfarm/domain/inventory';
import { canonicalizeAssignment } from '@bombfarm/domain/team-plan/canonicalize-assignment';
import { evaluateRoster } from '@bombfarm/domain/team-plan/evaluate';
import { buildHeroPlanContexts } from '@bombfarm/domain/team-plan/hero-context';
import { buildPool } from '@bombfarm/domain/team-plan/pool';
import {
  cloneAssignment,
  loadoutsFromAssignment,
  type AssignmentState,
} from '@bombfarm/domain/team-plan/solver-assignment';
import {
  baselineAssignmentFromInput,
  buildForgeList,
  buildWaterfall,
} from '@bombfarm/domain/team-plan/waterfall';
import { farmFromAccount } from '@bombfarm/domain/team-plan/waterfall-guards';
import { teamPlanInputFromFixture } from './helpers/team-plan-fixtures';

function item(partial: Partial<InventoryItem> & Pick<InventoryItem, 'id'>): InventoryItem {
  return {
    defId: 'ember_arma',
    rarityIdx: 3,
    level: 10,
    upgrade: 12,
    slot: 'arma',
    equipped: false,
    equippedBy: null,
    defResolved: true,
    marketBlocked: false,
    ...partial,
  };
}

function emptySlots(): Record<string, string | null> {
  return Object.fromEntries(SLOTS.map((slot) => [slot, null]));
}

function heroSlots(equipped: Record<string, string>): Record<string, string | null> {
  return { ...emptySlots(), ...equipped };
}

function mapOf(items: InventoryItem[]): ReadonlyMap<string, InventoryItem> {
  return new Map(items.map((entry) => [entry.id, entry]));
}

/** Where every item id sits — the exact projection `buildMoveList` diffs to emit moves. */
function locations(state: AssignmentState): Record<string, string> {
  const out: Record<string, string> = {};
  for (const id of state.pool) out[id] = 'pool';
  for (const [heroId, slots] of Object.entries(state.slots)) {
    for (const slot of SLOTS) {
      const id = slots[slot];
      if (id) out[id] = `${heroId}|${slot}`;
    }
  }
  return out;
}

/** The moves `buildMoveList` would emit — a location differing between the two states. */
function movedItemIds(before: AssignmentState, after: AssignmentState): string[] {
  const from = locations(before);
  const to = locations(after);
  const ids = new Set([...Object.keys(from), ...Object.keys(to)]);
  return [...ids].filter((id) => (from[id] ?? 'pool') !== (to[id] ?? 'pool')).sort();
}

describe('canonicalizeAssignment', () => {
  it('cancels a swap of two byte-identical items (the dune_calca churn)', () => {
    // Bellatrix and Jon each wear their own copy of the same item; the solver, reasoning over pool
    // groups, proposed trading them. Rebinding within the group must restore the baseline exactly.
    const inventory = [
      item({ id: '2770977', equippedBy: 'bellatrix', equipped: true }),
      item({ id: '2734242', equippedBy: 'jon', equipped: true }),
    ];
    const baseline: AssignmentState = {
      slots: {
        bellatrix: heroSlots({ arma: '2770977' }),
        jon: heroSlots({ arma: '2734242' }),
      },
      pool: new Set(),
    };
    const planned: AssignmentState = {
      slots: {
        bellatrix: heroSlots({ arma: '2734242' }),
        jon: heroSlots({ arma: '2770977' }),
      },
      pool: new Set(),
    };

    const result = canonicalizeAssignment(planned, baseline, mapOf(inventory), 10);

    expect(movedItemIds(baseline, planned)).toEqual(['2734242', '2770977']);
    expect(movedItemIds(baseline, result)).toEqual([]);
    expect(locations(result)).toEqual(locations(baseline));
  });

  it('leaves the roster objective exactly unchanged', () => {
    // The two group members are stored at +0 and +12 with a forge floor of 12, so canonicalizing
    // genuinely rewrites which physical item each hero wears (their `upgrade` fields differ) —
    // yet both clamp to the same effective upgrade, so the objective must be bit-identical.
    // MP5 F1 (AD-068 class (b) — structural): re-pointed onto payload-20260812-8heroes.json.
    // The fixture only supplies two real hero contexts here; both inventory items (upgrade 0
    // and 12) are hand-constructed, not read from the corpus, so which file backs the heroes
    // does not change what this test discriminates.
    const input = teamPlanInputFromFixture('payload-20260812-8heroes.json', 12);
    const built = buildHeroPlanContexts(input.heroes, input.account, input.scopeByHeroId);
    if (built.blocked) throw new Error('fixture blocked');
    const contexts = built.contexts.filter((ctx) => ctx.scope === 'optimize').slice(0, 2);
    expect(contexts).toHaveLength(2);
    const [heroA, heroB] = contexts;

    const inventory = [
      item({ id: 'raw', upgrade: 0, equippedBy: heroA.heroId, equipped: true }),
      item({ id: 'forged', upgrade: 12, equippedBy: heroB.heroId, equipped: true }),
    ];
    const itemById = mapOf(inventory);
    const baseline: AssignmentState = {
      slots: {
        [heroA.heroId]: heroSlots({ arma: 'raw' }),
        [heroB.heroId]: heroSlots({ arma: 'forged' }),
      },
      pool: new Set(),
    };
    const planned: AssignmentState = {
      slots: {
        [heroA.heroId]: heroSlots({ arma: 'forged' }),
        [heroB.heroId]: heroSlots({ arma: 'raw' }),
      },
      pool: new Set(),
    };

    const result = canonicalizeAssignment(planned, baseline, itemById, 12);
    expect(locations(result)).not.toEqual(locations(planned));

    const ptsByHeroId = Object.fromEntries(contexts.map((ctx) => [ctx.heroId, ctx.pts]));
    const evaluateAssignment = (state: AssignmentState) =>
      evaluateRoster({
        contexts,
        loadoutsByHeroId: loadoutsFromAssignment(state, itemById),
        ptsByHeroId,
        slots: input.account.slots,
        farm: farmFromAccount(input),
        forgeFloor: 12,
      });

    expect(evaluateAssignment(result).objective).toBe(evaluateAssignment(planned).objective);
  });

  it('equips the already-forged member of a group, emptying the forge list', () => {
    // +0 and +12 share a pool key at a forge floor of 12, so the solver may have picked either.
    // Nothing sits at this destination in the baseline, so pass 1 has no say and pass 2's
    // preference decides: the higher stored upgrade is equipped, the item that would need forging
    // stays in the pool, and `buildForgeList` never lists pool items. (Had the baseline already
    // held the +0 copy here it would stay pinned — fewer moves wins over a shorter forge list.)
    const inventory = [
      item({ id: 'raw', upgrade: 0 }),
      item({ id: 'forged', upgrade: 12 }),
    ];
    const baseline: AssignmentState = {
      slots: { hero1: emptySlots() },
      pool: new Set(['raw', 'forged']),
    };
    const planned: AssignmentState = {
      slots: { hero1: heroSlots({ arma: 'raw' }) },
      pool: new Set(['forged']),
    };

    const result = canonicalizeAssignment(planned, baseline, mapOf(inventory), 12);

    expect(result.slots.hero1.arma).toBe('forged');
    expect([...result.pool]).toEqual(['raw']);
    expect(buildForgeList(inventory, 12, new Set(['hero1']), planned)).toEqual([
      { itemId: 'raw', defId: 'ember_arma', from: 0, to: 12 },
    ]);
    expect(buildForgeList(inventory, 12, new Set(['hero1']), result)).toEqual([]);
  });

  it('keeps a genuine upgrade — a different pool key is never rebound away', () => {
    const inventory = [
      item({ id: 'common', rarityIdx: 0, equippedBy: 'hero1', equipped: true }),
      item({ id: 'legendary', rarityIdx: 4, equippedBy: 'hero2', equipped: true }),
    ];
    const baseline: AssignmentState = {
      slots: {
        hero1: heroSlots({ arma: 'common' }),
        hero2: heroSlots({ arma: 'legendary' }),
      },
      pool: new Set(),
    };
    const planned: AssignmentState = {
      slots: {
        hero1: heroSlots({ arma: 'legendary' }),
        hero2: heroSlots({ arma: 'common' }),
      },
      pool: new Set(),
    };

    const result = canonicalizeAssignment(planned, baseline, mapOf(inventory), 10);

    expect(locations(result)).toEqual(locations(planned));
    expect(movedItemIds(baseline, result)).toEqual(['common', 'legendary']);
  });

  it('is insensitive to hero, slot and pool insertion order', () => {
    // Repeating the same call on the same object would pass for any deterministic function,
    // including the identity — the real hazard is `Map`/`Set`/`Object.keys` insertion order, which
    // is what decides which destination gets served first. Same content, opposite orders.
    const inventory = [
      item({ id: 'i1' }),
      item({ id: 'i2' }),
      item({ id: 'i3' }),
      // One group at a floor of 10, three distinct stored upgrades: which of these lands on which
      // hero is decided purely by iteration order unless the code pins it down.
      item({ id: 'i4', upgrade: 8 }),
      item({ id: 'i5', upgrade: 0 }),
      item({ id: 'i6', upgrade: 4 }),
    ];
    const baseline: AssignmentState = {
      slots: {
        hero1: heroSlots({ arma: 'i3' }),
        hero2: emptySlots(),
        hero3: emptySlots(),
      },
      pool: new Set(['i1', 'i2', 'i4', 'i5', 'i6']),
    };

    // Three destinations across two pool-key groups; only hero1's is a baseline fixed point, so
    // both later passes have ordering-sensitive work to do.
    const forward: AssignmentState = {
      slots: {
        hero1: heroSlots({ arma: 'i1' }),
        hero2: heroSlots({ arma: 'i4' }),
        hero3: heroSlots({ arma: 'i5' }),
      },
      pool: new Set(['i2', 'i3', 'i6']),
    };
    const reversedSlots = Object.fromEntries(
      Object.entries(forward.slots)
        .reverse()
        .map(([heroId, slots]) => [
          heroId,
          Object.fromEntries(Object.entries(slots).reverse()),
        ]),
    );
    const reversed: AssignmentState = {
      slots: reversedSlots,
      pool: new Set([...forward.pool].reverse()),
    };
    const reversedBaseline: AssignmentState = {
      slots: Object.fromEntries(Object.entries(baseline.slots).reverse()),
      pool: new Set([...baseline.pool].reverse()),
    };
    // The id map's own iteration order must not leak into the result either.
    const reversedItemById = mapOf([...inventory].reverse());

    expect(Object.keys(reversed.slots)).not.toEqual(Object.keys(forward.slots));
    expect([...reversed.pool]).not.toEqual([...forward.pool]);

    const first = canonicalizeAssignment(forward, baseline, mapOf(inventory), 10);
    const second = canonicalizeAssignment(reversed, reversedBaseline, reversedItemById, 10);

    expect(locations(second)).toEqual(locations(first));
    // hero1 already wears a group member in the baseline, so it stays put (pass 1). The other
    // group's two destinations go to its two highest stored upgrades, lowest hero id first, and
    // the copy that would still need forging is the one left in the pool.
    expect(locations(first)).toEqual({
      i3: 'hero1|arma',
      i4: 'hero2|arma',
      i6: 'hero3|arma',
      i1: 'pool',
      i2: 'pool',
      i5: 'pool',
    });
    // Neither input was mutated, so the comparison above is between two untouched plans.
    expect(locations(forward)).toEqual({
      i1: 'hero1|arma',
      i4: 'hero2|arma',
      i5: 'hero3|arma',
      i2: 'pool',
      i3: 'pool',
      i6: 'pool',
    });
  });

  it('conserves every item id — none duplicated, none lost', () => {
    const inventory = [
      item({ id: 'a1' }),
      item({ id: 'a2' }),
      item({ id: 'a3', upgrade: 0 }),
      item({ id: 'a4' }),
      item({ id: 'b1', defId: 'ember_elmo', slot: 'elmo' }),
      item({ id: 'unknown-to-catalog', defId: 'ember_botas', slot: 'botas' }),
    ];
    const baseline: AssignmentState = {
      slots: {
        hero1: heroSlots({ arma: 'a1', elmo: 'b1' }),
        hero2: heroSlots({ arma: 'a4' }),
        hero3: emptySlots(),
      },
      pool: new Set(['a2', 'a3', 'unknown-to-catalog']),
    };
    const planned: AssignmentState = {
      slots: {
        hero1: heroSlots({ arma: 'a3', elmo: 'b1' }),
        hero2: heroSlots({ arma: 'a2' }),
        hero3: heroSlots({ arma: 'a1', botas: 'unknown-to-catalog' }),
      },
      pool: new Set(['a4']),
    };

    // The last item is deliberately absent from the id map (unresolvable), which must not lose it.
    const partialMap = mapOf(inventory.filter((entry) => entry.id !== 'unknown-to-catalog'));
    const result = canonicalizeAssignment(planned, baseline, partialMap, 10);

    const plannedIds = Object.keys(locations(planned)).sort();
    const resultIds = Object.keys(locations(result)).sort();
    expect(resultIds).toEqual(plannedIds);

    const placements = [
      ...result.pool,
      ...Object.values(result.slots).flatMap((slots) =>
        SLOTS.map((slot) => slots[slot]).filter((id): id is string => Boolean(id)),
      ),
    ];
    expect(new Set(placements).size).toBe(placements.length);
    // Same three arma destinations as `planned`, but filled from the groups by the rules above.
    // `a3` is stored at +0, so at a forge floor of 10 it keys apart from the +12 trio and is the
    // only member of its own group — it keeps hero1's slot.
    expect(result.slots.hero1.arma).toBe('a3');
    expect(result.slots.hero2.arma).toBe('a4');
    expect(result.slots.hero3.arma).toBe('a1');
    expect([...result.pool]).toEqual(['a2']);
    expect(result.slots.hero3.botas).toBe('unknown-to-catalog');
  });
});

/**
 * `buildWaterfall` canonicalizes at `candidate.floor` — the floor the WINNING candidate is
 * actually scored at — and NOT at `gearInput.forgeFloor`. The two differ exactly when a no-forge
 * candidate wins (`none` / `movesOnly`, floor 0) while the input asked for a floor above 0, and
 * grouping at the asked-for floor would then merge items the objective still tells apart, silently
 * rewriting the plan into something worth less than the DPS it reports.
 *
 * The scenario below is built to make that difference observable rather than theoretical.
 */
describe('buildWaterfall canonicalizes at the applied floor', () => {
  /**
   * One hero wears a `+0` copy; an otherwise identical `+10` copy waits in the pool, and the plan
   * equips it. Every other item is at `+12`, so forging is worth exactly as much as the move and
   * no more — the two candidates tie on objective and the forge candidates lose the chore
   * tie-break (extra `+0` ballast in the pool inflates their forge count), so `movesOnly` wins at
   * floor 0. At floor 0 the two copies key apart and the upgrade stands. At the asked-for floor 10
   * they collapse into one group, pass 1 pins the `+0` copy back onto the hero, and the plan
   * silently reverts while still reporting the improved objective.
   */
  function forgeFloorMismatchInput() {
    // MP5 F1 (AD-068 class (b) — structural): re-pointed onto payload-20260812-8heroes.json.
    // Every item's upgrade is overwritten below (forged to +12, then worn/spare/ballast are
    // hand-constructed at +0/+10/+0) — the fixture supplies only real heroes and one real
    // equipped item identity to build from, not any of the asserted upgrade values.
    const base = teamPlanInputFromFixture('payload-20260812-8heroes.json', 10);
    const rosterHeroIds = new Set(base.heroes.map((hero) => hero.heroId));
    // Forge everything to +12 so the ONLY sub-floor items in play are the ones added below.
    const forged = base.inventory.map((entry) => ({
      ...entry,
      upgrade: Math.max(entry.upgrade, 12),
    }));
    const target = forged
      .filter((entry) => entry.equippedBy && rosterHeroIds.has(entry.equippedBy))
      .filter((entry) => entry.slot && entry.defResolved && !entry.marketBlocked)
      .sort((left, right) => left.id.localeCompare(right.id))[0];
    const worn = { ...target, upgrade: 0 };
    // `+10` sits exactly ON the floor: same pool key as `worn` at floor 10, a different one at
    // floor 0, and never itself a forge chore.
    const spare = { ...target, id: `${target.id}-spare`, upgrade: 10, equipped: false, equippedBy: null };
    const ballast = [1, 2].map((n) => ({
      ...target,
      id: `ballast-${n}`,
      defId: 'ember_arma',
      rarityIdx: 0,
      level: 10,
      slot: 'arma',
      upgrade: 0,
      equipped: false,
      equippedBy: null,
    }));

    const input = {
      ...base,
      inventory: [...forged.map((entry) => (entry.id === target.id ? worn : entry)), spare, ...ballast],
      // More slots than heroes keeps the roster under-saturated, where the objective is a plain sum
      // of sustained DPS and therefore monotone in upgrade — that is what makes the tie exact.
      account: { ...base.account, slots: base.heroes.length + 1 },
    };
    return { input, worn, spare };
  }

  it('keeps the upgrade and reports an objective the proposed loadouts reproduce', () => {
    const { input, worn, spare } = forgeFloorMismatchInput();
    const built = buildHeroPlanContexts(input.heroes, input.account, input.scopeByHeroId);
    if (built.blocked) throw new Error('fixture blocked');
    const contexts = built.contexts;
    const itemById = new Map(input.inventory.map((entry) => [entry.id, entry]));
    const pool = buildPool({
      inventory: input.inventory,
      scopeByHeroId: input.scopeByHeroId,
      forgeFloor: input.forgeFloor,
      rosterHeroIds: new Set(input.heroes.map((hero) => hero.heroId)),
    });
    const baseline = baselineAssignmentFromInput(input, contexts, pool);
    const heroId = worn.equippedBy as string;
    const slot = worn.slot as string;
    expect(baseline.slots[heroId][slot]).toBe(worn.id);

    const planned = cloneAssignment(baseline);
    planned.slots[heroId][slot] = spare.id;
    planned.pool.delete(spare.id);
    planned.pool.add(worn.id);

    const ptsByHeroId = Object.fromEntries(input.heroes.map((hero) => [hero.heroId, hero.pts]));
    const result = buildWaterfall({
      gearInput: input,
      contexts,
      currentAssignment: baseline,
      planAssignment: planned,
      finalPtsByHeroId: ptsByHeroId,
      itemById,
    });

    // The winner is a no-forge candidate, so `candidate.floor` (0) and `gearInput.forgeFloor` (10)
    // disagree — this is the only situation in which the call-site floor is observable at all.
    expect(result.forgeFloorApplied).toBe(0);
    expect(input.forgeFloor).toBe(10);

    // The plan must be worth what it says it is: re-evaluating the assignment it actually ships,
    // at the floor it actually applied, has to land on the reported gear objective. Canonicalizing
    // at `gearInput.forgeFloor` instead reverts the upgrade, and this is where that shows up.
    const reproduced = evaluateRoster({
      contexts,
      loadoutsByHeroId: loadoutsFromAssignment(result.assignment, itemById),
      ptsByHeroId,
      slots: input.account.slots,
      farm: farmFromAccount(input),
      forgeFloor: result.forgeFloorApplied,
    });
    expect(reproduced.objective).toBe(result.steps[1].objective);
    expect(result.steps[1].delta).toBeGreaterThan(0);

    // Same failure seen structurally: the upgrade survives and both legs of the move are listed.
    expect(result.assignment.slots[heroId][slot]).toBe(spare.id);
    expect(result.moveList.map((move) => move.itemId).sort()).toEqual(
      [spare.id, worn.id].sort(),
    );
  });
});
