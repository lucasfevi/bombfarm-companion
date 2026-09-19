/**
 * The farm-respec search internals: constants, the six canonical seeds, the total tie-break
 * comparator, the share-ladder move family, and the coordinate-descent sweep. Split out of
 * `farm-optimize.ts` mirroring the shipped `points-reopt{,-core,-search}.ts` split — these are
 * internals, not part of the published contract (`farm-optimize.ts` re-exports only the
 * constants below, never the search machinery itself).
 */
import { generateMoves, REOPT_FULL_MAX_SWEEPS } from './points-reopt-search';
import { budgetOf, buildCandidateSheet, clampPtsToBudget, greedyWalk, REOPT_KEYS } from './points-reopt-core';
import { sustainedDps } from './model';
import {
  squadFactsFromBases,
  type HeroFarmBasis,
  type SquadFarmAccount,
  type SquadFarmFacts,
} from './farm-rate';
import {
  bestFarmPhase,
  type BestFarmPhaseOptions,
  type FarmObjectiveScales,
  type FarmPhasePick,
  type ResolvedFarmObjective,
} from './farm-optimize-objective';
import type { SheetKey } from './planner-constants';

const EPS_REL = 1e-9;

/** Outer coordinate-descent sweep bound. */
export const FARM_OPT_MAX_SWEEPS = 8;
/** Canonical seed energy shares, in seed order. */
export const FARM_OPT_SEED_ENERGY_SHARES: readonly number[] = [0.25, 0.5, 0.75];
/** The share-ladder move family AND the plateau probe grid: 0, 0.05, … 1.00. */
export const FARM_OPT_PLATEAU_SHARES: readonly number[] = [
  0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 1,
];
/** PERCENT. A share within this much of the optimum is on the plateau. */
export const FARM_OPT_PLATEAU_TOLERANCE_PCT = 1;
/** How many heroes are candidates for each frontier tier. */
export const FARM_OPT_FRONTIER_CANDIDATES = 3;
/** Evaluation bound for the whole Tier 2 call — joint solve plus every frontier re-solve. */
export const FARM_OPT_FULL_MAX_EVALUATIONS = 8_000;
/** Share of the Tier 2 bound reserved for the joint solve; the rest funds the frontier. */
export const FARM_OPT_JOINT_BUDGET_SHARE = 0.5;
/**
 * The transfer sizes above `REOPT_BLOCK_SIZES`' ten, and the whole of a stat, that let one move
 * cross a head-to-kill step. Gold per hour only moves at whole steps, and a step often needs
 * more than ten points moved between two stats at once — every ten-point block on the way drops
 * damage below the step and is refused, so the descent sat in whichever basin it started in.
 * Measured 2026-09-18 on the phase-101 capture, converged: ten-point blocks alone 73.39m gold/h,
 * with these 73.60m, against 73.75m for a descent started from the player's own build.
 */
export const FARM_OPT_STEP_BLOCKS: readonly number[] = [15, 20, 30, 50];
/**
 * What a screened probe costs in evaluation units. The per-hero search prices each probe at the
 * winner's own phase — one row instead of the phase argmax, which is nearly all of an
 * evaluation's cost — and pays for the full argmax only when that row improves. Measured
 * 2026-09-18 on the phase-101 capture: the screened search converged to the same vector in
 * 696 ms where the unscreened one took 3,196 ms.
 */
export const FARM_OPT_SCREEN_COST = 0.2;

export type PtsAssignment = ReadonlyMap<string, Record<SheetKey, number>>;

/** A move in the per-hero neighbourhood. `unplaced` is the hero's budget minus what its vector
 *  currently holds; the transfer families from `generateMoves()` ignore it. */
type SpendMoveFn = (
  pts: Record<SheetKey, number>,
  unplaced: number,
) => Record<SheetKey, number> | null;

export type FarmCandidate = {
  name: string;
  assignment: PtsAssignment;
  value: number;
  pick: FarmPhasePick | null;
  squad: SquadFarmFacts;
};

/** ONE evaluation — the budget's unit: squad facts for a whole candidate assignment (zero
 *  pipeline calls), then the phase argmax over it. `value` is `-Infinity` when nothing is
 *  feasible under this assignment, never `NaN`. A `pinnedPhase` in `phaseOptions` collapses that
 *  argmax to a single row, which is where nearly all of an evaluation's cost sits. */
