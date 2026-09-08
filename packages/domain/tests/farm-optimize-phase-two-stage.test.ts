/**
 * The two-stage phase sweep is a HEURISTIC, and this suite is shaped around that.
 *
 * Screening the world openers and refining one world either side of the screen's winner reads a
 * fraction of the rows the linear sweep does, but an opener's score does not bound its world's
 * peak: over randomized squad states the two sweeps choose a different phase on roughly 0.5% of
 * them, costing up to 1.6% of the objective when they do. So the load-bearing property is NOT
 * that the two agree — it is that no figure the app REPORTS is ever a screened one.
 *
 * That is what the first block pins, entry point by entry point, each anchored on a committed
 * state where the screen demonstrably misses. Every witness asserts the miss FIRST: if the model
 * ever moves and the state stops discriminating, the guard says so instead of passing on a case
 * that no longer proves anything.
 *
 * The second block records that on the states these captures' own searches visit, the two sweeps
 * do agree. That is a property of this corpus, not a theorem, and it is named that way — widening
 * the screen stride or narrowing the refine window shows up there.
 *
 * NO REGIME HOLD, deliberately. What the other farm suites gate on is whether a capture's
 * arithmetic is still true of the live game; this suite asserts which phase set produced a
 * reported row out of whatever arithmetic the model currently produces. A capture that has left
 * sheet regime is still a real roster with real hero shapes, and it exercises the sweep exactly as
 * well as an in-regime one — holding the suite would withdraw search coverage to protect a claim
 * it does not make.
 */
import { describe, expect, it } from 'vitest';
import {
  resolveFarmObjective,
  bestFarmPhase,
  farmObjectiveScales,
  type BestFarmPhaseOptions,
  type FarmObjectiveScales,
  type ResolvedFarmObjective,
} from '@bombfarm/domain/farm-optimize-objective';
import { computeHeroFarmBases, squadFactsFromBases, type SquadFarmFacts } from '@bombfarm/domain/farm-rate';
import { solveFarmRespec } from '@bombfarm/domain/farm-optimize';
import { optimizeHeroForFarm } from '@bombfarm/domain/farm-hero-optimize';
import { rankNextPointForFarm } from '@bombfarm/domain/farm-point-rank';
import { RANK_STATS } from '@bombfarm/domain/model';
import type { SheetKey } from '@bombfarm/domain/planner-constants';
import { loadFarmRateFixture } from './helpers/farm-rate-fixtures';

const FIXTURES = [
  'save-20260828-4heroes-postpatch.json',
  'save-20260831-13heroes-soulbound.json',
  'save-20260822-15heroes-tree-crit-dmg.json',
  'save-20260823-13heroes-crit-points.json',
  'save-20260825-11heroes-one-shot-spread.json',
] as const;

const OBJECTIVES: Record<string, ResolvedFarmObjective> = {
  gold: resolveFarmObjective({ kind: 'gold' }),
  chests: resolveFarmObjective({ kind: 'chests' }),
  blend: resolveFarmObjective({ kind: 'blend', weight: 0.5 }),
};

/** Straddles the world openers in both directions — an opener, a gate, the phase either side of
 *  one, and a ceiling that is and is not itself an opener. */
const MAX_PHASE_PROBES = [1, 2, 9, 10, 11, 12, 20, 21, 25, 50, 51, 60, 61, 100, 121, null] as const;

const UNIT_SCALES: FarmObjectiveScales = { goldScale: 1, chestScale: 1 };

function exhaustive(options: BestFarmPhaseOptions): BestFarmPhaseOptions {
  return { ...options, exhaustive: true };
}

function fullSweepPhase(
  squad: SquadFarmFacts,
  objective: ResolvedFarmObjective,
  maxPhase: number | null,
  scales: FarmObjectiveScales = UNIT_SCALES,
): number | null {
  const pick = bestFarmPhase(squad, objective, scales, { maxPhase, exhaustive: true });
  return pick ? pick.phase : null;
}

function screenedPhase(
  squad: SquadFarmFacts,
  objective: ResolvedFarmObjective,
  maxPhase: number | null,
  scales: FarmObjectiveScales = UNIT_SCALES,
): number | null {
  const pick = bestFarmPhase(squad, objective, scales, { maxPhase });
  return pick ? pick.phase : null;
}

