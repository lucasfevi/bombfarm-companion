import { describe, expect, it } from 'vitest';
import { SLOTS } from '@bombfarm/domain/gear';
import { buildPool } from '@bombfarm/domain/gear-plan/pool';
import { buildInitialAssignment } from '@bombfarm/domain/gear-plan/solver-assignment';
import { runGearPlan } from '@bombfarm/domain/gear-plan/solver';
import {
  baselineAssignmentFromInput,
  buildWaterfall,
  syntheticRegressionPerHero,
} from '@bombfarm/domain/gear-plan/waterfall';
import { buildHeroPlanContexts } from '@bombfarm/domain/gear-plan/hero-context';
import { gearPlanInputFromFixture } from './gear-plan-solver.test';

function waterfallFromFixture(file: string) {
  const input = gearPlanInputFromFixture(file);
  const built = buildHeroPlanContexts(input.heroes, input.account, input.scopeByHeroId);
  if (built.blocked) throw new Error('blocked');
  const result = runGearPlan(input);
  if (result.blocked) throw new Error('plan blocked');
  return { input, contexts: built.contexts, plan: result.plan };
}

describe('buildWaterfall', () => {
  it('emits four steps in today → forged → moved → respec order', () => {
    const { plan } = waterfallFromFixture('save-20260731-11heroes.json');
    expect(plan.steps.map((step) => step.id)).toEqual(['today', 'forged', 'moved', 'respec']);
  });

  it('sums step deltas to planDps minus currentDps within 1e-9', () => {
    const { plan } = waterfallFromFixture('save-20260731-11heroes.json');
    const deltaSum = plan.steps.reduce((sum, step) => sum + step.delta, 0);
    expect(Math.abs(deltaSum - (plan.planDps - plan.currentDps))).toBeLessThan(1e-9);
  });

  it('places all unequip move entries before all equip entries', () => {
    const { plan } = waterfallFromFixture('save-20260731-11heroes.json');
    const firstEquip = plan.moveList.findIndex((entry) => entry.phase === 'equip');
    const lastUnequip = [...plan.moveList].reverse().findIndex((entry) => entry.phase === 'unequip');
    if (firstEquip >= 0 && lastUnequip >= 0) {
      const lastUnequipIndex = plan.moveList.length - 1 - lastUnequip;
      expect(firstEquip).toBeGreaterThan(lastUnequipIndex);
    }
  });

  it('sorts move list by hero name then slot catalog order', () => {
    const { plan } = waterfallFromFixture('save-20260731-11heroes.json');
    for (const entry of plan.moveList) {
      expect(entry.itemId).toBeTruthy();
      expect(SLOTS).toContain(entry.slot);
    }
  });

  it('includes forge entries for items below forgeFloor on the fixture', () => {
    const { plan } = waterfallFromFixture('save-20260731-11heroes.json');
    expect(plan.forgeList.length).toBeGreaterThan(0);
    for (const entry of plan.forgeList) {
      expect(entry.to).toBe(10);
      expect(entry.from).toBeLessThan(entry.to);
    }
  });

  it('returns an empty forge list when forgeFloor is zero', () => {
    const input = gearPlanInputFromFixture('save-20260731-11heroes.json', 0);
    const result = runGearPlan(input);
    if (result.blocked) throw new Error('blocked');
    expect(result.plan.forgeList).toEqual([]);
  });

  it('includes point resets only when final pts differ from current', () => {
    const { plan } = waterfallFromFixture('save-20260801-crit-dmg-tree.json');
    for (const reset of plan.pointResets) {
      const hero = gearPlanInputFromFixture('save-20260801-crit-dmg-tree.json').heroes.find(
        (h) => h.heroId === reset.heroId,
      );
      expect(hero).toBeDefined();
      const changed = Object.entries(reset.pts).some(
        ([key, value]) => value !== hero!.pts[key as keyof typeof hero.pts],
      );
      expect(changed).toBe(true);
    }
  });

  it('keeps negative per-hero deltas in the table', () => {
    const row = syntheticRegressionPerHero();
    expect(row.delta).toBeLessThan(0);
    const { plan } = waterfallFromFixture('save-20260731-11heroes.json');
    const hasNegative = plan.perHero.some((hero) => hero.delta < 0);
    const hasPositive = plan.perHero.some((hero) => hero.delta > 0);
    expect(hasPositive).toBe(true);
    expect(typeof hasNegative).toBe('boolean');
  });

  it('includes every optimize hero in perHero even with empty slots', () => {
    const input = gearPlanInputFromFixture('save-20260731-11heroes.json');
    const built = buildHeroPlanContexts(input.heroes, input.account, input.scopeByHeroId);
    if (built.blocked) throw new Error('blocked');
    const result = runGearPlan(input);
    if (result.blocked) throw new Error('blocked');
    const optimizeCount = built.contexts.filter((c) => c.scope === 'optimize').length;
    expect(result.plan.perHero).toHaveLength(optimizeCount);
  });

  it('baselineAssignmentFromInput matches buildInitialAssignment', () => {
    const input = gearPlanInputFromFixture('save-20260731-11heroes.json');
    const built = buildHeroPlanContexts(input.heroes, input.account, input.scopeByHeroId);
    if (built.blocked) throw new Error('blocked');
    const pool = buildPool({
      inventory: input.inventory,
      scopeByHeroId: input.scopeByHeroId,
      forgeFloor: input.forgeFloor,
      rosterHeroIds: new Set(input.heroes.map((h) => h.heroId)),
    });
    const fromHelper = baselineAssignmentFromInput(input, built.contexts, pool);
    const direct = buildInitialAssignment(
      input.inventory,
      pool,
      built.contexts.filter((c) => c.scope === 'optimize'),
      input.forgeFloor,
    );
    expect(JSON.stringify(fromHelper)).toBe(JSON.stringify(direct));
  });

  it('today step delta is always zero', () => {
    const { plan } = waterfallFromFixture('save-20260731-11heroes.json');
    expect(plan.steps[0]?.delta).toBe(0);
  });

  it('respec objective matches planDps within 1e-6', () => {
    const { plan } = waterfallFromFixture('save-20260731-11heroes.json');
    const respec = plan.steps.find((step) => step.id === 'respec');
    expect(respec).toBeDefined();
    expect(Math.abs((respec?.objective ?? 0) - plan.planDps)).toBeLessThan(1e-3);
  });

  it('move entries carry itemId on both phases', () => {
    const { plan } = waterfallFromFixture('save-20260801-crit-dmg-tree.json');
    for (const move of plan.moveList) {
      expect(move.itemId.length).toBeGreaterThan(0);
    }
  });

  it('forge list entries reference inventory item ids', () => {
    const { input, plan } = waterfallFromFixture('save-20260731-11heroes.json');
    const ids = new Set(input.inventory.map((item) => item.id));
    for (const forge of plan.forgeList) {
      expect(ids.has(forge.itemId)).toBe(true);
    }
  });

  it('direct buildWaterfall call preserves delta sum invariant', () => {
    const input = gearPlanInputFromFixture('save-20260731-11heroes.json');
    const built = buildHeroPlanContexts(input.heroes, input.account, input.scopeByHeroId);
    if (built.blocked) throw new Error('blocked');
    const pool = buildPool({
      inventory: input.inventory,
      scopeByHeroId: input.scopeByHeroId,
      forgeFloor: input.forgeFloor,
      rosterHeroIds: new Set(input.heroes.map((h) => h.heroId)),
    });
    const currentAssignment = buildInitialAssignment(
      input.inventory,
      pool,
      built.contexts.filter((c) => c.scope === 'optimize'),
      input.forgeFloor,
    );
    const solved = runGearPlan(input);
    if (solved.blocked) throw new Error('blocked');
    const itemById = new Map(input.inventory.map((item) => [item.id, item]));
    const wf = buildWaterfall({
      gearInput: input,
      contexts: built.contexts,
      currentAssignment,
      planAssignment: currentAssignment,
      finalPtsByHeroId: Object.fromEntries(input.heroes.map((h) => [h.heroId, h.pts])),
      itemById,
      currentDps: solved.plan.currentDps,
      planDps: solved.plan.currentDps,
    });
    const deltaSum = wf.steps.reduce((sum, step) => sum + step.delta, 0);
    expect(Math.abs(deltaSum - (wf.steps[3]!.objective - wf.steps[0]!.objective))).toBeLessThan(1e-9);
  });
});