export function evaluateAssignment(
  bases: readonly HeroFarmBasis[],
  assignment: PtsAssignment | null,
  account: SquadFarmAccount,
  objective: ResolvedFarmObjective,
  scales: FarmObjectiveScales,
  phaseOptions: BestFarmPhaseOptions,
): { squad: SquadFarmFacts; pick: FarmPhasePick | null; value: number } {
  const squad = squadFactsFromBases(bases, assignment, account);
  const pick = bestFarmPhase(squad, objective, scales, phaseOptions);
  return { squad, pick, value: pick ? pick.value : -Infinity };
}

/** The points a reset would have to buy back: every key that ends below where it stands today. */
function pointsRefundedTotal(assignment: PtsAssignment, bases: readonly HeroFarmBasis[]): number {
  let total = 0;
  for (const basis of bases) {
    const pts = assignment.get(basis.heroId) ?? basis.pts;
    for (const key of REOPT_KEYS) total += Math.max(0, basis.pts[key] - pts[key]);
  }
  return total;
}

function pointsPlacedTotal(assignment: PtsAssignment, bases: readonly HeroFarmBasis[]): number {
  let total = 0;
  for (const basis of bases) {
    const pts = assignment.get(basis.heroId) ?? basis.pts;
    for (const key of REOPT_KEYS) total += pts[key];
  }
  return total;
}

function heroesChangedCount(assignment: PtsAssignment, bases: readonly HeroFarmBasis[]): number {
  let count = 0;
  for (const basis of bases) {
    const pts = assignment.get(basis.heroId) ?? basis.pts;
    if (REOPT_KEYS.some((key) => pts[key] !== basis.pts[key])) count++;
  }
  return count;
}

function lexicographicCompare(a: PtsAssignment, b: PtsAssignment, bases: readonly HeroFarmBasis[]): number {
  // Plain `<` on the id, NOT localeCompare — locale-dependent ordering would make the
  // determinism claim below hold only on the developer's own machine.
  const ids = bases.map((basis) => basis.heroId).sort((x, y) => (x < y ? -1 : x > y ? 1 : 0));
  for (const heroId of ids) {
    const basis = bases.find((b) => b.heroId === heroId)!;
    const aPts = a.get(heroId) ?? basis.pts;
    const bPts = b.get(heroId) ?? basis.pts;
    for (const key of REOPT_KEYS) {
      if (aPts[key] !== bPts[key]) return aPts[key] - bPts[key];
    }
  }
  return 0;
}

/**
 * The total tie-break order: higher objective value; then fewer points refunded from the current
 * vectors (a reset is what the player pays for, and an add-only proposal costs nothing); then
 * more points placed (banked points spent beat banked points left); then fewer heroes changed;
 * then lexicographic by `(heroId ascending, REOPT_KEYS declaration order)`. `compare(a, b) < 0`
 * means `a` wins.
 */
export function compareFarmCandidates(a: FarmCandidate, b: FarmCandidate, bases: readonly HeroFarmBasis[]): number {
  if (a.value > b.value * (1 + EPS_REL)) return -1;
  if (b.value > a.value * (1 + EPS_REL)) return 1;

  const aRefunded = pointsRefundedTotal(a.assignment, bases);
  const bRefunded = pointsRefundedTotal(b.assignment, bases);
  if (aRefunded !== bRefunded) return aRefunded - bRefunded;

  const aPlaced = pointsPlacedTotal(a.assignment, bases);
  const bPlaced = pointsPlacedTotal(b.assignment, bases);
  if (aPlaced !== bPlaced) return bPlaced - aPlaced;

  const aChanged = heroesChangedCount(a.assignment, bases);
  const bChanged = heroesChangedCount(b.assignment, bases);
  if (aChanged !== bChanged) return aChanged - bChanged;

  return lexicographicCompare(a.assignment, b.assignment, bases);
}

/**
 * The six seeds, in this fixed order, every one built FROM the budget and none from the build
 * the player has today: a per-hero sustained-DPS greedy walk from zero (the hero-shaped one —
 * its birth stats decide where crit, speed and cooldown points go), then five attack/energy
 * splits. Heroes outside the searchable set keep `basis.pts` in every seed.
 *
 * The current build is deliberately not a seed. Scored raw against these coarse splits it nearly
 * always won, so the descent started from it and — on an objective that only moves at whole
 * head-to-kill steps — stayed there: the same hero was told to keep crit damage when it had
 * spent everything on crit damage, and attack when it had spent everything on attack. It is the
 * incumbent instead (see `runFarmSearch`): the bar a proposal has to clear, never its start.
 */