describe('no REPORTED phase is ever a screened one', () => {
  describe('rankNextPointForFarm', () => {
    /** The screen centres on the fifth world's opener and stops at 51; the full sweep finds 32,
     *  and the two disagree about which stat the next point should buy.
     *
     *  A ONE-HERO POOL USED TO CARRY THIS, and stopped: charging every clear for the head the
     *  squad spends coming up to speed reshaped the objective surface enough that the screen's
     *  miss — still a miss, still 51 against 32 — no longer changes which stat wins. The guard
     *  below asserts the discrimination first, so it reported that rather than passing on a case
     *  proving nothing. Two heroes on the same capture, at the same ceiling, discriminate. */
    const WITNESS = { fixture: 'save-20260819-11882-7heroes.json', poolSize: 2, maxPhase: 52 } as const;

    it('reports the full sweep phase and row order where the screen picks a different world', () => {
      const { heroes, account } = loadFarmRateFixture(WITNESS.fixture);
      const bases = computeHeroFarmBases({ heroes, account }).slice(0, WITNESS.poolSize);
      const squad = squadFactsFromBases(bases, null, account);
      const gold = OBJECTIVES.gold;

      const screened = screenedPhase(squad, gold, WITNESS.maxPhase);
      const swept = fullSweepPhase(squad, gold, WITNESS.maxPhase);
      expect(screened).not.toBe(swept);

      const result = rankNextPointForFarm({
        bases,
        account,
        heroId: bases[0].heroId,
        maxPhase: WITNESS.maxPhase,
      });
      expect(result.outcome).toBe('ranked');
      expect(result.phase).toBe(swept);

      const orderAtScreenedPhase = referenceRankOrder(bases, account, gold, WITNESS.maxPhase, false);
      const orderAtSweptPhase = referenceRankOrder(bases, account, gold, WITNESS.maxPhase, true);
      expect(orderAtScreenedPhase).not.toEqual(orderAtSweptPhase);
      expect(result.rows!.map((row) => row.stat)).toEqual(orderAtSweptPhase);
    });

    it.each(FIXTURES)('%s — every objective ranks against the full sweep phase', (filename) => {
      const { heroes, account, maxPhase } = loadFarmRateFixture(filename);
      const bases = computeHeroFarmBases({ heroes, account });
      const squad = squadFactsFromBases(bases, null, account);
      for (const [name, objective] of Object.entries(OBJECTIVES)) {
        for (const probe of [maxPhase, 52, null]) {
          const scales =
            objective.kind === 'blend'
              ? farmObjectiveScales(squad, exhaustive({ maxPhase: probe }))
              : UNIT_SCALES;
          const result = rankNextPointForFarm({
            bases,
            account,
            heroId: bases[0].heroId,
            objective: { kind: objective.kind, weight: objective.weight },
            maxPhase: probe,
          });
          if (result.outcome !== 'ranked') continue;
          expect(`${name}/${probe}: ${result.phase}`).toBe(
            `${name}/${probe}: ${fullSweepPhase(squad, objective, probe, scales)}`,
          );
        }
      }
    });
  });

  describe('solveFarmRespec', () => {
    /** One hero of a committed capture, at its own ceiling: the screen stops at 52, the full
     *  sweep finds 29 — a 3.4% richer phase. */
    const WITNESS = { fixture: 'save-20260819-respec-crit-cdr.json', heroIds: ['41990'], maxPhase: 52 } as const;

    it('reports the full sweep phase where the screen picks a different world', () => {
      const { heroes, account } = loadFarmRateFixture(WITNESS.fixture);
      const solved = solveFarmRespec({
        heroes,
        account,
        enabledHeroIds: WITNESS.heroIds,
        maxPhase: WITNESS.maxPhase,
      });
      const screened = screenedPhase(solved.currentSquad, OBJECTIVES.gold, WITNESS.maxPhase);
      const swept = fullSweepPhase(solved.currentSquad, OBJECTIVES.gold, WITNESS.maxPhase);
      expect(screened).not.toBe(swept);
      expect(solved.currentPhase).toBe(swept);
    });

    it.each(FIXTURES)('%s — current, recommended and every frontier tier are full-sweep picks', (filename) => {
      const { heroes, account, maxPhase } = loadFarmRateFixture(filename);
      const bases = computeHeroFarmBases({ heroes, account });
      const solved = solveFarmRespec({ heroes, account, maxPhase });
      const gold = OBJECTIVES.gold;

      expect(solved.currentPhase).toBe(fullSweepPhase(solved.currentSquad, gold, maxPhase));
      expect(solved.recommendedPhase).toBe(fullSweepPhase(solved.proposedSquad, gold, maxPhase));

      for (const tier of solved.frontier) {
        const tierSquad = squadFactsFromBases(
          bases,
          new Map(tier.heroes.map((hero) => [hero.heroId, hero.proposedPts])),
          account,
        );
        expect(tier.recommendedPhase).toBe(fullSweepPhase(tierSquad, gold, maxPhase));
        const pick = bestFarmPhase(tierSquad, gold, UNIT_SCALES, { maxPhase, exhaustive: true });
        expect(tier.proposedObjective).toBe(pick ? pick.value : 0);
      }
    });
  });

  describe('optimizeHeroForFarm', () => {
    /** A two-hero rotation of a committed capture: the screen stops at 76, the full sweep finds
     *  67. The hero has nothing to gain, so this is the CURRENT side's read-out. */
    const WITNESS = {
      fixture: 'save-20260825-11heroes-one-shot-spread.json',
      heroIds: ['30140', '81033'],
      heroId: '81033',
      maxPhase: 85,
    } as const;

    it('reports the full sweep phase where the screen picks a different world', () => {
      const { heroes, account } = loadFarmRateFixture(WITNESS.fixture);
      const bases = computeHeroFarmBases({ heroes, account, enabledHeroIds: WITNESS.heroIds });
      const squad = squadFactsFromBases(bases, null, account);
      const screened = screenedPhase(squad, OBJECTIVES.gold, WITNESS.maxPhase);
      const swept = fullSweepPhase(squad, OBJECTIVES.gold, WITNESS.maxPhase);
      expect(screened).not.toBe(swept);

      const result = optimizeHeroForFarm({
        bases,
        account,
        heroId: WITNESS.heroId,
        maxPhase: WITNESS.maxPhase,
      });
      expect(result.currentPhase).toBe(swept);
    });

    /** No committed state is known where the SEARCH WINNER's screen misses, so this side has no
     *  witness of its own. It still has to hold: `gainPct` divides the proposed objective by an
     *  exhaustive current one, and a screened numerator would make that ratio mixed-basis. */
    it.each(FIXTURES)('%s — the proposed side is measured on the same basis as the current one', (filename) => {
      const { heroes, account, maxPhase } = loadFarmRateFixture(filename);
      const bases = computeHeroFarmBases({ heroes, account });
      const gold = OBJECTIVES.gold;
      const result = optimizeHeroForFarm({ bases, account, heroId: bases[0].heroId, maxPhase });

      expect(result.currentPhase).toBe(fullSweepPhase(squadFactsFromBases(bases, null, account), gold, maxPhase));
      if (result.outcome !== 'improved') return;

      const winnerSquad = squadFactsFromBases(bases, new Map([[bases[0].heroId, result.pts]]), account);
      const pick = bestFarmPhase(winnerSquad, gold, UNIT_SCALES, { maxPhase, exhaustive: true });
      expect(result.recommendedPhase).toBe(pick ? pick.phase : null);
      expect(result.proposedObjective).toBe(pick ? pick.value : 0);
    });
  });
});

