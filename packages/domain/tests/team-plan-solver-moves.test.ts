import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SLOTS } from '@bombfarm/domain/gear';
import { buildHeroPlanContexts } from '@bombfarm/domain/team-plan/hero-context';
import { buildPool, eligibleForHero, poolEntryForItem } from '@bombfarm/domain/team-plan/pool';
import {
  applyMove,
  buildInitialAssignment,
  type AssignmentState,
} from '@bombfarm/domain/team-plan/solver-assignment';
import { generateMoves } from '@bombfarm/domain/team-plan/solver-moves';
import type { TeamPlanInput, HeroPlanContext } from '@bombfarm/domain/team-plan/types';
import { teamPlanInputFromFixture } from './helpers/team-plan-fixtures';

function assertMoveConstraints(
  state: AssignmentState,
  move: ReturnType<typeof generateMoves>[number],
  contexts: HeroPlanContext[],
  itemById: Map<string, TeamPlanInput['inventory'][number]>,
  forgeFloor: number,
) {
  const ctxById = Object.fromEntries(contexts.map((c) => [c.heroId, c]));
  if (move.kind === 'assign') {
    const ctx = ctxById[move.heroId];
    const item = itemById.get(move.itemId);
    expect(ctx).toBeDefined();
    expect(item).toBeDefined();
    expect(eligibleForHero(poolEntryForItem(item!, forgeFloor), ctx!, move.slot)).toBe(true);
    expect(state.pool.has(move.itemId)).toBe(true);
  }
  if (move.kind === 'unassign') {
    expect(state.slots[move.heroId]?.[move.slot]).toBe(move.itemId);
  }
  if (move.kind === 'swap') {
    expect(state.slots[move.heroA]?.[move.slot]).toBe(move.itemA);
    expect(state.slots[move.heroB]?.[move.slot]).toBe(move.itemB);
  }
}

