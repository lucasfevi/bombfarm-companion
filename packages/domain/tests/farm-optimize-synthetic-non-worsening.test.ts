/**
 * `solveFarmRespec` never advises a build that farms worse than the one it was given — on rosters
 * invented here rather than parsed from a capture, so the guard says something about the solver
 * instead of about one player's account.
 *
 * Each case is checked twice. Once against the solver's own before/after pair, and once by
 * writing the proposal back onto the roster and re-pricing both builds through
 * `computeFarmRates`, each at its own best feasible phase. The second check is independent of the
 * SOLVER'S BOOKKEEPING, not of the objective's definition — it shares `farmObjectiveValue` and
 * `farmObjectiveScales` with production, so a bug in what the objective MEANS moves both sides
 * together and is invisible here.
 *
 * A scattered starting build is beaten by every from-zero seed, which leaves the search's closing
 * `compareFarmCandidates(incumbent, winner)` — the line that actually refuses a worse proposal —
 * untouched. The last case starts from a build that ties the search's own winner, which is the
 * only way in from this file.
 */
import { describe, expect, it } from 'vitest';
import { solveFarmRespec, type FarmRespecInput } from '@bombfarm/domain/farm-optimize';
import {
  farmObjectiveScales,
  farmObjectiveValue,
  resolveFarmObjective,
  type FarmObjective,
} from '@bombfarm/domain/farm-optimize-objective';
import { computeFarmRates } from '@bombfarm/domain/farm-rate';
import { RESPEC_KEYS, reoptBudget } from '@bombfarm/domain/points-reopt-core';
import { DEFAULT_TARGET_PROP } from '@bombfarm/domain/farm-context';
import type { SheetKey } from '@bombfarm/domain/planner-constants';
import type { SheetStats } from '@bombfarm/domain/gear/types';
import type { AccountShared, HeroRecord } from '@bombfarm/domain/shims/storage';
import { mulberry32 } from './helpers/seeded-random';

const MAX_PHASE = 200;

/** An account with nothing bought: an identity skill tree, three House slots, three field slots.
 *  `danoTotal` is a MULTIPLIER, so its untouched value is 1 and not 0. */
const ACCOUNT: AccountShared = {
  tree: { danoTotal: 1, critChance: 0, critDmg: 0, speed: 0, energy: 0, teamCoinPct: 0, luckFlatPct: 0, xpMult: 1 },
  teamBuffs: {},
  context: { houseIdx: 0, houseLevel: 1, phase: 1, mitigationPct: 0, rankMode: 'dps', targetProp: DEFAULT_TARGET_PROP },
  slots: 3,
  fieldSlots: 3,
  houseCycleSecs: 600,
};

function syntheticSheet(rand: () => number, level: number): SheetStats {
  return {
    attack: 40 + level * (2 + rand() * 4),
    energy: 30 + level * (1 + rand() * 2),
    speed: 8 + rand() * 6,
    critChance: rand() * 25,
    critDmg: 40 + rand() * 120,
    penetration: rand() * 10,
    cdr: rand() * 25,
    luck: rand() * 30,
  };
}

/** The whole budget scattered over the eight keys — a starting build with no thought behind it,
 *  which is the one the advisor has to beat. */
function scatteredPoints(rand: () => number, budget: number): Record<SheetKey, number> {
  const pts = Object.fromEntries(RESPEC_KEYS.map((key) => [key, 0])) as Record<SheetKey, number>;
  for (let point = 0; point < budget; point++) {
    pts[RESPEC_KEYS[Math.floor(rand() * RESPEC_KEYS.length)]] += 1;
  }
  return pts;
}

function syntheticRoster(seed: number, levels: readonly number[]): HeroRecord[] {
  const rand = mulberry32(seed);
  return levels.map((level, index) => {
    const naked = syntheticSheet(rand, level);
    return {
      id: `hero${index}`,
      name: `Hero ${index}`,
      updatedAt: index,
      rarity: 'Raro' as const,
      level,
      stars: 3,
      naked,
      loadout: {},
      altLoadout: null,
      gearedOverride: { ...naked },
      abilities: {},
      pts: scatteredPoints(rand, reoptBudget(level)),
      birth: { ...naked },
    };
  });
}

function withProposal(
  heroes: readonly HeroRecord[],
  proposals: ReadonlyMap<string, Record<SheetKey, number>>,
): HeroRecord[] {
  return heroes.map((hero) => {
    const pts = proposals.get(hero.id);
    return pts ? { ...hero, pts: { ...pts } } : hero;
  });
}

