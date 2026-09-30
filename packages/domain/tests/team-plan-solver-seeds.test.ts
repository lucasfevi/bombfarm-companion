/**
 * The search's four starting assignments, driven directly on seeded synthetic rosters.
 *
 * Three of the four are greedy constructions the search then climbs away from, so what matters is
 * not which assignment each one picks but that all four hand the climb something legal: the same
 * items, on heroes allowed to wear them, without disturbing the baseline the waterfall later
 * measures "today" against.
 *
 * Each shape declares whether it carries a hero out of the search's scope, and a per-shape witness
 * checks that plus the two bag properties the legality clauses need — gear above every hero's
 * level, and something spare to place. Without those the clauses pass on rosters that cannot break
 * them.
 */
import { describe, expect, it } from 'vitest';
import { SLOTS } from '@bombfarm/domain/gear';
import type { InventoryItem } from '@bombfarm/domain/inventory';
import { zeroTeamBuffs } from '@bombfarm/domain/team-buffs';
import { buildHeroPlanContexts } from '@bombfarm/domain/team-plan/hero-context';
import { buildPool } from '@bombfarm/domain/team-plan/pool';
import { scoreHeroLoadout } from '@bombfarm/domain/team-plan/score';
import {
  buildInitialAssignment,
  heroLoadoutFromAssignment,
  type AssignmentState,
} from '@bombfarm/domain/team-plan/solver-assignment';
import { buildSeedAssignments } from '@bombfarm/domain/team-plan/solver-seeds';
import { farmFromAccount } from '@bombfarm/domain/team-plan/waterfall-guards';
import type {
  HeroPlanContext,
  HeroScore,
  RosterEvaluation,
  TeamPlanInput,
} from '@bombfarm/domain/team-plan/types';
import { syntheticTeamPlanInput, type SyntheticRosterOptions } from './helpers/synthetic-roster';

const SEED_NAMES = ['current', 'greedyHeroDps', 'greedySlotValue', 'bestItemFirst'] as const;

type RosterShape = {
  seed: number;
  options: SyntheticRosterOptions;
  reaches: { outOfScopeHero: boolean };
};

const ROSTERS: readonly RosterShape[] = [
  { seed: 3, options: { heroCount: 3, spareItemCount: 10 }, reaches: { outOfScopeHero: false } },
  {
    seed: 31,
    options: { heroCount: 4, spareItemCount: 14, forgeFloor: 15, outOfScope: 'leaveAlone' },
    reaches: { outOfScopeHero: true },
  },
  {
    seed: 314,
    options: { heroCount: 5, spareItemCount: 18, forgeFloor: 0, outOfScope: 'donate' },
    reaches: { outOfScopeHero: true },
  },
];

type Bench = {
  input: TeamPlanInput;
  contexts: HeroPlanContext[];
  itemById: Map<string, InventoryItem>;
  base: AssignmentState;
  evaluation: RosterEvaluation;
};

function benchFor(shape: RosterShape): Bench {
  return benchFromInput(syntheticTeamPlanInput(shape.seed, shape.options));
}

function benchFromInput(input: TeamPlanInput, sustainedByHeroId?: Record<string, number>): Bench {
  const built = buildHeroPlanContexts(input.heroes, input.account, input.scopeByHeroId);
  if (built.blocked) throw new Error(`blocked for ${built.heroNames.join(', ')}`);
  const contexts = built.contexts;
  const itemById = new Map(input.inventory.map((item) => [item.id, item]));
  const pool = buildPool({
    inventory: input.inventory,
    scopeByHeroId: input.scopeByHeroId,
    forgeFloor: input.forgeFloor,
    rosterHeroIds: new Set(input.heroes.map((hero) => hero.heroId)),
  });
  const base = buildInitialAssignment(
    input.inventory,
    pool,
    contexts.filter((ctx) => ctx.scope === 'optimize'),
    input.forgeFloor,
  );
  const farm = farmFromAccount(input);
  const perHero: Record<string, HeroScore> = {};
  const dutyByHeroId: Record<string, number> = {};
  for (const ctx of contexts) {
    const score = scoreHeroLoadout(
      ctx,
      heroLoadoutFromAssignment(base, ctx.heroId, itemById),
      ctx.pts,
      zeroTeamBuffs(),
      farm,
    );
    const sustained = sustainedByHeroId?.[ctx.heroId] ?? score.sustained;
    perHero[ctx.heroId] = { ...score, sustained };
    dutyByHeroId[ctx.heroId] = score.duty;
  }
  const evaluation: RosterEvaluation = {
    objective: 0,
    regime: 'underSaturated',
    sumDuty: 0,
    slots: input.account.fieldSlots,
    perHero,
    auras: zeroTeamBuffs(),
    entryPulseMult: 1,
    dutyByHeroId,
  };
  return { input, contexts, itemById, base, evaluation };
}

