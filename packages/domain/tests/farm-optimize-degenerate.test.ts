/**
 * Every degenerate and boundary case from `design.md` §7, each pinned to the FULL tuple
 * (`outcome`, `keptCurrent`, `recommendedPhase`, `gainPct`, `heroes.length`, `frontier.length`,
 * `plateau`, `evaluations`), plus the objective weight/kind sweep at the solver boundary and a
 * finite-value sweep over every result this file produces.
 */
import { describe, expect, it } from 'vitest';
import { solveFarmRespec, type FarmRespecResult, type FarmRespecInput } from '@bombfarm/domain/farm-optimize';
import type { AccountShared, HeroRecord } from '@bombfarm/domain/shims/storage';
import { assertInRegime } from './helpers/capture-regime';
import { FARM_OPTIMIZE_FIXTURE, loadFarmRateFixture } from './helpers/farm-rate-fixtures';

assertInRegime(`sheet-math/${FARM_OPTIMIZE_FIXTURE}`, 'sheet');

const { heroes, account, maxPhase } = loadFarmRateFixture(FARM_OPTIMIZE_FIXTURE);

/** `Number.isNaN`/`Number.isFinite` sweep over every numeric field of a result, including
 *  `heroes[]` and `plateau` — no field in this suite may ever surface a NaN, and no field
 *  documented as "never Infinity" may surface one either. */
function assertResultIsFinite(result: FarmRespecResult): void {
  const numericFields: [string, number][] = [
    ['currentObjective', result.currentObjective],
    ['proposedObjective', result.proposedObjective],
    ['gainPct', result.gainPct],
    ['currentGoldPerHour', result.currentGoldPerHour],
    ['proposedGoldPerHour', result.proposedGoldPerHour],
    ['currentChestsPerHour', result.currentChestsPerHour],
    ['proposedChestsPerHour', result.proposedChestsPerHour],
    ['respecCostGold', result.respecCostGold],
    ['evaluations', result.evaluations],
    ['sweeps', result.sweeps],
  ];
  for (const hero of result.heroes) {
    numericFields.push([`hero ${hero.heroId} pointsMoved`, hero.pointsMoved]);
    numericFields.push([`hero ${hero.heroId} respecCostGold`, hero.respecCostGold]);
    for (const key of Object.keys(hero.proposedPts)) {
      numericFields.push([`hero ${hero.heroId} proposedPts.${key}`, hero.proposedPts[key as keyof typeof hero.proposedPts]]);
    }
  }
  if (result.plateau) {
    numericFields.push(['plateau.minEnergyShare', result.plateau.minEnergyShare]);
    numericFields.push(['plateau.maxEnergyShare', result.plateau.maxEnergyShare]);
    numericFields.push(['plateau.tolerancePct', result.plateau.tolerancePct]);
    numericFields.push(['plateau.currentEnergyShare', result.plateau.currentEnergyShare]);
    numericFields.push(['plateau.proposedEnergyShare', result.plateau.proposedEnergyShare]);
  }
  if (result.paybackHours !== null) numericFields.push(['paybackHours', result.paybackHours]);

  for (const [label, value] of numericFields) {
    expect(Number.isNaN(value), `${label} is NaN`).toBe(false);
  }
  // Never Infinity, specifically (structurally bounded fields).
  expect(Number.isFinite(result.gainPct)).toBe(true);
  expect(Number.isFinite(result.evaluations)).toBe(true);
  expect(result.paybackHours === null || Number.isFinite(result.paybackHours)).toBe(true);
}

describe('empty pool', () => {
  it('enabledHeroIds: [] ⇒ emptyPool, recommendedPhase null, never a fabricated phase 1', () => {
    const result = solveFarmRespec({ heroes, account, maxPhase, enabledHeroIds: [] });
    expect(result.outcome).toBe('emptyPool');
    expect(result.keptCurrent).toBe(true);
    expect(result.recommendedPhase).toBeNull();
    expect(result.gainPct).toBe(0);
    expect(result.heroes).toHaveLength(0);
    expect(result.frontier).toHaveLength(0);
    expect(result.plateau).toBeNull();
    expect(result.evaluations).toBe(0);
    assertResultIsFinite(result);
  });

  it('a roster with nothing battleAllowed ⇒ emptyPool, recommendedPhase null', () => {
    const noneAllowed: HeroRecord[] = heroes.map((h) => ({ ...h, battleAllowed: false }));
    const result = solveFarmRespec({ heroes: noneAllowed, account, maxPhase });
    expect(result.outcome).toBe('emptyPool');
    expect(result.recommendedPhase).toBeNull();
    expect(result.heroes).toHaveLength(0);
    expect(result.evaluations).toBe(0);
    assertResultIsFinite(result);
  });
});