const SEED_DEFS: readonly { name: string; energyShare: number | null }[] = [
  { name: 'dpsGreedy', energyShare: null },
  { name: 'allAttack', energyShare: 0 },
  { name: 'e025', energyShare: FARM_OPT_SEED_ENERGY_SHARES[0] },
  { name: 'e050', energyShare: FARM_OPT_SEED_ENERGY_SHARES[1] },
  { name: 'e075', energyShare: FARM_OPT_SEED_ENERGY_SHARES[2] },
  { name: 'allEnergy', energyShare: 1 },
];

/**
 * The build the player has today, clamped TO the budget — the one assignment not built FROM it.
 * It is the search's floor, so whatever total it carries is a total the proposal may carry; an
 * over-spent hero would otherwise hand its excess straight to a recommendation the game will not
 * sell. A no-op on any hero spending within its budget, which is every hero real data produces
 * (see `clampPtsToBudget`).
 */
function buildIncumbentAssignment(
  bases: readonly HeroFarmBasis[],
  searchableSet: ReadonlySet<string>,
  budgetById: ReadonlyMap<string, number>,
): Map<string, Record<SheetKey, number>> {
  const assignment = new Map<string, Record<SheetKey, number>>();
  for (const basis of bases) {
    if (!searchableSet.has(basis.heroId)) continue;
    assignment.set(basis.heroId, clampPtsToBudget(basis.pts, budgetById.get(basis.heroId) ?? 0));
  }
  return assignment;
}

/** One hero's sustained-DPS greedy walk from zero over its whole budget — the hero-shaped seed. */
function dpsGreedyFromZero(basis: HeroFarmBasis, budget: number): Record<SheetKey, number> {
  const zero: Record<SheetKey, number> = { ...basis.pts };
  for (const key of REOPT_KEYS) zero[key] = 0;
  const zeroSheet = buildCandidateSheet(basis.effective, basis.pts, basis.effectiveDelta, zero);
  const zeroScore = sustainedDps(zeroSheet, basis.context);
  return greedyWalk(zero, zeroScore, budget, basis.effective, basis.pts, basis.effectiveDelta, basis.context, Infinity).pts;
}

function buildSeedAssignment(
  bases: readonly HeroFarmBasis[],
  searchableSet: ReadonlySet<string>,
  budgetById: ReadonlyMap<string, number>,
  energyShare: number | null,
): Map<string, Record<SheetKey, number>> {
  const assignment = new Map<string, Record<SheetKey, number>>();
  if (energyShare === null) {
    for (const basis of bases) {
      if (!searchableSet.has(basis.heroId)) continue;
      assignment.set(basis.heroId, dpsGreedyFromZero(basis, budgetById.get(basis.heroId) ?? 0));
    }
    return assignment;
  }
  for (const basis of bases) {
    if (!searchableSet.has(basis.heroId)) continue;
    const budget = budgetById.get(basis.heroId) ?? 0;
    const energy = Math.round(budget * energyShare);
    const attack = budget - energy;
    const vector: Record<SheetKey, number> = { ...basis.pts };
    for (const key of REOPT_KEYS) vector[key] = 0;
    vector.attack = attack;
    vector.energy = energy;
    assignment.set(basis.heroId, vector);
  }
  return assignment;
}

/** `shareBuild`: holds every non-attack/energy key at the incumbent's value and
 *  re-splits only the attack+energy pool at the given squad energy share. */
function shareBuild(
  bases: readonly HeroFarmBasis[],
  searchableSet: ReadonlySet<string>,
  incumbent: PtsAssignment,
  budgetById: ReadonlyMap<string, number>,
  share: number,
): Map<string, Record<SheetKey, number>> {
  const next = new Map(incumbent);
  for (const basis of bases) {
    if (!searchableSet.has(basis.heroId)) continue;
    const currentPts = incumbent.get(basis.heroId) ?? basis.pts;
    let fixed = 0;
    for (const key of REOPT_KEYS) {
      if (key === 'attack' || key === 'energy') continue;
      fixed += currentPts[key];
    }
    const budget = budgetById.get(basis.heroId) ?? 0;
    const pool = Math.max(0, budget - fixed);
    const energy = Math.round(pool * share);
    const attack = pool - energy;
    next.set(basis.heroId, { ...currentPts, attack, energy });
  }
  return next;
}

