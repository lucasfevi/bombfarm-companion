/**
 * The farm-respec search internals: constants, the six canonical seeds, the total tie-break
 * comparator, the share-ladder move family, and the coordinate-descent sweep. Split out of
 * `farm-optimize.ts` mirroring the shipped `points-reopt{,-core,-search}.ts` split — these are
 * internals, not part of the published contract (`farm-optimize.ts` re-exports only the
 * constants below, never the search machinery itself).
 */
import { generateMoves, REOPT_FULL_MAX_SWEEPS } from './points-reopt-search';
import { REOPT_KEYS } from './points-reopt-core';
import { squadFactsFromBases, type HeroFarmBasis, type SquadFarmFacts, type FarmRateOptions } from './farm-rate';
import { bestFarmPhase, type FarmObjectiveScales, type FarmPhasePick, type ResolvedFarmObjective } from './farm-optimize-objective';
import type { SheetKey } from './planner-constants';
import type { AccountShared } from './shims/storage';

const EPS_REL = 1e-9;

/** Outer coordinate-descent sweep bound. */
export const FARM_OPT_MAX_SWEEPS = 8;
/** Every N-th phase is probed by Tier 1's CANDIDATE sweeps (never the current build's). */
export const FARM_OPT_GATE_PHASE_STRIDE = 5;
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
/** Evaluation bound for the whole Tier 1 gate. */
export const FARM_OPT_GATE_MAX_EVALUATIONS = 64;
/** Evaluation bound for the whole Tier 2 call — joint solve plus every frontier re-solve. */
export const FARM_OPT_FULL_MAX_EVALUATIONS = 8_000;
/** Share of the Tier 2 bound reserved for the joint solve; the rest funds the frontier. */
export const FARM_OPT_JOINT_BUDGET_SHARE = 0.5;

export type PtsAssignment = ReadonlyMap<string, Record<SheetKey, number>>;

export type FarmCandidate = {
  name: string;
  assignment: PtsAssignment;
  value: number;
  pick: FarmPhasePick | null;
  squad: SquadFarmFacts;
};

/** ONE evaluation — the budget's unit: squad facts for a whole candidate assignment (zero
 *  pipeline calls), then the phase argmax over it. `value` is `-Infinity` when nothing is
 *  feasible under this assignment, never `NaN`. */
export function evaluateAssignment(
  bases: readonly HeroFarmBasis[],
  assignment: PtsAssignment | null,
  account: AccountShared,
  objective: ResolvedFarmObjective,
  scales: FarmObjectiveScales,
  phaseOptions: FarmRateOptions & { phaseStride?: number },
): { squad: SquadFarmFacts; pick: FarmPhasePick | null; value: number } {
  const squad = squadFactsFromBases(bases, assignment, account);
  const pick = bestFarmPhase(squad, objective, scales, phaseOptions);
  return { squad, pick, value: pick ? pick.value : -Infinity };
}