function referenceRankOrder(
  bases: ReturnType<typeof computeHeroFarmBases>,
  account: Parameters<typeof squadFactsFromBases>[2],
  objective: ResolvedFarmObjective,
  maxPhase: number | null,
  fullSweep: boolean,
): SheetKey[] {
  const options: BestFarmPhaseOptions = { maxPhase, exhaustive: fullSweep };
  const currentSquad = squadFactsFromBases(bases, null, account);
  const base = bestFarmPhase(currentSquad, objective, UNIT_SCALES, options)!;
  const basis = bases[0];
  return RANK_STATS.map((stat) => {
    const candidate = { ...basis.pts, [stat]: basis.pts[stat] + 1 };
    const squad = squadFactsFromBases(bases, new Map([[basis.heroId, candidate]]), account);
    const pick = bestFarmPhase(squad, objective, UNIT_SCALES, options);
    return { stat, gainPct: pick === null ? 0 : pick.value / base.value - 1 };
  })
    .sort((left, right) => right.gainPct - left.gainPct)
    .map((row) => row.stat);
}

type NamedSquad = { name: string; squad: SquadFarmFacts };

function squadsForFixture(filename: string): NamedSquad[] {
  const { heroes, account, maxPhase } = loadFarmRateFixture(filename);
  const bases = computeHeroFarmBases({ heroes, account });

  const solved = solveFarmRespec({ heroes, account, maxPhase });
  const proposed = new Map<string, Record<SheetKey, number>>(
    solved.heroes.map((hero) => [hero.heroId, hero.proposedPts]),
  );
  const halfway = new Map<string, Record<SheetKey, number>>(
    solved.heroes.map((hero) => {
      const midpoint = { ...hero.currentPts };
      for (const key of Object.keys(midpoint) as SheetKey[]) {
        midpoint[key] = Math.floor((hero.currentPts[key] + hero.proposedPts[key]) / 2);
      }
      return [hero.heroId, midpoint];
    }),
  );
  const frontierSquads = solved.frontier.map((tier, index) => ({
    name: `frontier tier ${index + 1}`,
    squad: squadFactsFromBases(
      bases,
      new Map(tier.heroes.map((hero) => [hero.heroId, hero.proposedPts])),
      account,
    ),
  }));

  return [
    { name: 'current build', squad: squadFactsFromBases(bases, null, account) },
    { name: 'solved build', squad: squadFactsFromBases(bases, proposed, account) },
    { name: 'halfway to the solved build', squad: squadFactsFromBases(bases, halfway, account) },
    ...frontierSquads,
  ];
}