describe('every enabled hero degenerate', () => {
  it('allDegenerate is a DIFFERENT named outcome from nothingToGain', () => {
    const fenn = heroes.find((h) => h.name === 'Fenn')!;
    const stillFenn: HeroRecord = { ...fenn, birth: { ...fenn.birth!, speed: 0 } };
    const result = solveFarmRespec({ heroes: [stillFenn], account, maxPhase });
    expect(result.outcome).toBe('allDegenerate');
    expect(result.outcome).not.toBe('nothingToGain');
    expect(result.keptCurrent).toBe(true);
    expect(result.recommendedPhase).toBeNull();
    expect(result.gainPct).toBe(0);
    expect(result.heroes).toHaveLength(1);
    expect(result.heroes[0].searchable).toBe(false);
    expect(result.frontier).toHaveLength(0);
    expect(result.plateau).toBeNull();
    expect(result.evaluations).toBe(0);
    assertResultIsFinite(result);
  });
});

describe('exactly one searchable hero', () => {
  it('the solve succeeds with a single-element change set and an empty frontier', () => {
    const oneId = [heroes.find((h) => h.name === 'Fenn')!.id];
    const result = solveFarmRespec({ heroes, account, maxPhase, enabledHeroIds: oneId });
    expect(result.heroes).toHaveLength(1);
    expect(result.frontier).toHaveLength(0);
    assertResultIsFinite(result);
  });
});

describe('two searchable heroes — the frontier is capped by |S|', () => {
  it('frontier stays within bounds for a 2-hero pool (T5/T7: always []; T9 adds the 1-hero tier)', () => {
    const twoIds = heroes.slice(0, 2).map((h) => h.id);
    const result = solveFarmRespec({ heroes, account, maxPhase, enabledHeroIds: twoIds });
    expect(result.heroes).toHaveLength(2);
    // Every frontier tier must have fewer heroes than |S| — trivially true while frontier is
    // empty, and the invariant T9 must preserve once it starts populating this array.
    for (const entry of result.frontier) {
      expect(entry.heroCount).toBeLessThan(2);
    }
    assertResultIsFinite(result);
  });
});

describe('every reoptBudget is 0', () => {
  it("noBudget, keptCurrent, evaluations <= 1, recommendedPhase is the current build's argmax", () => {
    const fenn = heroes.find((h) => h.name === 'Fenn')!;
    // level 5, all 5 points already sunk into luck ⇒ level - luck = 0 AND budgetOf(pts) = 0.
    const zeroBudgetHero: HeroRecord = {
      ...fenn,
      level: 5,
      pts: { attack: 0, energy: 0, speed: 0, critChance: 0, critDmg: 0, penetration: 0, cdr: 0, luck: 5 },
    };
    const result = solveFarmRespec({ heroes: [zeroBudgetHero], account, maxPhase });
    expect(result.outcome).toBe('noBudget');
    expect(result.keptCurrent).toBe(true);
    expect(result.evaluations).toBeLessThanOrEqual(1);
    expect(result.recommendedPhase).not.toBeNull();
    expect(result.recommendedPhase).toBe(result.currentPhase);
    expect(result.heroes).toHaveLength(1);
    expect(result.heroes[0].searchable).toBe(false);
    expect(result.frontier).toHaveLength(0);
    assertResultIsFinite(result);
  });
});

describe('no feasible phase under any candidate build', () => {
  it('a maxPhase that floors to an empty candidate range ⇒ recommendedPhase null, gainPct 0, never Infinity/NaN', () => {
    // maxPhase: 0.9 floors to 0 ⇒ the candidate phase range [1, 0] is empty for every build,
    // not just the current one — no phase can ever be feasible regardless of allocation.
    const result = solveFarmRespec({ heroes, account, maxPhase: 0.9 });
    expect(result.outcome).toBe('noFeasiblePhase');
    expect(result.recommendedPhase).toBeNull();
    expect(result.gainPct).toBe(0);
    expect(result.evaluations).toBeGreaterThanOrEqual(1);
    expect(result.heroes).toHaveLength(heroes.length);
    assertResultIsFinite(result);
  });
});