function seedsFor(bench: Bench) {
  return buildSeedAssignments(bench.base, bench.contexts, bench.input, bench.itemById, bench.evaluation);
}

type Placement = { itemId: string; heroId: string; slot: string };

function placements(state: AssignmentState): Placement[] {
  const out: Placement[] = [];
  for (const [heroId, heroSlots] of Object.entries(state.slots)) {
    for (const slot of SLOTS) {
      const itemId = heroSlots[slot];
      if (itemId) out.push({ itemId, heroId, slot });
    }
  }
  return out;
}

/** Every id the assignment holds, duplicates preserved, so a duplicate is visible as one. */
function heldIds(state: AssignmentState): string[] {
  return [...state.pool, ...placements(state).map((entry) => entry.itemId)];
}

function fingerprint(state: AssignmentState): string {
  const slots = Object.keys(state.slots)
    .sort()
    .map((heroId) => `${heroId}{${SLOTS.map((slot) => `${slot}:${state.slots[heroId]![slot] ?? ''}`).join(',')}}`)
    .join('|');
  return `${slots}#${[...state.pool].sort().join(',')}`;
}

function duplicates(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  const twice = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) twice.add(id);
    seen.add(id);
  }
  return [...twice].sort();
}

describe('buildSeedAssignments', () => {
  it('returns the four starting assignments in a fixed order, the roster as it stands first', () => {
    const seeds = seedsFor(benchFor(ROSTERS[0]!));
    expect(seeds.map((seed) => seed.name)).toEqual([...SEED_NAMES]);
  });

  it.each(ROSTERS)('seed $seed: supplies the bag and the scope mix the shape declares it covers', (shape) => {
    const bench = benchFor(shape);
    const { seed } = shape;
    const strongest = Math.max(...bench.contexts.map((ctx) => ctx.level));
    const weakest = Math.min(...bench.contexts.map((ctx) => ctx.level));
    const pooled = [...bench.base.pool].map((itemId) => bench.itemById.get(itemId)!);

    expect(pooled.map((item) => item.id), `seed ${seed}: nothing spare to place`).not.toEqual([]);
    expect(
      pooled.filter((item) => item.level > strongest).map((item) => item.id),
      `seed ${seed}: no pooled item is out of reach of every hero`,
    ).not.toEqual([]);
    expect(
      pooled.filter((item) => item.level > weakest && item.level <= strongest).map((item) => item.id),
      `seed ${seed}: no pooled item splits the roster by level`,
    ).not.toEqual([]);

    const outOfScope = bench.contexts.filter((ctx) => ctx.scope !== 'optimize').map((ctx) => ctx.heroId);
    expect(outOfScope.length > 0, `seed ${seed}: out-of-scope heroes ${outOfScope.join(', ')}`).toBe(
      shape.reaches.outOfScopeHero,
    );
    const gearable = new Set(Object.keys(bench.base.slots));
    expect(
      outOfScope.filter((heroId) => gearable.has(heroId)),
      `seed ${seed}: the baseline already gears a hero out of scope`,
    ).toEqual([]);
  });

  it.each(ROSTERS)('seed $seed: leaves the baseline assignment it was handed untouched', (shape) => {
    const bench = benchFor(shape);
    const before = fingerprint(bench.base);
    seedsFor(bench);
    expect(fingerprint(bench.base), `seed ${shape.seed}: the baseline moved under the caller`).toBe(before);
  });

  it.each(ROSTERS)('seed $seed: hands back a "current" the caller can mutate without touching the baseline', (shape) => {
    const bench = benchFor(shape);
    const { seed } = shape;
    const seeds = seedsFor(bench);
    const current = seeds.find((entry) => entry.name === 'current')!.assignment;
    expect(fingerprint(current), `seed ${seed}`).toBe(fingerprint(bench.base));
    const victim = Object.keys(current.slots)[0]!;
    current.slots[victim]![SLOTS[0]!] = 'tampered';
    current.pool.add('tampered');
    expect(bench.base.slots[victim]![SLOTS[0]!], `seed ${seed}`).not.toBe('tampered');
    expect(bench.base.pool.has('tampered'), `seed ${seed}`).toBe(false);
  });

  it.each(ROSTERS)('seed $seed: every starting assignment holds exactly the items the baseline held', (shape) => {
    const bench = benchFor(shape);
    const baseline = new Set(heldIds(bench.base));
    const offenders: string[] = [];
    for (const { name, assignment } of seedsFor(bench)) {
      const held = heldIds(assignment);
      for (const id of duplicates(held)) offenders.push(`${name}: ${id} held twice`);
      for (const id of held) if (!baseline.has(id)) offenders.push(`${name}: ${id} came from nowhere`);
      const heldSet = new Set(held);
      for (const id of baseline) if (!heldSet.has(id)) offenders.push(`${name}: ${id} lost`);
    }
    expect(offenders.sort(), `seed ${shape.seed}`).toEqual([]);
  });

  it.each(ROSTERS)('seed $seed: places nothing a hero cannot wear, and nothing on a hero out of scope', (shape) => {
    const bench = benchFor(shape);
    const inScope = new Set(Object.keys(bench.base.slots));
    const levelByHeroId = new Map(bench.contexts.map((ctx) => [ctx.heroId, ctx.level]));
    const offenders: string[] = [];
    let placed = 0;
    for (const { name, assignment } of seedsFor(bench)) {
      const geared = Object.keys(assignment.slots).filter((heroId) => !inScope.has(heroId));
      for (const heroId of geared) offenders.push(`${name}: ${heroId} is not in the search's scope`);
      for (const { itemId, heroId, slot } of placements(assignment)) {
        const item = bench.itemById.get(itemId);
        if (!item) {
          offenders.push(`${name}: ${itemId} is not an item of this inventory`);
          continue;
        }
        placed++;
        if (item.slot !== slot) offenders.push(`${name}: ${itemId} is a ${item.slot}, placed in ${slot}`);
        const level = levelByHeroId.get(heroId) ?? 0;
        if (item.level > level) {
          offenders.push(`${name}: ${itemId} at level ${item.level} on a level ${level} hero`);
        }
      }
    }
    expect(placed, `seed ${shape.seed}: no placement to check`).toBeGreaterThan(0);
    expect(offenders.sort(), `seed ${shape.seed}`).toEqual([]);
  });

  it.each(ROSTERS)('seed $seed: gives the climb at least one starting point that is not the roster as it stands', (shape) => {
    const bench = benchFor(shape);
    const baseline = fingerprint(bench.base);
    const moved = seedsFor(bench).filter((entry) => fingerprint(entry.assignment) !== baseline);
    expect(moved.map((entry) => entry.name), `seed ${shape.seed}`).not.toEqual([]);
  });

  it.each(ROSTERS)('seed $seed: builds the same four assignments every call', (shape) => {
    const bench = benchFor(shape);
    const first = seedsFor(bench).map((entry) => `${entry.name}=${fingerprint(entry.assignment)}`);
    const second = seedsFor(bench).map((entry) => `${entry.name}=${fingerprint(entry.assignment)}`);
    expect(second, `seed ${shape.seed}`).toEqual(first);
  });

  it.each(ROSTERS)('seed $seed: is insensitive to the order the heroes arrive in when their damage ties', (shape) => {
    const bench = benchFor(shape);
    const tied = Object.fromEntries(bench.contexts.map((ctx) => [ctx.heroId, 1]));
    const withTies = benchFromInput(bench.input, tied);
    const forward = seedsFor(withTies).map((entry) => `${entry.name}=${fingerprint(entry.assignment)}`);
    const reversed = seedsFor({ ...withTies, contexts: [...withTies.contexts].reverse() }).map(
      (entry) => `${entry.name}=${fingerprint(entry.assignment)}`,
    );
    expect(reversed, `seed ${shape.seed}`).toEqual(forward);
  });
});