/**
 * What a roster scores at whichever phase suits it best, priced from the records alone. Both
 * sides are read against the SAME scales — the starting build's — because a blend whose
 * denominators moved with the proposal would be a different objective on each side.
 */
function bestFeasibleValue(
  heroes: readonly HeroRecord[],
  objective: FarmObjective,
  scales: { goldScale: number; chestScale: number },
): number {
  const resolved = resolveFarmObjective(objective);
  const { rows } = computeFarmRates({ heroes, account: ACCOUNT, maxPhase: MAX_PHASE });
  let best = 0;
  for (const row of rows) {
    if (row.infeasible || row.locked) continue;
    const value = farmObjectiveValue(row, resolved, scales);
    if (Number.isFinite(value) && value > best) best = value;
  }
  return best;
}

function scalesFor(heroes: readonly HeroRecord[]) {
  const { squad } = computeFarmRates({ heroes, account: ACCOUNT, maxPhase: MAX_PHASE });
  return farmObjectiveScales(squad, { maxPhase: MAX_PHASE, exhaustive: true });
}

const UNIT_SCALES = { goldScale: 1, chestScale: 1 };

/** `farmObjectiveValue` reads `row.goldPerHour` verbatim under the gold objective, so the scales
 *  it is handed are not read. */
function bestGoldPerHour(heroes: readonly HeroRecord[]): number {
  return bestFeasibleValue(heroes, { kind: 'gold' }, UNIT_SCALES);
}

function ptsById(entries: readonly { heroId: string; proposedPts: Record<SheetKey, number> }[]) {
  return new Map(entries.map((entry) => [entry.heroId, { ...entry.proposedPts }] as const));
}

/**
 * A build one point away from `proposal` that farms exactly as much gold. Such a build is the only
 * starting point from this file that reaches the search's closing incumbent-versus-winner
 * comparison: the six from-zero seeds do not read the starting vector, so the descent still returns
 * `proposal`, and only the tie-break decides which of two equally good builds the player is told
 * to buy.
 *
 * Two mechanisms make a mate available, and the second is the one that makes it dependable. The
 * step function plateaus the point given up, and the point taken on is usually worth nothing here
 * anyway — a proposal leaves stats at zero whose margin is zero, crit damage at no crit chance
 * being the case these seeds actually find. So the search is not relied on to land exactly on a
 * plateau edge, and the guard below still reports loudly if no mate exists at all.
 */
function findGoldTieMate(heroes: readonly HeroRecord[], proposal: ReadonlyMap<string, Record<SheetKey, number>>) {
  const target = bestGoldPerHour(withProposal(heroes, proposal));
  for (const hero of heroes) {
    const base = proposal.get(hero.id);
    if (!base) continue;
    for (const from of RESPEC_KEYS) {
      if (base[from] < 1) continue;
      for (const to of RESPEC_KEYS) {
        if (from === to) continue;
        const pts = new Map(proposal);
        pts.set(hero.id, { ...base, [from]: base[from] - 1, [to]: base[to] + 1 });
        if (bestGoldPerHour(withProposal(heroes, pts)) === target) {
          return { pts, target, label: `${hero.id} ${from} -> ${to}` };
        }
      }
    }
  }
  return null;
}

function solveAndRescore(heroes: readonly HeroRecord[], objective: FarmRespecInput['objective']) {
  const result = solveFarmRespec({ heroes, account: ACCOUNT, objective, maxPhase: MAX_PHASE });
  const proposals = new Map(result.heroes.map((hero) => [hero.heroId, hero.proposedPts] as const));
  const scales = scalesFor(heroes);
  const target = objective ?? { kind: 'gold' as const };
  return {
    result,
    before: bestFeasibleValue(heroes, target, scales),
    after: bestFeasibleValue(withProposal(heroes, proposals), target, scales),
  };
}

/** Level IS the respec budget (`reoptBudget`), so a roster's levels are its budgets. */
const BUDGET_TIERS: readonly (readonly number[])[] = [
  [8, 8, 8],
  [25, 18],
  [60, 45, 30],
  [120, 90, 70, 40],
  [200, 150, 100],
];

const SEEDS = [0xb0a7, 0x5011d];