/** Whole pool first: `Infinity` is clamped by `unplaced` like every other size, so it places
 *  everything the hero is holding in one move. */
const SPEND_BLOCKS: readonly number[] = [Infinity, 10, 5, 3, 2, 1];

/**
 * PLACE points the hero has not spent yet — the one thing the transfer neighbourhood cannot do.
 *
 * `generateMoves()` is transfers only, so every vector it reaches carries the total it started
 * from, and `current` is the one seed not built from the budget. Between them, a hero holding
 * banked points had a single route to spending them: a squad-level {@link shareBuild} re-split
 * that must beat the incumbent for the WHOLE searchable set at one energy share. On a roster
 * whose other heroes are already well split that candidate loses, and the banked points go down
 * with it — a level-102 hero holding 52 unplaced points was offered a reshuffle of the 50 it had
 * already spent, sweep after sweep, with nothing anywhere saying the other 52 existed.
 *
 * Ordered whole-pool-first because a farm probe is a phase sweep and the loop takes the FIRST
 * improvement: trying `key += everything` ahead of the block sizes settles the pool in one
 * accepted move and leaves the transfer family to spread it from there.
 */
function generateSpendMoves(): SpendMoveFn[] {
  const moves: SpendMoveFn[] = [];
  for (const blockSize of SPEND_BLOCKS) {
    for (const key of REOPT_KEYS) {
      moves.push((pts, unplaced) => {
        const amount = Math.min(blockSize, unplaced);
        return amount <= 0 ? null : { ...pts, [key]: pts[key] + amount };
      });
    }
  }
  return moves;
}

/**
 * The step-crossing family: the whole of one stat onto another, then blocks of
 * `FARM_OPT_STEP_BLOCKS`, each clamped to what the stat holds and skipped where a ten-point
 * block already covers it. Tried before the fine transfers so a sweep moves coarse to fine.
 */
function generateStepMoves(): SpendMoveFn[] {
  const moves: SpendMoveFn[] = [];
  for (const from of REOPT_KEYS) {
    for (const destination of REOPT_KEYS) {
      if (from === destination) continue;
      moves.push((pts) =>
        pts[from] < 2 ? null : { ...pts, [from]: 0, [destination]: pts[destination] + pts[from] },
      );
    }
  }
  for (const blockSize of FARM_OPT_STEP_BLOCKS) {
    for (const from of REOPT_KEYS) {
      for (const destination of REOPT_KEYS) {
        if (from === destination) continue;
        moves.push((pts) => {
          const amount = Math.min(blockSize, pts[from]);
          return amount <= 10 ? null : { ...pts, [from]: pts[from] - amount, [destination]: pts[destination] + amount };
        });
      }
    }
  }
  return moves;
}

/** `budget` desc, then `heroId` asc (plain `<`) — the fixed per-hero local-search order. */
function orderSearchableHeroes(searchableIds: readonly string[], budgetById: ReadonlyMap<string, number>): string[] {
  return [...searchableIds].sort((a, b) => {
    const budgetDiff = (budgetById.get(b) ?? 0) - (budgetById.get(a) ?? 0);
    if (budgetDiff !== 0) return budgetDiff;
    return a < b ? -1 : a > b ? 1 : 0;
  });
}

/**
 * The squad's aggregate energy share over the searchable set: `Σ energy / Σ pool`, where `pool`
 * is each hero's attack+energy budget after holding every other reallocatable key fixed — the
 * same denominator `shareBuild` uses. `0` when the denominator is `0`.
 */
export function squadEnergyShare(
  bases: readonly HeroFarmBasis[],
  searchableIds: readonly string[],
  budgetById: ReadonlyMap<string, number>,
  assignment: PtsAssignment | null,
): number {
  const basesById = new Map(bases.map((b) => [b.heroId, b] as const));
  let energySum = 0;
  let poolSum = 0;
  for (const heroId of searchableIds) {
    const basis = basesById.get(heroId);
    if (!basis) continue;
    const pts = assignment?.get(heroId) ?? basis.pts;
    let fixed = 0;
    for (const key of REOPT_KEYS) {
      if (key === 'attack' || key === 'energy') continue;
      fixed += pts[key];
    }
    const budget = budgetById.get(heroId) ?? 0;
    const pool = Math.max(0, budget - fixed);
    energySum += pts.energy;
    poolSum += pool;
  }
  return poolSum > 0 ? energySum / poolSum : 0;
}