describe('the roster table keeps covering every branch it is there for', () => {
  it('declares at least one shape with a hero out of scope and at least one with none', () => {
    const declaring = (predicate: (shape: RosterShape) => boolean) =>
      ROSTERS.filter(predicate).map((shape) => shape.seed);
    expect(declaring((shape) => shape.reaches.outOfScopeHero), 'a hero out of scope').not.toEqual([]);
    expect(declaring((shape) => !shape.reaches.outOfScopeHero), 'an all-optimize roster').not.toEqual([]);
    const scopes = ROSTERS.map((shape) => shape.options.outOfScope).filter(Boolean);
    expect([...new Set(scopes)].sort(), 'both out-of-scope states').toEqual(['donate', 'leaveAlone']);
  });
});

/**
 * Two bare heroes and a hand-built bag, so the claim is about which hero a named seed favours
 * rather than about anything a generated roster happened to contain.
 */
function twoHeroBench(sustainedByHeroId: Record<string, number>, spares: readonly InventoryItem[]): Bench {
  const input = syntheticTeamPlanInput(11, { heroCount: 2, spareItemCount: 1 });
  input.heroes = input.heroes.map((hero) => ({ ...hero, level: 50, loadout: {} }));
  input.inventory = [...spares];
  return benchFromInput(input, sustainedByHeroId);
}

