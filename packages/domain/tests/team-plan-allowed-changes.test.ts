/**
 * `TeamPlanInput.allowedChanges` — which kinds of change a plan may propose.
 *
 * The load-bearing assertion in this file is the pairing, not the emptiness: a control wired to
 * nothing still renders, still stores a value, and still round-trips through `TeamPlanInput`, and
 * an empty move list on its own is equally consistent with "the search had nothing to move". So
 * every restricted run is asserted against a `'both'` run over the SAME input that does produce
 * the chores the restricted one must not — an empty list only means something once the same
 * roster has been shown to fill it.
 *
 * Nothing here is regime-bound: every claim is about the search's own output shape, and a patch
 * that moves the game's numbers moves them on both sides of each comparison.
 */
import { describe, expect, it } from 'vitest';
import { runTeamPlan } from '@bombfarm/domain/team-plan';
import type { TeamPlan, TeamPlanInput } from '@bombfarm/domain/team-plan/types';
import { loadTeamPlanFarmFixture } from './helpers/team-plan-farm-fixtures';

/** 7 heroes, 40 items worn, 54 in the bag — enough gear for a plan to have real chores to skip. */
const CAPTURE = 'save-20260819-11882-7heroes.json';

/** Pinned so the farm objective reads one phase row instead of sweeping; feasible for this squad. */
const PHASE = 1;

/** Every item scores as if forged to +10, so an unrestricted plan has forge chores to list. */
const FORGE_FLOOR = 10;

function inputFor(): TeamPlanInput {
  return loadTeamPlanFarmFixture(CAPTURE, { forgeFloor: FORGE_FLOOR }).teamPlanInput;
}

function planFor(
  objective: 'dps' | 'farm',
  allowedChanges: TeamPlanInput['allowedChanges'],
): TeamPlan {
  const result = runTeamPlan({ ...inputFor(), objective, targetPhase: PHASE, allowedChanges });
  if (result.blocked) throw new Error(`plan blocked: ${result.heroNames.join(', ')}`);
  return result.plan;
}

function gearChoreCount(plan: TeamPlan): number {
  return plan.moveList.length + plan.forgeList.length;
}

describe.each(['dps', 'farm'] as const)('allowedChanges, scoring for %s', (objective) => {
  it('both proposes gear work AND point resets, so the restricted runs below mean something', () => {
    const plan = planFor(objective, 'both');
    expect(gearChoreCount(plan)).toBeGreaterThan(0);
    expect(plan.pointResets.length).toBeGreaterThan(0);
    expect(plan.allowedChanges).toBe('both');
  });

  it('points only returns no gear moves, no forges, and no forge floor', () => {
    const plan = planFor(objective, 'points');
    expect(plan.moveList).toEqual([]);
    expect(plan.forgeList).toEqual([]);
    // The floor is gear work the player has to go and do, so a points-only plan may not adopt one
    // even though the caller asked for +10.
    expect(plan.forgeFloorApplied).toBe(0);
    expect(plan.allowedChanges).toBe('points');
  });

  it('points only still re-spends points', () => {
    expect(planFor(objective, 'points').pointResets.length).toBeGreaterThan(0);
  });

  it('points only leaves every hero wearing exactly what they wear today', () => {
    const input = inputFor();
    const plan = planFor(objective, 'points');
    for (const hero of input.heroes) {
      const proposed = plan.proposedLoadouts[hero.heroId];
      if (!proposed) continue;
      for (const [slot, item] of Object.entries(proposed)) {
        expect({ slot, item }).toEqual({ slot, item: hero.loadout[slot] ?? null });
      }
    }
  });

  it('gear only returns no point resets', () => {
    const plan = planFor(objective, 'gear');
    expect(plan.pointResets).toEqual([]);
    expect(plan.allowedChanges).toBe('gear');
  });

  it('gear only still moves or forges gear', () => {
    expect(gearChoreCount(planFor(objective, 'gear'))).toBeGreaterThan(0);
  });

  it.each(['both', 'points', 'gear'] as const)(
    'is deterministic under %s',
    (allowedChanges) => {
      const first = planFor(objective, allowedChanges);
      const second = planFor(objective, allowedChanges);
      expect(JSON.stringify(stripElapsed(first))).toBe(JSON.stringify(stripElapsed(second)));
    },
  );

  it('an omitted allowedChanges is the same plan as both', () => {
    const omitted = planFor(objective, undefined);
    const both = planFor(objective, 'both');
    expect(omitted.allowedChanges).toBe('both');
    expect(stripElapsed(omitted)).toEqual(stripElapsed(both));
  });
});

/** `elapsedMs` is wall-clock and never equal across two runs; everything else must be. */
function stripElapsed(plan: TeamPlan) {
  const { run, ...rest } = plan;
  const { elapsedMs: _elapsed, ...runRest } = run;
  return { ...rest, run: runRest };
}