/**
 * The plateau's `[min, max]` energy-share bounds: the maximal CONTIGUOUS run of
 * `ladder` entries containing `winShare`'s own grid neighbourhood whose values are `>= peak x
 * (1 - tolerancePct/100)`, unioned with `winShare` itself. `winShare` always qualifies by
 * construction (its true value IS `peak`), so this never returns an empty or invented range —
 * when no grid neighbour qualifies, `min === max === winShare` — never null, never an invented
 * width.
 */
export function derivePlateauBounds(
  ladder: readonly { share: number; value: number }[],
  winShare: number,
  peak: number,
  tolerancePct: number,
): { min: number; max: number } {
  if (ladder.length === 0) return { min: winShare, max: winShare };

  const floor = peak * (1 - tolerancePct / 100);
  let nearestIdx = 0;
  let nearestDist = Infinity;
  for (let i = 0; i < ladder.length; i++) {
    const dist = Math.abs(ladder[i].share - winShare);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearestIdx = i;
    }
  }

  let min = winShare;
  let max = winShare;
  if (ladder[nearestIdx].value >= floor) {
    let lo = nearestIdx;
    let hi = nearestIdx;
    while (lo > 0 && ladder[lo - 1].value >= floor) lo--;
    while (hi < ladder.length - 1 && ladder[hi + 1].value >= floor) hi++;
    min = Math.min(min, ladder[lo].share);
    max = Math.max(max, ladder[hi].share);
  }
  return { min, max };
}

export type FarmSearchOutcome = {
  winner: FarmCandidate;
  winningSeedName: string;
  /** Budget units spent: a full evaluation is 1, a screened probe `FARM_OPT_SCREEN_COST`. Never
   *  above the budget the search was given. */
  evaluations: number;
  sweeps: number;
  budgetExhausted: boolean;
  /** The FINAL sweep's `(share, value)` ladder — the plateau's zero-extra-cost read-out (T8). */
  ladder: readonly { share: number; value: number }[];
};

/**
 * The joint coordinate-descent search: the incumbent evaluated once, then six from-zero seeds,
 * then repeated (share-ladder pass + per-hero local search over `generateMoves()`) sweeps from
 * the best seed until a sweep accepts nothing, and finally the incumbent against the result —
 * the proposal is never worse than the build the player has, and on a tie it IS that build.
 * `searchableIds` may be the whole searchable set (the joint solve) or a narrowed subset (T9's
 * frontier re-solves) — same loop either way.
 *
 * The descent never sees the current build: its seeds come from the budget, ties between them
 * fall to seed order, and every move is budget-relative. Two rosters that differ only in how
 * their points sit today are therefore offered the same build, which is what makes the
 * proposal a recommendation rather than an echo.
 */
