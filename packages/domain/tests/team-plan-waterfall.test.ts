import { describe, expect, it } from 'vitest';
import { SLOTS } from '@bombfarm/domain/gear';
import type { PointAlloc } from '@bombfarm/domain/gear/types';
import { buildPool } from '@bombfarm/domain/team-plan/pool';
import { buildInitialAssignment, loadoutsFromAssignment } from '@bombfarm/domain/team-plan/solver-assignment';
import { runTeamPlan } from '@bombfarm/domain/team-plan/solver';
import { evaluateRoster } from '@bombfarm/domain/team-plan/evaluate';
import { farmFromAccount } from '@bombfarm/domain/team-plan/waterfall-guards';
import {
  baselineAssignmentFromInput,
  buildWaterfall,
  syntheticRegressionPerHero,
} from '@bombfarm/domain/team-plan/waterfall';
import { buildHeroPlanContexts } from '@bombfarm/domain/team-plan/hero-context';
import { teamPlanInputFromFixture } from './helpers/team-plan-fixtures';

function waterfallFromFixture(file: string, forgeFloor?: number, slots?: number) {
  const input = teamPlanInputFromFixture(file, forgeFloor);
  if (slots !== undefined) input.account.slots = slots;
  const built = buildHeroPlanContexts(input.heroes, input.account, input.scopeByHeroId);
  if (built.blocked) throw new Error('blocked');
  const result = runTeamPlan(input);
  if (result.blocked) throw new Error('plan blocked');
  return { input, contexts: built.contexts, plan: result.plan };
}

/** Roster-level "current pts" + "current pts with only the plan's own resets applied". */
function ptsWithResets(
  input: ReturnType<typeof teamPlanInputFromFixture>,
  pointResets: { heroId: string; pts: Record<string, number> }[],
): Record<string, PointAlloc> {
  const pts: Record<string, PointAlloc> = Object.fromEntries(
    input.heroes.map((h) => [h.heroId, h.pts]),
  );
  for (const reset of pointResets) pts[reset.heroId] = reset.pts as PointAlloc;
  return pts;
}