describe('generateMoves', () => {
  it('includes assign, swap, and unassign families on a real fixture', () => {
    const input = teamPlanInputFromFixture('payload-20260812-8heroes.json');
    const built = buildHeroPlanContexts(input.heroes, input.account, input.scopeByHeroId);
    expect(built.blocked).toBe(false);
    if (built.blocked) return;
    const rosterIds = new Set(input.heroes.map((h) => h.heroId));
    const pool = buildPool({
      inventory: input.inventory,
      scopeByHeroId: input.scopeByHeroId,
      forgeFloor: input.forgeFloor,
      rosterHeroIds: rosterIds,
    });
    const assignment = buildInitialAssignment(
      input.inventory,
      pool,
      built.contexts.filter((c) => c.scope === 'optimize'),
      input.forgeFloor,
    );
    const itemById = new Map(input.inventory.map((item) => [item.id, item]));
    const moves = generateMoves({
      contexts: built.contexts,
      slots: assignment.slots,
      pool: assignment.pool,
      itemById,
      heroDpsById: Object.fromEntries(built.contexts.map((c) => [c.heroId, 1])),
      forgeFloor: input.forgeFloor,
    });
    const kinds = new Set(moves.map((m) => m.kind));
    expect(kinds.has('assign')).toBe(true);
    expect(kinds.has('swap')).toBe(true);
    expect(kinds.has('unassign')).toBe(true);
  });

  it('produces identical move arrays on repeated calls', () => {
    const input = teamPlanInputFromFixture('payload-20260812-8heroes.json');
    const built = buildHeroPlanContexts(input.heroes, input.account, input.scopeByHeroId);
    if (built.blocked) throw new Error('blocked');
    const rosterIds = new Set(input.heroes.map((h) => h.heroId));
    const pool = buildPool({
      inventory: input.inventory,
      scopeByHeroId: input.scopeByHeroId,
      forgeFloor: input.forgeFloor,
      rosterHeroIds: rosterIds,
    });
    const assignment = buildInitialAssignment(
      input.inventory,
      pool,
      built.contexts.filter((c) => c.scope === 'optimize'),
      input.forgeFloor,
    );
    const itemById = new Map(input.inventory.map((item) => [item.id, item]));
    const heroDps = Object.fromEntries(built.contexts.map((c) => [c.heroId, c.level]));
    const params = {
      contexts: built.contexts,
      slots: assignment.slots,
      pool: assignment.pool,
      itemById,
      heroDpsById: heroDps,
      forgeFloor: input.forgeFloor,
    };
    const first = generateMoves(params);
    const second = generateMoves(params);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it('orders moves by heroDps desc then heroId asc then slot then itemId', () => {
    // MP5 F1 (AD-068 class (b) — structural, RECORDED FIX): the deleted fixture's hero name
    // 'Torin' was hardcoded to receive the elevated heroDps that makes this ordering
    // discriminate. No corpus hero is named Torin, and the original `if (torinFirst >= 0 &&
    // otherFirst >= 0)` guard would have silently made the inner assertion never run against
    // the new corpus (findIndex returns -1 for both sides) — a genuine vacuous-assertion risk
    // caught by T5's inversion check, not a pre-existing bug shipped as-is. Fixed by picking a
    // real, always-present hero (the first built context) instead of a name.
    const input = teamPlanInputFromFixture('payload-20260812-8heroes.json');
    const built = buildHeroPlanContexts(input.heroes, input.account, input.scopeByHeroId);
    if (built.blocked) throw new Error('blocked');
    const rosterIds = new Set(input.heroes.map((h) => h.heroId));
    const pool = buildPool({
      inventory: input.inventory,
      scopeByHeroId: input.scopeByHeroId,
      forgeFloor: input.forgeFloor,
      rosterHeroIds: rosterIds,
    });
    const assignment = buildInitialAssignment(
      input.inventory,
      pool,
      built.contexts.filter((c) => c.scope === 'optimize'),
      input.forgeFloor,
    );
    const itemById = new Map(input.inventory.map((item) => [item.id, item]));
    const highDpsHeroId = built.contexts[0]!.heroId;
    const heroDpsById: Record<string, number> = {};
    for (const ctx of built.contexts) {
      heroDpsById[ctx.heroId] = ctx.heroId === highDpsHeroId ? 100 : 50;
    }
    const moves = generateMoves({
      contexts: built.contexts,
      slots: assignment.slots,
      pool: assignment.pool,
      itemById,
      heroDpsById,
      forgeFloor: input.forgeFloor,
    });
    expect(moves.length).toBeGreaterThan(0);
    const assignMoves = moves.filter((m) => m.kind === 'assign');
    expect(assignMoves.length).toBeGreaterThanOrEqual(2);
    const highFirst = assignMoves.findIndex(
      (m) => m.kind === 'assign' && heroDpsById[m.heroId] === 100,
    );
    const otherFirst = assignMoves.findIndex(
      (m) => m.kind === 'assign' && heroDpsById[m.heroId] === 50,
    );
    expect(highFirst).toBeGreaterThanOrEqual(0);
    expect(otherFirst).toBeGreaterThanOrEqual(0);
    expect(highFirst).toBeLessThan(otherFirst);
  });

  it('never references Math.random or Date.now in the module source', () => {
    const dir = dirname(fileURLToPath(import.meta.url));
    const source = readFileSync(join(dir, '../src/team-plan/solver-moves.ts'), 'utf8');
    expect(source).not.toContain('Math.random');
    expect(source).not.toContain('Date.now');
  });

  it('assign moves satisfy level and slot constraints on the real fixture', () => {
    const input = teamPlanInputFromFixture('payload-20260812-8heroes.json');
    const built = buildHeroPlanContexts(input.heroes, input.account, input.scopeByHeroId);
    if (built.blocked) throw new Error('blocked');
    const rosterIds = new Set(input.heroes.map((h) => h.heroId));
    const pool = buildPool({
      inventory: input.inventory,
      scopeByHeroId: input.scopeByHeroId,
      forgeFloor: input.forgeFloor,
      rosterHeroIds: rosterIds,
    });
    const assignment = buildInitialAssignment(
      input.inventory,
      pool,
      built.contexts.filter((c) => c.scope === 'optimize'),
      input.forgeFloor,
    );
    const itemById = new Map(input.inventory.map((item) => [item.id, item]));
    const moves = generateMoves({
      contexts: built.contexts,
      slots: assignment.slots,
      pool: assignment.pool,
      itemById,
      heroDpsById: Object.fromEntries(built.contexts.map((c) => [c.heroId, 1])),
      forgeFloor: input.forgeFloor,
    });
    for (const move of moves) {
      assertMoveConstraints(assignment, move, built.contexts, itemById, input.forgeFloor);
    }
    expect(moves.length).toBeGreaterThan(0);
  });

  it('does not propose a swap that hands an over-level item to the lower-level hero', () => {
    // hero-low (L82) holds a level-70 ring; hero-high (L90) holds a level-90 amulet.
    // Swapping their `anel` slots would leave the level-90 amulet on hero-low — illegal.
    const contexts = [
      { heroId: 'hero-low', name: 'Low', level: 82, scope: 'optimize' },
      { heroId: 'hero-high', name: 'High', level: 90, scope: 'optimize' },
    ] as unknown as HeroPlanContext[];

    const itemById = new Map<string, TeamPlanInput['inventory'][number]>([
      [
        'ring-70',
        {
          id: 'ring-70',
          defId: 'ring_def',
          rarityIdx: 0,
          level: 70,
          upgrade: 0,
          slot: 'anel',
          equipped: true,
          equippedBy: 'hero-low',
          defResolved: true,
          marketBlocked: false,
        } as TeamPlanInput['inventory'][number],
      ],
      [
        'amulet-90',
        {
          id: 'amulet-90',
          defId: 'amulet_def',
          rarityIdx: 0,
          level: 90,
          upgrade: 0,
          slot: 'anel',
          equipped: true,
          equippedBy: 'hero-high',
          defResolved: true,
          marketBlocked: false,
        } as TeamPlanInput['inventory'][number],
      ],
    ]);

    const slots = {
      'hero-low': { ...Object.fromEntries(SLOTS.map((s) => [s, null])), anel: 'ring-70' },
      'hero-high': { ...Object.fromEntries(SLOTS.map((s) => [s, null])), anel: 'amulet-90' },
    };

    const moves = generateMoves({
      contexts,
      slots,
      pool: new Set(),
      itemById,
      heroDpsById: { 'hero-low': 1, 'hero-high': 1 },
      forgeFloor: 0,
    });

    const swaps = moves.filter((m) => m.kind === 'swap');
    expect(swaps).toHaveLength(0);
  });

  it('applyMove assign displaces the incumbent to the pool', () => {
    const state: AssignmentState = {
      slots: { h1: Object.fromEntries(SLOTS.map((s) => [s, s === 'arma' ? 'old' : null])) },
      pool: new Set(['new']),
    };
    const next = applyMove(state, { kind: 'assign', itemId: 'new', heroId: 'h1', slot: 'arma' });
    expect(next.slots.h1?.arma).toBe('new');
    expect(next.pool.has('old')).toBe(true);
    expect(next.pool.has('new')).toBe(false);
  });

  it('applyMove swap exchanges two slot occupants', () => {
    const state: AssignmentState = {
      slots: {
        h1: Object.fromEntries(SLOTS.map((s) => [s, s === 'arma' ? 'a' : null])),
        h2: Object.fromEntries(SLOTS.map((s) => [s, s === 'arma' ? 'b' : null])),
      },
      pool: new Set(),
    };
    const next = applyMove(state, {
      kind: 'swap',
      heroA: 'h1',
      heroB: 'h2',
      slot: 'arma',
      itemA: 'a',
      itemB: 'b',
    });
    expect(next.slots.h1?.arma).toBe('b');
    expect(next.slots.h2?.arma).toBe('a');
  });

  it('applyMove unassign returns an item to the pool', () => {
    const state: AssignmentState = {
      slots: { h1: Object.fromEntries(SLOTS.map((s) => [s, s === 'elmo' ? 'x' : null])) },
      pool: new Set(),
    };
    const next = applyMove(state, { kind: 'unassign', itemId: 'x', heroId: 'h1', slot: 'elmo' });
    expect(next.slots.h1?.elmo).toBeNull();
    expect(next.pool.has('x')).toBe(true);
  });
});