function spare(id: string, defId: string, slot: string, level: number, rarityIdx: number, upgrade: number): InventoryItem {
  return {
    id,
    defId,
    rarityIdx,
    level,
    upgrade,
    slot,
    equipped: false,
    equippedBy: null,
    defResolved: true,
    marketBlocked: false,
  };
}

describe('the greedy starting assignments follow the roster damage ranking', () => {
  const only = [spare('lone', 'ember_arma', 'arma', 10, 2, 0)];

  it('gives the single spare to the hero with the higher sustained damage', () => {
    const bench = twoHeroBench({ 'hero-0': 10, 'hero-1': 1 }, only);
    const greedy = seedsFor(bench).find((entry) => entry.name === 'greedyHeroDps')!.assignment;
    expect(greedy.slots['hero-0']!.arma).toBe('lone');
    expect(greedy.slots['hero-1']!.arma).toBeNull();
  });

  it('follows the ranking rather than the roster order when the ranking is reversed', () => {
    const bench = twoHeroBench({ 'hero-0': 1, 'hero-1': 10 }, only);
    const greedy = seedsFor(bench).find((entry) => entry.name === 'greedyHeroDps')!.assignment;
    expect(greedy.slots['hero-1']!.arma).toBe('lone');
    expect(greedy.slots['hero-0']!.arma).toBeNull();
  });

  it('hands the stronger hero the heavier Dano roll when the slot has two candidates', () => {
    // `clay_arma` is a level-40 weapon at +10 against a level-10 `ember_arma` at +0 — the Dano
    // gap is an order of magnitude, so which item is "better" needs no arithmetic here.
    const heavy = spare('heavy', 'clay_arma', 'arma', 40, 5, 10);
    const light = spare('light', 'ember_arma', 'arma', 10, 0, 0);
    const bench = twoHeroBench({ 'hero-0': 10, 'hero-1': 1 }, [light, heavy]);
    const bySlotValue = seedsFor(bench).find((entry) => entry.name === 'greedySlotValue')!.assignment;
    expect(bySlotValue.slots['hero-0']!.arma).toBe('heavy');
    expect(bySlotValue.slots['hero-1']!.arma).toBe('light');
  });

  it('seats the best item on the strongest wearer and the next one down on the next hero, keeping neither in the bag', () => {
    const heavy = spare('heavy', 'clay_arma', 'arma', 40, 5, 10);
    const mid = spare('mid', 'clay_arma', 'arma', 40, 5, 0);
    const light = spare('light', 'ember_arma', 'arma', 10, 0, 0);
    const bench = twoHeroBench({ 'hero-0': 10, 'hero-1': 1 }, [light, mid, heavy]);
    const byBestItem = seedsFor(bench).find((entry) => entry.name === 'bestItemFirst')!.assignment;
    expect(byBestItem.slots['hero-0']!.arma).toBe('heavy');
    expect(byBestItem.slots['hero-1']!.arma).toBe('mid');
    expect([...byBestItem.pool].sort()).toEqual(['light']);
  });

  it('offers a starting assignment no weaker than the slot-value one when both fill the same slots', () => {
    const heavy = spare('heavy', 'clay_arma', 'arma', 40, 5, 10);
    const mid = spare('mid', 'clay_arma', 'arma', 40, 5, 0);
    const light = spare('light', 'ember_arma', 'arma', 10, 0, 0);
    const bench = twoHeroBench({ 'hero-0': 10, 'hero-1': 1 }, [light, mid, heavy]);
    const seeds = seedsFor(bench);
    const byBestItem = seeds.find((entry) => entry.name === 'bestItemFirst')!.assignment;
    const bySlotValue = seeds.find((entry) => entry.name === 'greedySlotValue')!.assignment;
    const disagreements: string[] = [];
    for (const heroId of Object.keys(bySlotValue.slots)) {
      const wanted = bySlotValue.slots[heroId]!.arma;
      const got = byBestItem.slots[heroId]!.arma;
      if (wanted !== got) disagreements.push(`${heroId}: slot value seats ${wanted}, best item first seats ${got}`);
    }
    expect(disagreements.sort()).toEqual([]);
  });

  it('leaves a spare no hero is high enough to wear in the bag, on every starting assignment', () => {
    const reachable = spare('reachable', 'ember_arma', 'arma', 10, 2, 0);
    const tooHigh = spare('too-high', 'glacier_arma', 'arma', 60, 5, 0);
    const bench = twoHeroBench({ 'hero-0': 10, 'hero-1': 1 }, [reachable, tooHigh]);
    const offenders: string[] = [];
    for (const { name, assignment } of seedsFor(bench)) {
      for (const { itemId, heroId } of placements(assignment)) {
        if (itemId === 'too-high') offenders.push(`${name}: placed on ${heroId}`);
      }
    }
    expect(offenders.sort()).toEqual([]);
  });
});