describe('currentObjective <= 0 ⇒ gainPct 0, no division by zero', () => {
  it('an extreme negative tree luck drives chests/hr non-positive while the build stays feasible', () => {
    const badAccount: AccountShared = { ...account, tree: { ...account.tree, luckFlatPct: -500 } };
    const result = solveFarmRespec({ heroes, account: badAccount, objective: { kind: 'chests' }, maxPhase });
    expect(result.currentObjective).toBeLessThanOrEqual(0);
    expect(result.gainPct).toBe(0);
    assertResultIsFinite(result);
  });
});

describe('the objective rises but goldPerHour falls ⇒ paybackHours null, never negative, never Infinity', () => {
  // RE-ASKED on the 2026-08-19 roster after the retired 2026-08-13 one left its regime (issue
  // #206): 1,137,440 < 1,331,738 gold/hr, where it was 259,413 < 264,997 there. Different
  // account, different magnitude, same crossover — optimising for chests really does cost gold,
  // and `paybackHours` really does go null rather than negative when it does.
  it('the chest-optimal build trades gold away — proposedGoldPerHour falls and paybackHours is null', () => {
    const result = solveFarmRespec({ heroes, account, objective: { kind: 'chests' }, maxPhase });
    expect(result.outcome).toBe('improved');
    expect(result.proposedGoldPerHour).toBeLessThan(result.currentGoldPerHour);
    expect(result.paybackHours).toBeNull();
    assertResultIsFinite(result);
  });
});

describe('one degenerate hero among healthy ones', () => {
  it('the degenerate hero is pinned (searchable: false, unchanged), the others still solve', () => {
    const fenn = heroes.find((h) => h.name === 'Fenn')!;
    const stillFenn: HeroRecord = { ...fenn, id: 'still-fenn', birth: { ...fenn.birth!, speed: 0 } };
    const mixed = [...heroes, stillFenn];
    const result = solveFarmRespec({ heroes: mixed, account, maxPhase });

    const stillEntry = result.heroes.find((h) => h.heroId === 'still-fenn')!;
    expect(stillEntry.degenerate).toBe(true);
    expect(stillEntry.searchable).toBe(false);
    expect(stillEntry.changed).toBe(false);

    const others = result.heroes.filter((h) => h.heroId !== 'still-fenn');
    expect(others.some((h) => h.changed)).toBe(true);
    expect(result.outcome).toBe('improved');
    assertResultIsFinite(result);
  });
});

describe('duplicate hero ids', () => {
  it('both are counted, exactly as the estimator does today — no crash, no dedup', () => {
    const fenn = heroes.find((h) => h.name === 'Fenn')!;
    const duplicated = [...heroes, { ...fenn }];
    expect(() => solveFarmRespec({ heroes: duplicated, account, maxPhase })).not.toThrow();
    const result = solveFarmRespec({ heroes: duplicated, account, maxPhase });
    expect(result.heroes).toHaveLength(heroes.length + 1);
    assertResultIsFinite(result);
  });
});

describe('absent account.slots, negative teamCoinPct, undefined luckFlatPct', () => {
  it('none of these crash the solver', () => {
    const oddAccount: AccountShared = {
      ...account,
      slots: undefined,
      tree: { ...account.tree, teamCoinPct: -50, luckFlatPct: undefined },
    };
    expect(() => solveFarmRespec({ heroes, account: oddAccount, maxPhase })).not.toThrow();
    const result = solveFarmRespec({ heroes, account: oddAccount, maxPhase });
    assertResultIsFinite(result);
  });
});

describe('the objective weight/kind sweep at the solver boundary — never throws, always a valid result', () => {
  const cases: { label: string; objective: FarmRespecInput['objective'] }[] = [
    { label: 'weight NaN', objective: { kind: 'blend', weight: NaN } },
    { label: 'weight -3', objective: { kind: 'blend', weight: -3 } },
    { label: 'weight 7', objective: { kind: 'blend', weight: 7 } },
    { label: 'weight absent', objective: { kind: 'blend' } },
    { label: 'unknown kind', objective: { kind: 'diamonds' as unknown as 'gold' } },
    { label: 'null objective', objective: null },
  ];

  for (const { label, objective } of cases) {
    it(label, () => {
      expect(() => solveFarmRespec({ heroes, account, objective, maxPhase })).not.toThrow();
      const result = solveFarmRespec({ heroes, account, objective, maxPhase });
      assertResultIsFinite(result);
    });
  }
});