export function runFarmSearch(
  bases: readonly HeroFarmBasis[],
  searchableIds: readonly string[],
  budgetById: ReadonlyMap<string, number>,
  account: SquadFarmAccount,
  objective: ResolvedFarmObjective,
  scales: FarmObjectiveScales,
  phaseOptions: BestFarmPhaseOptions,
  evaluationBudget: number,
): FarmSearchOutcome {
  const basesById = new Map(bases.map((b) => [b.heroId, b] as const));
  const searchableSet = new Set(searchableIds);
  const moves: SpendMoveFn[] = [...generateSpendMoves(), ...generateStepMoves(), ...generateMoves()];

  let evaluations = 0;
  let budgetExhausted = false;
  const canAfford = (cost: number) => evaluations + cost <= evaluationBudget;

  const incumbentAssignment = buildIncumbentAssignment(bases, searchableSet, budgetById);
  if (evaluationBudget < 1) {
    const squad = squadFactsFromBases(bases, incumbentAssignment, account);
    const incumbent: FarmCandidate = { name: 'current', assignment: incumbentAssignment, value: -Infinity, pick: null, squad };
    return { winner: incumbent, winningSeedName: 'current', evaluations, sweeps: 0, budgetExhausted: true, ladder: [] };
  }
  const incumbentEv = evaluateAssignment(bases, incumbentAssignment, account, objective, scales, phaseOptions);
  evaluations += 1;
  const incumbent: FarmCandidate = {
    name: 'current',
    assignment: incumbentAssignment,
    value: incumbentEv.value,
    pick: incumbentEv.pick,
    squad: incumbentEv.squad,
  };

  let start: FarmCandidate | null = null;
  for (const seedDef of SEED_DEFS) {
    if (!canAfford(1)) {
      budgetExhausted = true;
      break;
    }
    const assignment = buildSeedAssignment(bases, searchableSet, budgetById, seedDef.energyShare);
    const ev = evaluateAssignment(bases, assignment, account, objective, scales, phaseOptions);
    evaluations += 1;
    if (!start || ev.value > start.value * (1 + EPS_REL)) {
      start = { name: seedDef.name, assignment, value: ev.value, pick: ev.pick, squad: ev.squad };
    }
  }

  let winner = start ?? incumbent;

  let sweeps = 0;
  let ladder: { share: number; value: number }[] = [];

  if (start && !budgetExhausted && searchableIds.length > 0) {
    outer: for (; sweeps < FARM_OPT_MAX_SWEEPS; sweeps++) {
      let improvedThisSweep = false;
      ladder = [];

      // (a) squad-level share-ladder pass — one move family, applied to all of S at once.
      for (const share of FARM_OPT_PLATEAU_SHARES) {
        if (!canAfford(1)) {
          budgetExhausted = true;
          break outer;
        }
        const candAssignment = shareBuild(bases, searchableSet, winner.assignment, budgetById, share);
        const ev = evaluateAssignment(bases, candAssignment, account, objective, scales, phaseOptions);
        evaluations += 1;
        ladder.push({ share, value: ev.value });
        if (ev.value > winner.value * (1 + EPS_REL)) {
          winner = { name: winner.name, assignment: candAssignment, value: ev.value, pick: ev.pick, squad: ev.squad };
          improvedThisSweep = true;
        }
      }

      // (b) per-hero local search, heroes in a fixed order. Each probe is screened at the
      // winner's own phase — the phase its value was read at, so the two are comparable — and
      // the argmax runs only for a probe that beats it there. A probe that would win at some
      // other phase is missed here; the ladder pass above sweeps the argmax and is where a
      // squad's damage moves it up a phase.
      const orderedHeroes = orderSearchableHeroes(searchableIds, budgetById);
      for (const heroId of orderedHeroes) {
        for (let innerSweep = 0; innerSweep < REOPT_FULL_MAX_SWEEPS; innerSweep++) {
          let applied = false;
          for (const move of moves) {
            const screening = winner.pick !== null && phaseOptions.pinnedPhase == null;
            if (!canAfford(screening ? FARM_OPT_SCREEN_COST : 1)) {
              budgetExhausted = true;
              break outer;
            }
            const basis = basesById.get(heroId)!;
            const currentHeroPts = winner.assignment.get(heroId) ?? basis.pts;
            const unplaced = Math.max(0, (budgetById.get(heroId) ?? 0) - budgetOf(currentHeroPts));
            const nextPts = move(currentHeroPts, unplaced);
            if (!nextPts) continue;
            const candAssignment = new Map(winner.assignment);
            candAssignment.set(heroId, nextPts);
            if (screening) {
              const pinnedPhase = winner.pick!.phase;
              const screen = evaluateAssignment(bases, candAssignment, account, objective, scales, { ...phaseOptions, pinnedPhase });
              evaluations += FARM_OPT_SCREEN_COST;
              if (!(screen.value > winner.value * (1 + EPS_REL))) continue;
              if (!canAfford(1)) {
                budgetExhausted = true;
                break outer;
              }
            }
            const ev = evaluateAssignment(bases, candAssignment, account, objective, scales, phaseOptions);
            evaluations += 1;
            // FIRST improvement, not best-improvement: a farm probe is a whole phase sweep,
            // roughly 600x a DPS probe, so paying 260 probes to advance one step is the wrong
            // trade at that cost ratio.
            if (ev.value > winner.value * (1 + EPS_REL)) {
              winner = { name: winner.name, assignment: candAssignment, value: ev.value, pick: ev.pick, squad: ev.squad };
              applied = true;
              improvedThisSweep = true;
              break;
            }
          }
          if (!applied) break; // hero is locally optimal.
        }
      }

      if (!improvedThisSweep) break; // converged.
    }
  }

  const final = compareFarmCandidates(incumbent, winner, bases) <= 0 ? incumbent : winner;
  return { winner: final, winningSeedName: final.name, evaluations, sweeps, budgetExhausted, ladder };
}