describe('the proposed allocation farms at least as well as the starting one', () => {
  for (const levels of BUDGET_TIERS) {
    const budget = levels.reduce((sum, level) => sum + reoptBudget(level), 0);
    for (const seed of SEEDS) {
      it(`${levels.length} heroes, ${budget} points to place, seed 0x${seed.toString(16)}`, () => {
        const heroes = syntheticRoster(seed, levels);
        const { result, before, after } = solveAndRescore(heroes, { kind: 'gold' });

        expect(result.outcome).not.toBe('allDegenerate');
        expect(before).toBeGreaterThan(0);
        expect(result.proposedObjective).toBeGreaterThanOrEqual(result.currentObjective);
        // The reported pair, which reaches the panel through `goldChestReadout` rather than
        // through the phase argmax the objective is picked on, must not disagree in sign.
        expect(
          result.proposedGoldPerHour,
          `reported pair: ${result.currentGoldPerHour} -> ${result.proposedGoldPerHour} gold/hr`,
        ).toBeGreaterThanOrEqual(result.currentGoldPerHour);
        expect(after, `re-priced best gold/hr: ${before} before, ${after} after`).toBeGreaterThanOrEqual(before);
      });
    }
  }
});

describe('non-worsening holds in whichever currency was asked for', () => {
  const levels = [60, 45, 30];
  const objectives: FarmObjective[] = [{ kind: 'chests' }, { kind: 'blend', weight: 0.5 }, { kind: 'blend', weight: 0.2 }];

  for (const objective of objectives) {
    it(`${objective.kind}${objective.weight === undefined ? '' : ` at weight ${objective.weight}`}`, () => {
      const heroes = syntheticRoster(SEEDS[0], levels);
      const { result, before, after } = solveAndRescore(heroes, objective);

      expect(before).toBeGreaterThan(0);
      expect(result.proposedObjective).toBeGreaterThanOrEqual(result.currentObjective);
      expect(after, `re-priced objective: ${before} before, ${after} after`).toBeGreaterThanOrEqual(before);
    });
  }
});

describe('re-solving an accepted proposal finds nothing left to move', () => {
  it('the second solve keeps the build the first one proposed', () => {
    const heroes = syntheticRoster(SEEDS[1], [60, 45, 30]);
    const first = solveFarmRespec({ heroes, account: ACCOUNT, maxPhase: MAX_PHASE });
    expect(first.outcome).toBe('improved');

    const accepted = withProposal(heroes, ptsById(first.heroes));
    const second = solveFarmRespec({ heroes: accepted, account: ACCOUNT, maxPhase: MAX_PHASE });

    expect(second.keptCurrent).toBe(true);
    expect(second.gainPct).toBe(0);
    expect(second.currentObjective).toBeGreaterThanOrEqual(first.currentObjective);

    const before = bestGoldPerHour(accepted);
    const after = bestGoldPerHour(withProposal(accepted, ptsById(second.heroes)));
    expect(before).toBeGreaterThan(0);
    expect(after, `re-priced best gold/hr: ${before} before, ${after} after`).toBeGreaterThanOrEqual(before);
  });
});

describe('a build the search cannot beat is kept, not respecced for nothing', () => {
  for (const seed of SEEDS) {
    it(`no respec gold is advised for zero gain, seed 0x${seed.toString(16)}`, () => {
      const heroes = syntheticRoster(seed, [120, 90, 70, 40]);
      const opening = solveFarmRespec({ heroes, account: ACCOUNT, maxPhase: MAX_PHASE });
      const tie = findGoldTieMate(heroes, ptsById(opening.heroes));
      expect(
        tie,
        'no single-point move off the proposal ties it any more, so this case no longer reaches the incumbent tie-break and has stopped guarding it',
      ).not.toBeNull();

      const start = withProposal(heroes, tie!.pts);
      expect(bestGoldPerHour(start), `${tie!.label} was supposed to tie ${tie!.target}`).toBe(tie!.target);

      const result = solveFarmRespec({ heroes: start, account: ACCOUNT, maxPhase: MAX_PHASE });
      const moved = result.heroes.filter((hero) => hero.changed).map((hero) => hero.heroId);
      expect(
        moved,
        `advised respeccing ${moved.join(', ')} at ${result.respecCostGold} gold for ${result.proposedObjective - result.currentObjective} more gold/hr`,
      ).toEqual([]);
      expect(result.keptCurrent).toBe(true);
      expect(result.respecCostGold).toBe(0);
      expect(result.outcome).toBe('nothingToGain');
    });
  }
});