function pointsMovedTotal(assignment: PtsAssignment, bases: readonly HeroFarmBasis[]): number {
  let total = 0;
  for (const basis of bases) {
    const pts = assignment.get(basis.heroId) ?? basis.pts;
    for (const key of REOPT_KEYS) total += Math.abs(pts[key] - basis.pts[key]);
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
  // Plain `<` on the id, NOT localeCompare — locale-dependent ordering would make FRAD-15's
  // determinism claim hold only on the developer's own machine.
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
 * The total tie-break order (`FRAD-15`, design.md §4.6): higher objective value; then fewer
 * points moved from the current vectors; then fewer heroes changed; then lexicographic by
 * `(heroId ascending, REOPT_KEYS declaration order)`. `compare(a, b) < 0` means `a` wins.
 */
export function compareFarmCandidates(a: FarmCandidate, b: FarmCandidate, bases: readonly HeroFarmBasis[]): number {
  if (a.value > b.value * (1 + EPS_REL)) return -1;
  if (b.value > a.value * (1 + EPS_REL)) return 1;

  const aMoved = pointsMovedTotal(a.assignment, bases);
  const bMoved = pointsMovedTotal(b.assignment, bases);
  if (aMoved !== bMoved) return aMoved - bMoved;

  const aChanged = heroesChangedCount(a.assignment, bases);
  const bChanged = heroesChangedCount(b.assignment, bases);
  if (aChanged !== bChanged) return aChanged - bChanged;

  return lexicographicCompare(a.assignment, b.assignment, bases);
}

function pickBestCandidate(candidates: readonly FarmCandidate[], bases: readonly HeroFarmBasis[]): FarmCandidate {
  let best = candidates[0];
  for (let i = 1; i < candidates.length; i++) {
    if (compareFarmCandidates(candidates[i], best, bases) < 0) best = candidates[i];
  }
  return best;
}

/** The six seeds, in this fixed order (design.md §4.4). The `current` vector is always first
 *  and wins ties. Heroes outside the searchable set keep `basis.pts` in every seed. */
const SEED_DEFS: readonly { name: string; energyShare: number | null }[] = [
  { name: 'current', energyShare: null },
  { name: 'allAttack', energyShare: 0 },
  { name: 'e025', energyShare: FARM_OPT_SEED_ENERGY_SHARES[0] },
  { name: 'e050', energyShare: FARM_OPT_SEED_ENERGY_SHARES[1] },
  { name: 'e075', energyShare: FARM_OPT_SEED_ENERGY_SHARES[2] },
  { name: 'allEnergy', energyShare: 1 },
];

function buildSeedAssignment(
  bases: readonly HeroFarmBasis[],
  searchableSet: ReadonlySet<string>,
  budgetById: ReadonlyMap<string, number>,
  energyShare: number | null,
): Map<string, Record<SheetKey, number>> {
  const assignment = new Map<string, Record<SheetKey, number>>();
  if (energyShare === null) return assignment; // 'current': every hero defaults to basis.pts.
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

/** `shareBuild` (design.md §4.5): holds every non-attack/energy key at the incumbent's value and
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
 * same denominator `shareBuild` uses. `0` when the denominator is `0` (design.md §4.7).
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
 * The plateau's `[min, max]` energy-share bounds (design.md §4.7): the maximal CONTIGUOUS run of
 * `ladder` entries containing `winShare`'s own grid neighbourhood whose values are `>= peak x
 * (1 - tolerancePct/100)`, unioned with `winShare` itself. `winShare` always qualifies by
 * construction (its true value IS `peak`), so this never returns an empty or invented range —
 * when no grid neighbour qualifies, `min === max === winShare` (FRAD-26).
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
  evaluations: number;
  sweeps: number;
  budgetExhausted: boolean;
  /** The FINAL sweep's `(share, value)` ladder — the plateau's zero-extra-cost read-out (T8). */
  ladder: readonly { share: number; value: number }[];
};

/**
 * The joint coordinate-descent search (design.md §4.4–§4.6): six seeds, then repeated
 * (share-ladder pass + per-hero local search over `generateMoves()`) sweeps until a sweep
 * accepts nothing. `searchableIds` may be the whole searchable set (the joint solve) or a
 * narrowed subset (T9's frontier re-solves) — same loop either way.
 */
export function runFarmSearch(
  bases: readonly HeroFarmBasis[],
  searchableIds: readonly string[],
  budgetById: ReadonlyMap<string, number>,
  account: AccountShared,
  objective: ResolvedFarmObjective,
  scales: FarmObjectiveScales,
  phaseOptions: FarmRateOptions,
  evaluationBudget: number,
): FarmSearchOutcome {
  const basesById = new Map(bases.map((b) => [b.heroId, b] as const));
  const searchableSet = new Set(searchableIds);
  const moves = generateMoves();

  let evaluations = 0;
  let budgetExhausted = false;

  const seedCandidates: FarmCandidate[] = [];
  for (const seedDef of SEED_DEFS) {
    if (evaluations >= evaluationBudget) {
      budgetExhausted = true;
      break;
    }
    const assignment = buildSeedAssignment(bases, searchableSet, budgetById, seedDef.energyShare);
    const ev = evaluateAssignment(bases, assignment, account, objective, scales, phaseOptions);
    evaluations += 1;
    seedCandidates.push({ name: seedDef.name, assignment, value: ev.value, pick: ev.pick, squad: ev.squad });
  }

  let winner = pickBestCandidate(seedCandidates, bases);
  const winningSeedName = winner.name;

  let sweeps = 0;
  let ladder: { share: number; value: number }[] = [];

  if (!budgetExhausted && searchableIds.length > 0) {
    outer: for (; sweeps < FARM_OPT_MAX_SWEEPS; sweeps++) {
      let improvedThisSweep = false;
      ladder = [];

      // (a) squad-level share-ladder pass — one move family, applied to all of S at once.
      for (const share of FARM_OPT_PLATEAU_SHARES) {
        if (evaluations >= evaluationBudget) {
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

      // (b) per-hero local search, heroes in a fixed order.
      const orderedHeroes = orderSearchableHeroes(searchableIds, budgetById);
      for (const heroId of orderedHeroes) {
        for (let innerSweep = 0; innerSweep < REOPT_FULL_MAX_SWEEPS; innerSweep++) {
          let applied = false;
          for (const move of moves) {
            if (evaluations >= evaluationBudget) {
              budgetExhausted = true;
              break outer;
            }
            const basis = basesById.get(heroId)!;
            const currentHeroPts = winner.assignment.get(heroId) ?? basis.pts;
            const nextPts = move(currentHeroPts);
            if (!nextPts) continue;
            const candAssignment = new Map(winner.assignment);
            candAssignment.set(heroId, nextPts);
            const ev = evaluateAssignment(bases, candAssignment, account, objective, scales, phaseOptions);
            evaluations += 1;
            // FIRST improvement, not best-improvement: a farm probe is a whole phase sweep,
            // roughly 600x a DPS probe, so paying 260 probes to advance one step is the wrong
            // trade at that cost ratio (design.md §4.5).
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

  return { winner, winningSeedName, evaluations, sweeps, budgetExhausted, ladder };
}

export type FarmGateOutcome = {
  winner: FarmCandidate;
  /** The current build's own evaluation, on the FULL phase set — the gate's reference point AND
   *  one of the candidates the comparator picks among. */
  currentEval: { squad: SquadFarmFacts; pick: FarmPhasePick | null; value: number };
  evaluations: number;
};

/**
 * Tier 1's seed stage (design.md §4.8): the CURRENT build is scored on the FULL phase set; every
 * other canonical seed is scored on a phase grid subsampled by `gatePhaseStride`. Subsampling
 * only the candidates means `gainPct` can only be UNDER-stated relative to the true optimum,
 * never over-stated — the lower-bound contract Tier 1 promises. No local search, no ladder —
 * seeds only, `<= 1 + 5` evaluations.
 */
export function runFarmGateSeeds(
  bases: readonly HeroFarmBasis[],
  searchableIds: readonly string[],
  budgetById: ReadonlyMap<string, number>,
  account: AccountShared,
  objective: ResolvedFarmObjective,
  scales: FarmObjectiveScales,
  phaseOptions: FarmRateOptions,
  gatePhaseStride: number,
  evaluationBudget: number,
): FarmGateOutcome {
  const searchableSet = new Set(searchableIds);
  let evaluations = 0;

  const currentEval = evaluateAssignment(bases, null, account, objective, scales, phaseOptions);
  evaluations += 1;

  const candidates: FarmCandidate[] = [
    { name: 'current', assignment: new Map(), value: currentEval.value, pick: currentEval.pick, squad: currentEval.squad },
  ];

  for (const seedDef of SEED_DEFS) {
    if (seedDef.energyShare === null) continue; // 'current' is already evaluated above, at full resolution.
    if (evaluations >= evaluationBudget) break;
    const assignment = buildSeedAssignment(bases, searchableSet, budgetById, seedDef.energyShare);
    const ev = evaluateAssignment(bases, assignment, account, objective, scales, { ...phaseOptions, phaseStride: gatePhaseStride });
    evaluations += 1;
    candidates.push({ name: seedDef.name, assignment, value: ev.value, pick: ev.pick, squad: ev.squad });
  }

  const winner = pickBestCandidate(candidates, bases);
  return { winner, currentEval, evaluations };
}
