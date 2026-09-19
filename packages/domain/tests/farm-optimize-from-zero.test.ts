/**
 * The respec advisor proposes the build a hero should have, not a polish of the build it has.
 *
 * Before this guard the search seeded itself from the player's current vector alongside five
 * coarse attack/energy splits and descended from whichever scored best raw — nearly always the
 * current one. On an objective that only moves at whole head-to-kill steps the descent then
 * stayed near it: a hero that had spent everything on crit damage was told to keep most of it,
 * and the same hero with everything on attack was told to keep attack. The advice echoed the
 * player's own choice instead of correcting it.
 *
 * Measured on the phase-101 capture's level-151 hero before the fix, one run per starting
 * vector, same roster otherwise: all-crit-damage → `critDmg 127`, all-attack → `attack 110`,
 * all-speed → `speed 126`. After: every start → the same vector.
 */
import { describe, expect, it } from 'vitest';
import { solveFarmRespec } from '@bombfarm/domain/farm-optimize';
import { computeHeroFarmBases, type HeroFarmBasis } from '@bombfarm/domain/farm-rate';
import { FARM_OPT_FULL_MAX_EVALUATIONS, FARM_OPT_JOINT_BUDGET_SHARE } from '@bombfarm/domain/farm-optimize';
import { runFarmSearch } from '@bombfarm/domain/farm-optimize-search';
import { resolveFarmObjective } from '@bombfarm/domain/farm-optimize-objective';
import { budgetOf, reoptBudget, REOPT_KEYS } from '@bombfarm/domain/points-reopt-core';
import type { SheetKey } from '@bombfarm/domain/planner-constants';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import { loadFarmRateFixture } from './helpers/farm-rate-fixtures';
import { holdSuiteUntilInRegime } from './helpers/capture-regime';

/** The capture the defect was measured on: its level-151 hero has a 151-point budget, room enough
 *  for a lopsided build to be a local optimum the old descent never left. The level-44 heroes of
 *  the smaller captures never went wrong — their from-zero splits out-scored any lopsided start
 *  raw — so a guard on them passes on the old code too. */
const FIXTURE = 'save-20260914-20heroes-phase101.json';

holdSuiteUntilInRegime(`sheet-math/${FIXTURE}`, 'sheet');

const { heroes, account, maxPhase } = loadFarmRateFixture(FIXTURE);
const TARGET = [...heroes].sort((left, right) => right.level - left.level)[0];
const LOPSIDED_KEYS: readonly SheetKey[] = ['attack', 'critDmg', 'speed', 'energy'];

/** The target's whole reallocatable budget on ONE key, luck untouched — the lopsided builds
 *  the old search echoed back. */
function rosterWith(target: HeroRecord, key: SheetKey): HeroRecord[] {
  const total = budgetOf(target.pts);
  const pts = { ...target.pts };
  for (const k of REOPT_KEYS) pts[k] = 0;
  pts[key] = total;
  return heroes.map((hero) => (hero.id === target.id ? { ...hero, pts } : hero));
}

function searchOn(roster: readonly HeroRecord[]) {
  const bases = computeHeroFarmBases({ heroes: roster, account });
  const budgetById = new Map(bases.map((b) => [b.heroId, reoptBudget(b.pts, b.level)] as const));
  return runFarmSearch(
    bases,
    bases.map((b) => b.heroId),
    budgetById,
    account,
    resolveFarmObjective({ kind: 'gold' }),
    { goldScale: 1, chestScale: 1 },
    { maxPhase },
    Math.floor(FARM_OPT_FULL_MAX_EVALUATIONS * FARM_OPT_JOINT_BUDGET_SHARE),
  );
}

function proposedFor(search: ReturnType<typeof searchOn>, heroId: string) {
  const pts = search.winner.assignment.get(heroId);
  if (!pts) throw new Error(`${heroId} is absent from the winning assignment`);
  return pts;
}

describe('the proposal does not depend on how the points sit today', () => {
  const reference = searchOn(heroes);

  it('the reference search proposes a change, so the comparisons below are not vacuous', () => {
    expect(reference.winningSeedName).not.toBe('current');
  });

  for (const key of LOPSIDED_KEYS) {
    it(`${TARGET.name} with everything on ${key} is offered the same build as from the capture`, () => {
      const search = searchOn(rosterWith(TARGET, key));
      expect(search.winningSeedName).not.toBe('current');
      expect(proposedFor(search, TARGET.id)).toEqual(proposedFor(reference, TARGET.id));
    });
  }

  it('the whole roster is offered the same assignment, whichever way the target was bent', () => {
    for (const key of LOPSIDED_KEYS) {
      const search = searchOn(rosterWith(TARGET, key));
      for (const basis of computeHeroFarmBases({ heroes, account })) {
        expect(proposedFor(search, basis.heroId), `${basis.heroName}, target on ${key}`).toEqual(
          proposedFor(reference, basis.heroId),
        );
      }
    }
  });
});

describe('the current build is the bar, not the start', () => {
  it('a roster the advisor already settled is kept as it is, with the incumbent named as the winner', () => {
    const first = solveFarmRespec({ heroes, account, maxPhase });
    expect(first.outcome).toBe('improved');
    const settled = heroes.map((hero) => {
      const entry = first.heroes.find((h) => h.heroId === hero.id);
      return entry ? { ...hero, pts: entry.proposedPts } : hero;
    });
    const second = solveFarmRespec({ heroes: settled, account, maxPhase });
    expect(second.keptCurrent).toBe(true);
    expect(second.winningSeed).toBe('current');
  });

  it('a search that could evaluate nothing but the incumbent returns it, clamped, and says so', () => {
    const bases: HeroFarmBasis[] = computeHeroFarmBases({ heroes, account });
    const budgetById = new Map(bases.map((b) => [b.heroId, reoptBudget(b.pts, b.level)] as const));
    const search = runFarmSearch(
      bases,
      bases.map((b) => b.heroId),
      budgetById,
      account,
      resolveFarmObjective({ kind: 'gold' }),
      { goldScale: 1, chestScale: 1 },
      { maxPhase },
      1,
    );
    expect(search.evaluations).toBe(1);
    expect(search.budgetExhausted).toBe(true);
    expect(search.winningSeedName).toBe('current');
    for (const basis of bases) {
      expect(search.winner.assignment.get(basis.heroId)).toEqual(basis.pts);
    }
  });
});