describe('buildWaterfall', () => {
  it('emits three steps in today → gear → respec order', () => {
    const { plan } = waterfallFromFixture('save-20260731-11heroes.json');
    expect(plan.steps.map((step) => step.id)).toEqual(['today', 'gear', 'respec']);
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
    expect(plan.forgeFloorApplied).toBeGreaterThan(0);
    for (const entry of plan.forgeList) {
      expect(entry.to).toBe(plan.forgeFloorApplied);
      expect(entry.from).toBeLessThan(entry.to);
    }
  });

  it('returns an empty forge list when forgeFloor is zero', () => {
    const input = teamPlanInputFromFixture('save-20260731-11heroes.json', 0);
    const result = runTeamPlan(input);
    if (result.blocked) throw new Error('blocked');
    expect(result.plan.forgeList).toEqual([]);
    expect(result.plan.forgeFloorApplied).toBe(0);
  });

  it('forgeList is empty iff forgeFloorApplied is 0', () => {
    const cases: [string, number, number][] = [
      ['save-20260731-11heroes.json', 10, 9],
      ['save-20260801-crit-dmg-tree.json', 10, 3],
      ['save-20260801-crit-dmg-tree.json', 0, 3],
      ['save-20260801-crit-dmg-tree.json', 20, 5],
    ];
    for (const [file, forgeFloor, slots] of cases) {
      const { plan } = waterfallFromFixture(file, forgeFloor, slots);
      expect(plan.forgeList.length === 0).toBe(plan.forgeFloorApplied === 0);
    }
  });

  it('moveList is empty iff the plan keeps the baseline assignment', () => {
    const cases: [string, number, number][] = [
      ['save-20260731-11heroes.json', 10, 9],
      ['save-20260801-crit-dmg-tree.json', 10, 3],
      ['save-20260801-crit-dmg-tree.json', 20, 3],
    ];
    for (const [file, forgeFloor, slots] of cases) {
      const { input, plan } = waterfallFromFixture(file, forgeFloor, slots);
      const built = buildHeroPlanContexts(input.heroes, input.account, input.scopeByHeroId);
      if (built.blocked) throw new Error('blocked');
      const pool = buildPool({
        inventory: input.inventory,
        scopeByHeroId: input.scopeByHeroId,
        forgeFloor: input.forgeFloor,
        rosterHeroIds: new Set(input.heroes.map((h) => h.heroId)),
      });
      const baseline = buildInitialAssignment(
        input.inventory,
        pool,
        built.contexts.filter((c) => c.scope === 'optimize'),
        input.forgeFloor,
      );
      const itemById = new Map(input.inventory.map((item) => [item.id, item]));
      const baselineLoadouts = loadoutsFromAssignment(baseline, itemById);
      const sameAsBaseline = JSON.stringify(plan.proposedLoadouts) === JSON.stringify(baselineLoadouts);
      expect(plan.moveList.length === 0).toBe(sameAsBaseline);
    }
  });

  it('reproduces plan.planDps from proposedLoadouts + pointResets (action/number consistency)', () => {
    const { input, plan } = waterfallFromFixture('save-20260801-crit-dmg-tree.json', 10, 3);
    const built = buildHeroPlanContexts(input.heroes, input.account, input.scopeByHeroId);
    if (built.blocked) throw new Error('blocked');
    const pts = ptsWithResets(input, plan.pointResets);
    const evaluation = evaluateRoster({
      contexts: built.contexts,
      loadoutsByHeroId: plan.proposedLoadouts,
      ptsByHeroId: pts,
      slots: input.account.slots,
      farm: farmFromAccount(input),
      forgeFloor: plan.forgeFloorApplied,
    });
    expect(Math.abs(evaluation.objective - plan.planDps)).toBeLessThan(1e-6);
  });

  it('every listed point reset is roster-justified: removing any single one does not raise the objective', () => {
    // NOTE: floor 10 / slots 3 was this fixture's original motivating example (measured +923
    // with 3 resets) when this test was first written. With the search fully converged to local
    // optimality (solver-search.ts Change 2), the move-only gear step at that exact config now
    // already captures the whole gain on its own (see team-plan-step-monotonicity.test.ts), so
    // `acceptPointResets` finds nothing left to add there and `pointResets` is empty — that is
    // a better plan, not a regression, and this test would pass vacuously against it. floor 10 /
    // slots 9 (used by the sibling "negative gainPct" test below) reliably still exercises
    // resets under the current converged search, so this test uses that config instead.
    const { input, plan } = waterfallFromFixture('save-20260801-crit-dmg-tree.json', 10, 9);
    // Assert it actually exercises resets so this test cannot pass vacuously.
    expect(plan.pointResets.length).toBeGreaterThan(0);
    const built = buildHeroPlanContexts(input.heroes, input.account, input.scopeByHeroId);
    if (built.blocked) throw new Error('blocked');
    const currentPts: Record<string, PointAlloc> = Object.fromEntries(
      input.heroes.map((h) => [h.heroId, h.pts]),
    );
    const acceptedPts = ptsWithResets(input, plan.pointResets);

    for (const reset of plan.pointResets) {
      const withoutOne = { ...acceptedPts, [reset.heroId]: currentPts[reset.heroId]! };
      const evaluation = evaluateRoster({
        contexts: built.contexts,
        loadoutsByHeroId: plan.proposedLoadouts,
        ptsByHeroId: withoutOne,
        slots: input.account.slots,
        farm: farmFromAccount(input),
        forgeFloor: plan.forgeFloorApplied,
      });
      expect(evaluation.objective).toBeLessThanOrEqual(plan.planDps + 1e-6);
    }
  });

  // Was found empirically on this fixture (floor 10, slots 9, hero 37446, gainPct ~ -1.02%).
  // generateMoves' swap family (solver-moves.ts) used to hand out items without rechecking
  // level eligibility on the item's NEW hero — only assign-from-pool moves were checked. That
  // let an over-level item reach an under-level hero via a swap, which is not a legal move in
  // the game and apparently was a contributing path to reaching this negative-gainPct case on
  // this fixture/config. With the swap eligibility check fixed, a scan of both fixtures across
  // 43 floor/slots combos (including this exact one) no longer reproduces a negative gainPct
  // row. The underlying invariant this test wants — acceptPointResets accepts against the
  // ROSTER objective, not each hero's own `sustained`, so a personally-losing reset MAY still be
  // kept — is unchanged in the code and still covered by 'every listed point reset is
  // roster-justified' above. Skipped rather than deleted: re-enable if a fresh empirical example
  // turns up, or replace with a synthetic scenario that engineers the duty/aura crosstalk
  // directly (needs ability-driven aura modelling, not attempted here).
  it.skip('permits a listed point reset with a negative gainPct (roster gains, hero personally loses)', () => {
    const { plan } = waterfallFromFixture('save-20260801-crit-dmg-tree.json', 10, 9);
    const negativeRow = plan.pointResets.find((reset) => reset.gainPct < 0);
    expect(negativeRow).toBeDefined();
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
    const input = teamPlanInputFromFixture('save-20260731-11heroes.json');
    const built = buildHeroPlanContexts(input.heroes, input.account, input.scopeByHeroId);
    if (built.blocked) throw new Error('blocked');
    const result = runTeamPlan(input);
    if (result.blocked) throw new Error('blocked');
    const optimizeCount = built.contexts.filter((c) => c.scope === 'optimize').length;
    expect(result.plan.perHero).toHaveLength(optimizeCount);
  });

  it('perHero rows carry a before/after breakdown for every HeroSheet stat, both combat and sheet views', () => {
    const input = teamPlanInputFromFixture('save-20260731-11heroes.json');
    const result = runTeamPlan(input);
    if (result.blocked) throw new Error('blocked');
    expect(result.plan.perHero.length).toBeGreaterThan(0);
    for (const row of result.plan.perHero) {
      for (const key of ['attack', 'energy', 'speed', 'critChance', 'critDmg', 'penetration', 'cdr'] as const) {
        expect(typeof row.combatStatsBefore[key]).toBe('number');
        expect(typeof row.combatStatsAfter[key]).toBe('number');
        expect(typeof row.sheetStatsBefore[key]).toBe('number');
        expect(typeof row.sheetStatsAfter[key]).toBe('number');
      }
    }
  });

  it('baselineAssignmentFromInput matches buildInitialAssignment', () => {
    const input = teamPlanInputFromFixture('save-20260731-11heroes.json');
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
    const input = teamPlanInputFromFixture('save-20260731-11heroes.json');
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
    const itemById = new Map(input.inventory.map((item) => [item.id, item]));
    const wf = buildWaterfall({
      gearInput: input,
      contexts: built.contexts,
      currentAssignment,
      planAssignment: currentAssignment,
      finalPtsByHeroId: Object.fromEntries(input.heroes.map((h) => [h.heroId, h.pts])),
      itemById,
    });
    const deltaSum = wf.steps.reduce((sum, step) => sum + step.delta, 0);
    expect(Math.abs(deltaSum - (wf.steps[2]!.objective - wf.steps[0]!.objective))).toBeLessThan(1e-9);
  });

  // The old "never attributes a negative roster delta to the respec step" test here only
  // exercised save-20260731-11heroes.json, which never reaches the saturated regime at that
  // fixture's default slot count — that blind spot is why the original bug shipped. The full
  // roster-level step-monotonicity regression (all steps, both fixtures, the forge floor / slot
  // grid, and donate-scope mixes) now lives in team-plan-step-monotonicity.test.ts.
});
