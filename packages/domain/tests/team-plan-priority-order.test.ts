import { describe, expect, it } from 'vitest';
import { runTeamPlan } from '@bombfarm/domain/team-plan/solver';
import type { ScopeState, TeamPlan, TeamPlanInput } from '@bombfarm/domain/team-plan/types';
import { syntheticTeamPlanInput, type SyntheticRosterOptions } from './helpers/synthetic-roster';

const MAX_EVALUATIONS = 1_500;

/**
 * How far a hill-climb from the hero's own gear may land below the team-wide plan's pick for it:
 * the search ranks starting points with points re-spent along the way and the report scores the
 * winner afterwards, so the two can disagree by a fraction of a percent. Measured worst 0.85%.
 */
const SEARCH_RESOLUTION = 0.02;

const ROSTERS: readonly { seed: number; options: SyntheticRosterOptions }[] = [
  { seed: 1, options: { heroCount: 4, spareItemCount: 10, forgeFloor: 10, fieldSlots: 4 } },
  { seed: 97, options: { heroCount: 5, spareItemCount: 16, forgeFloor: 15, fieldSlots: 5 } },
  { seed: 4242, options: { heroCount: 6, spareItemCount: 20, forgeFloor: 10, fieldSlots: 1 } },
];

function planFor(input: TeamPlanInput): TeamPlan {
  const result = runTeamPlan(input, { maxEvaluations: MAX_EVALUATIONS });
  if (result.blocked) throw new Error(`plan blocked: ${result.heroNames.join(', ')}`);
  return result.plan;
}

function afterOf(plan: TeamPlan, heroId: string): number {
  const row = plan.perHero.find((candidate) => candidate.heroId === heroId);
  if (!row) throw new Error(`no per-hero row for ${heroId}`);
  return row.after;
}

function heroIds(input: TeamPlanInput): string[] {
  return input.heroes.map((hero) => hero.heroId);
}

describe('priority order', () => {
  it.each(ROSTERS)('leaves each first hero as strong as the team-wide plan does, to search resolution (seed $seed)', ({ seed, options }) => {
    const input = syntheticTeamPlanInput(seed, options);
    const teamWide = planFor(input);
    for (const first of heroIds(input)) {
      const rest = heroIds(input).filter((heroId) => heroId !== first);
      const priority = planFor({ ...input, priorityOrder: [first, ...rest] });
      expect(afterOf(priority, first), `seed ${seed}, ${first} first`).toBeGreaterThanOrEqual(
        afterOf(teamWide, first) * (1 - SEARCH_RESOLUTION),
      );
    }
  });

  it.each(ROSTERS)('equips each item at most once (seed $seed)', ({ seed, options }) => {
    const input = syntheticTeamPlanInput(seed, options);
    const plan = planFor({ ...input, priorityOrder: heroIds(input).reverse() });

    const equipped = plan.moveList.filter((move) => move.phase === 'equip').map((move) => move.itemId);
    expect(new Set(equipped).size).toBe(equipped.length);
  });

  it('reports the order it geared in, with unlisted Optimize heroes after the listed ones', () => {
    const input = syntheticTeamPlanInput(97, { heroCount: 5, spareItemCount: 16, forgeFloor: 10, outOfScope: 'donate' });
    const [first, second, third, fourth, donor] = heroIds(input);
    const plan = planFor({ ...input, priorityOrder: ['not-a-hero', donor, third, first] });

    expect(plan.priorityOrder).toEqual([third, first, second, fourth]);
    expect(plan.perHero.map((row) => row.heroId).sort()).toEqual([first, second, third, fourth].sort());
  });

  it('runs the team-wide search when the order resolves to a single Optimize hero', () => {
    const input = syntheticTeamPlanInput(1, { heroCount: 4, spareItemCount: 10 });
    const [only, ...others] = heroIds(input);
    input.scopeByHeroId = Object.fromEntries([
      [only, 'optimize'],
      ...others.map((heroId): [string, ScopeState] => [heroId, 'donate']),
    ]);
    const plan = planFor({ ...input, priorityOrder: [only] });

    expect(plan.priorityOrder).toBeUndefined();
    expect(plan.run.seedUsed).not.toBe('priority');
  });

  it('never moves a leave-alone hero’s gear', () => {
    const input = syntheticTeamPlanInput(1, { heroCount: 5, spareItemCount: 12, forgeFloor: 10, outOfScope: 'leaveAlone' });
    const leftAlone = heroIds(input)[4];
    const plan = planFor({ ...input, priorityOrder: heroIds(input) });

    expect(plan.priorityOrder).not.toContain(leftAlone);
    for (const move of plan.moveList) {
      expect(move.fromHeroId).not.toBe(leftAlone);
      expect(move.toHeroId).not.toBe(leftAlone);
    }
  });

  it('moves and forges nothing when only points may change', () => {
    const input = syntheticTeamPlanInput(4242, { heroCount: 6, spareItemCount: 20, forgeFloor: 10 });
    const plan = planFor({ ...input, allowedChanges: 'points', priorityOrder: heroIds(input) });

    expect(plan.moveList).toEqual([]);
    expect(plan.forgeList).toEqual([]);
  });

  it('hands a lower hero’s piece to a higher one when it is the better piece', () => {
    const input = syntheticTeamPlanInput(97, { heroCount: 5, spareItemCount: 16, forgeFloor: 15, fieldSlots: 5 });
    const ids = heroIds(input);
    const plans = ids.map((first) => planFor({ ...input, priorityOrder: [first, ...ids.filter((id) => id !== first)] }));
    const takenFromAnotherHero = plans.some((plan) =>
      plan.moveList.some(
        (move) =>
          move.phase === 'equip' &&
          move.fromHeroId !== null &&
          move.toHeroId === plan.priorityOrder?.[0] &&
          move.fromHeroId !== move.toHeroId,
      ),
    );
    expect(takenFromAnotherHero).toBe(true);
  });
});

describe('runTeamPlan when a hero cannot be rebuilt', () => {
  function withUnbuildableHero(input: TeamPlanInput): TeamPlanInput {
    const [first, ...rest] = input.heroes;
    const { birth: _dropped, ...unbuildable } = first;
    return { ...input, heroes: [unbuildable, ...rest] };
  }

  it('reports the hero as blocked, team-wide and in priority order alike', () => {
    const input = withUnbuildableHero(syntheticTeamPlanInput(1, { heroCount: 4, spareItemCount: 10 }));
    const name = input.heroes[0].name;
    expect(runTeamPlan(input)).toEqual({ blocked: true, heroNames: [name] });
    expect(runTeamPlan({ ...input, priorityOrder: heroIds(input) })).toEqual({ blocked: true, heroNames: [name] });
  });
});

describe('runed heroes', () => {
  it('names the heroes in scope whose gain is partly a rune, in both modes', () => {
    const input = syntheticTeamPlanInput(97, { heroCount: 5, spareItemCount: 16, forgeFloor: 10 });
    const runed = input.heroes[1];
    input.heroes[1] = { ...runed, runes: [{ axis: 'attack', strengthPct: 5, playSecondsLeft: 600, rarity: 0 }] };

    expect(planFor(input).runedHeroNames).toEqual([runed.name]);
    expect(planFor({ ...input, priorityOrder: heroIds(input) }).runedHeroNames).toEqual([runed.name]);
  });
});
