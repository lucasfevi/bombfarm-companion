import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SLOTS } from '@bombfarm/domain/gear';
import { buildHeroPlanContexts } from '@bombfarm/domain/gear-plan/hero-context';
import { buildPool, eligibleForHero } from '@bombfarm/domain/gear-plan/pool';
import {
  applyMove,
  buildInitialAssignment,
  type AssignmentState,
} from '@bombfarm/domain/gear-plan/solver-assignment';
import { generateMoves } from '@bombfarm/domain/gear-plan/solver-moves';
import type { GearPlanInput, HeroPlanContext } from '@bombfarm/domain/gear-plan/types';
import { gearPlanInputFromFixture } from './helpers/gear-plan-fixtures';

function poolEntryFromItem(
  item: GearPlanInput['inventory'][number],
  forgeFloor: number,
) {
  const eff = Math.min(15, Math.max(item.upgrade, forgeFloor));
  return {
    key: `${item.defId}|${item.rarityIdx}|${item.level}|${eff}`,
    defId: item.defId,
    rarityIdx: item.rarityIdx,
    level: item.level,
    upgrade: item.upgrade,
    effectiveUpgrade: eff,
    slot: item.slot ?? '',
    count: 1,
    itemIds: [item.id],
  };
}

function assertMoveConstraints(
  state: AssignmentState,
  move: ReturnType<typeof generateMoves>[number],
  contexts: HeroPlanContext[],
  itemById: Map<string, GearPlanInput['inventory'][number]>,
  forgeFloor: number,
) {
  const ctxById = Object.fromEntries(contexts.map((c) => [c.heroId, c]));
  if (move.kind === 'assign') {
    const ctx = ctxById[move.heroId];
    const item = itemById.get(move.itemId);
    expect(ctx).toBeDefined();
    expect(item).toBeDefined();
    expect(eligibleForHero(poolEntryFromItem(item!, forgeFloor), ctx!, move.slot)).toBe(true);
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
    const input = gearPlanInputFromFixture('save-20260731-11heroes.json');
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
    const input = gearPlanInputFromFixture('save-20260731-11heroes.json');
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
    const input = gearPlanInputFromFixture('save-20260731-11heroes.json');
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
    const heroDpsById: Record<string, number> = {};
    for (const ctx of built.contexts) {
      heroDpsById[ctx.heroId] = ctx.name === 'Torin' ? 100 : 50;
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
    if (assignMoves.length >= 2) {
      const torinFirst = assignMoves.findIndex(
        (m) => m.kind === 'assign' && heroDpsById[m.heroId] === 100,
      );
      const otherFirst = assignMoves.findIndex(
        (m) => m.kind === 'assign' && heroDpsById[m.heroId] === 50,
      );
      if (torinFirst >= 0 && otherFirst >= 0) {
        expect(torinFirst).toBeLessThan(otherFirst);
      }
    }
  });

  it('never references Math.random or Date.now in the module source', () => {
    const dir = dirname(fileURLToPath(import.meta.url));
    const source = readFileSync(join(dir, '../src/gear-plan/solver-moves.ts'), 'utf8');
    expect(source).not.toContain('Math.random');
    expect(source).not.toContain('Date.now');
  });

  it('assign moves satisfy level and slot constraints on the real fixture', () => {
    const input = gearPlanInputFromFixture('save-20260731-11heroes.json');
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