describe.each(FIXTURES)('the two sweeps agree on the states this capture reaches — %s', (filename) => {
  const squads = squadsForFixture(filename);

  for (const { name, squad } of squads) {
    for (const [objectiveName, objective] of Object.entries(OBJECTIVES)) {
      for (const maxPhase of MAX_PHASE_PROBES) {
        it(`${name}, ${objectiveName}, maxPhase ${maxPhase}`, () => {
          const options: BestFarmPhaseOptions = { maxPhase };
          // Both sides share ONE set of normalizers, taken exhaustively, so a blend comparison
          // isolates the phase set rather than folding in a difference in its own denominator.
          const scales: FarmObjectiveScales =
            objective.kind === 'blend' ? farmObjectiveScales(squad, exhaustive(options)) : UNIT_SCALES;

          const reference = bestFarmPhase(squad, objective, scales, exhaustive(options));
          const twoStage = bestFarmPhase(squad, objective, scales, options);

          if (reference === null) {
            expect(twoStage).toBeNull();
            return;
          }
          expect(twoStage).not.toBeNull();
          expect(twoStage!.phase).toBe(reference.phase);
          expect(twoStage!.value).toBe(reference.value);
          expect(twoStage!.row.goldPerHour).toBe(reference.row.goldPerHour);
          expect(twoStage!.row.chestsPerHour).toBe(reference.row.chestsPerHour);
        });
      }
    }
  }
});

describe('the screen and the refine window are the phase sets they claim to be', () => {
  const { heroes, account } = loadFarmRateFixture(FIXTURES[0]);
  const bases = computeHeroFarmBases({ heroes, account });
  const squad = squadFactsFromBases(bases, null, account);
  const goldObjective = OBJECTIVES.gold;

  /** `phaseStride` 10 subsamples exactly the world openers, so it reproduces the screen's own
   *  phase set on the linear path — the screen, with no refine pass behind it. */
  const WORLD_STRIDE = 10;

  it('a subsampling phaseStride still takes the linear path, unchanged by the screen', () => {
    const strided = bestFarmPhase(squad, goldObjective, UNIT_SCALES, { maxPhase: null, phaseStride: 3 });
    const stridedExhaustive = bestFarmPhase(squad, goldObjective, UNIT_SCALES, {
      maxPhase: null,
      phaseStride: 3,
      exhaustive: true,
    });
    expect(strided).not.toBeNull();
    expect(strided!.phase % 3).toBe(1);
    expect(strided!.phase).toBe(stridedExhaustive!.phase);
  });

  it('exhaustive: false is the two-stage sweep, not the linear one', () => {
    const implicit = bestFarmPhase(squad, goldObjective, UNIT_SCALES, { maxPhase: 161 });
    const explicit = bestFarmPhase(squad, goldObjective, UNIT_SCALES, { maxPhase: 161, exhaustive: false });
    expect(explicit).toEqual(implicit);
  });

  /** The refine window is centred on the screen's winner and one world wide either side, so it
   *  contains that phase — which is what lets the refine pass replace the screen outright instead
   *  of being compared back against it. Narrow the window past its centre and this fails. */
  it.each(FIXTURES)('%s — refining never scores below the opener screen alone', (fixture) => {
    const loaded = loadFarmRateFixture(fixture);
    const fixtureSquad = squadFactsFromBases(
      computeHeroFarmBases({ heroes: loaded.heroes, account: loaded.account }),
      null,
      loaded.account,
    );
    for (const [, objective] of Object.entries(OBJECTIVES)) {
      for (const maxPhase of MAX_PHASE_PROBES) {
        const screenOnly = bestFarmPhase(fixtureSquad, objective, UNIT_SCALES, {
          maxPhase,
          phaseStride: WORLD_STRIDE,
        });
        const twoStage = bestFarmPhase(fixtureSquad, objective, UNIT_SCALES, { maxPhase });
        if (screenOnly === null) {
          expect(twoStage).toBeNull();
          continue;
        }
        expect(twoStage).not.toBeNull();
        expect(twoStage!.value).toBeGreaterThanOrEqual(screenOnly.value);
      }
    }
  });

  it('a squad with no feasible phase is null on both paths, not merely unscreened', () => {
    const degenerate: SquadFarmFacts = { ...squad, heroes: [] };
    expect(bestFarmPhase(degenerate, goldObjective, UNIT_SCALES, { maxPhase: 161 })).toBeNull();
    expect(
      bestFarmPhase(degenerate, goldObjective, UNIT_SCALES, { maxPhase: 161, exhaustive: true }),
    ).toBeNull();
  });
});
