/**
 * The waterfall's decision guards. `buildWaterfall` (`waterfall.ts`) used to only *report*
 * today → forged → moved → respec; nothing stopped a chore (forge, move, or point reset) whose
 * ROSTER-level DPS delta was negative from being listed anyway — the bug this file fixes.
 *
 * Per-hero DPS drops are explicitly still allowed: one hero losing DPS while another gains more
 * is a valid plan. The invariant enforced here is at the ROSTER level, per step, by construction.
 *
 * Split out of `waterfall.ts` to keep files small and the decision logic independently testable.
 */
import type { PointAlloc } from '../gear/types';
import type { InventoryItem } from '../inventory';
import { evaluateRoster } from './evaluate';
import { loadoutsFromAssignment, type AssignmentState } from './solver-assignment';
import type {
  EvaluateRosterInput,
  FarmContext,
  TeamPlanInput,
  HeroPlanContext,
  RosterEvaluation,
} from './types';

const EPS = 1e-9;

export function farmFromAccount(input: TeamPlanInput): FarmContext {
  return {
    houseIdx: input.account.houseIdx,
    houseLevel: input.account.houseLevel,
    phase: input.account.phase,
    mitigationPct: input.account.mitigationPct,
  };
}

export function evaluateAt(
  contexts: HeroPlanContext[],
  assignment: AssignmentState,
  ptsByHeroId: Record<string, PointAlloc>,
  gearInput: TeamPlanInput,
  itemById: ReadonlyMap<string, InventoryItem>,
  forgeFloor: number,
): RosterEvaluation {
  const evalInput: EvaluateRosterInput = {
    contexts,
    loadoutsByHeroId: loadoutsFromAssignment(assignment, itemById),
    ptsByHeroId,
    slots: gearInput.account.slots,
    farm: farmFromAccount(gearInput),
    forgeFloor,
  };
  return evaluateRoster(evalInput);
}

export type AcceptedRespec = {
  ptsByHeroId: Record<string, PointAlloc>;
  objective: number;
  acceptedHeroIds: string[];
  /**
   * Marginal ROSTER objective gain at the moment each hero was accepted (`bestObjective - base`
   * at that iteration of the greedy loop). Keyed by heroId. Display-only — feeds
   * `pointResets[].rosterGainDps`, never the objective or the accept decision itself.
   */
  gainByHeroId: Record<string, number>;
  /** Full roster evaluation for the final accepted vector — avoids a caller-side recompute. */
  evaluation: RosterEvaluation;
};

function ptsChanged(a: PointAlloc, b: PointAlloc): boolean {
  return (Object.keys(a) as (keyof PointAlloc)[]).some((key) => a[key] !== b[key]);
}

/**
 * Greedy per-hero accept against the ROSTER objective — the validated core fix. The old code
 * filtered resets on each hero's own `sustained`, but the roster objective in the saturated
 * regime is duty-weighted `active`, not `sustained`: a hero can gain `sustained` while the
 * roster loses. This accepts one hero's final points at a time, keeping only the heroes whose
 * addition raises the ROSTER objective, so `objective` here never drops below `gearEvaluation`.
 */
export function acceptPointResets(
  contexts: HeroPlanContext[],
  assignment: AssignmentState,
  currentPts: Record<string, PointAlloc>,
  finalPtsByHeroId: Record<string, PointAlloc>,
  gearInput: TeamPlanInput,
  itemById: ReadonlyMap<string, InventoryItem>,
  floor: number,
  gearEvaluation: RosterEvaluation,
): AcceptedRespec {
  const accepted: Record<string, PointAlloc> = { ...currentPts };
  let base = gearEvaluation.objective;
  let baseEvaluation = gearEvaluation;
  const acceptedHeroIds: string[] = [];
  const gainByHeroId: Record<string, number> = {};

  let pending = contexts
    .filter((ctx) => ctx.scope === 'optimize')
    .map((ctx) => ctx.heroId)
    .filter((heroId) => {
      const finalPts = finalPtsByHeroId[heroId];
      const curr = currentPts[heroId];
      return Boolean(finalPts && curr && ptsChanged(finalPts, curr));
    })
    .sort((a, b) => a.localeCompare(b));

  while (pending.length > 0) {
    let bestHero: string | null = null;
    let bestObjective = base;
    let bestEvaluation = baseEvaluation;
    for (const heroId of pending) {
      const trial = { ...accepted, [heroId]: finalPtsByHeroId[heroId] };
      const evaluation = evaluateAt(contexts, assignment, trial, gearInput, itemById, floor);
      if (evaluation.objective > bestObjective + EPS) {
        bestObjective = evaluation.objective;
        bestEvaluation = evaluation;
        bestHero = heroId;
      }
    }
    if (!bestHero) break;
    accepted[bestHero] = finalPtsByHeroId[bestHero];
    acceptedHeroIds.push(bestHero);
    gainByHeroId[bestHero] = bestObjective - base;
    base = bestObjective;
    baseEvaluation = bestEvaluation;
    pending = pending.filter((heroId) => heroId !== bestHero);
  }

  return {
    ptsByHeroId: accepted,
    objective: base,
    acceptedHeroIds,
    gainByHeroId,
    evaluation: baseEvaluation,
  };
}

export type GearCandidate = {
  key: 'none' | 'forgeOnly' | 'movesOnly' | 'forgeMoves';
  assignment: AssignmentState;
  floor: number;
};

export type ChooseGearCandidateInput = {
  contexts: HeroPlanContext[];
  gearInput: TeamPlanInput;
  itemById: ReadonlyMap<string, InventoryItem>;
  baselineAssignment: AssignmentState;
  planAssignment: AssignmentState;
  currentPts: Record<string, PointAlloc>;
  finalPtsByHeroId: Record<string, PointAlloc>;
  rosterHeroIds: ReadonlySet<string>;
};

export type ChosenGear = {
  candidate: GearCandidate;
  gearEvaluation: RosterEvaluation;
  respec: AcceptedRespec;
  todayEvaluation: RosterEvaluation;
};

function itemLocationEntries(assignment: AssignmentState): [string, string][] {
  const out: [string, string][] = [...assignment.pool].sort().map((id) => [id, 'pool']);
  for (const heroId of Object.keys(assignment.slots).sort()) {
    const slots = assignment.slots[heroId];
    for (const slot of Object.keys(slots).sort()) {
      const itemId = slots[slot];
      if (itemId) out.push([itemId, `${heroId}|${slot}`]);
    }
  }
  return out;
}

function assignmentsMatch(a: AssignmentState, b: AssignmentState): boolean {
  return JSON.stringify(itemLocationEntries(a)) === JSON.stringify(itemLocationEntries(b));
}

/** Lightweight chore count for the tie-break only — the real lists are built in `waterfall.ts`. */
function chorCount(
  gearInput: TeamPlanInput,
  rosterHeroIds: ReadonlySet<string>,
  baseline: AssignmentState,
  candidate: GearCandidate,
): number {
  let forgeCount = 0;
  if (candidate.floor > 0) {
    for (const item of gearInput.inventory) {
      if (!item.defResolved || item.marketBlocked) continue;
      if (item.equippedBy && !rosterHeroIds.has(item.equippedBy)) continue;
      if (item.upgrade >= candidate.floor) continue;
      forgeCount += 1;
    }
  }
  const before = new Map(itemLocationEntries(baseline));
  const after = new Map(itemLocationEntries(candidate.assignment));
  const ids = new Set([...before.keys(), ...after.keys()]);
  let moveCount = 0;
  for (const id of ids) {
    if ((before.get(id) ?? 'pool') !== (after.get(id) ?? 'pool')) moveCount += 1;
  }
  return forgeCount + moveCount;
}

/**
 * Joint forge+moves decision. Do NOT reject forging on its isolated step delta — forging can be
 * net-negative alone yet unlock a move that is net-positive on top of it; deciding on the
 * isolated delta was root cause 4 of the original bug. Compare end states instead.
 *
 * All four candidates compete on `respec.objective` alone — a candidate is NOT discarded for
 * having a `gearEvaluation` below today. The intermediate gear state MAY sit below today because
 * it is transient: the player climbs back out once the accompanying point resets land. The
 * caller (`buildWaterfall`) surfaces that as `requiresFullPlan` / `gearDipDps` so the plan
 * discloses it rather than hiding it. Two guarantees still hold unconditionally: the final
 * (respec) objective is never below today — the `none` candidate (gearEvaluation === today,
 * respec only improves) is always in the running — and the respec step's own delta is never
 * negative, because `acceptPointResets` only accepts heroes that raise the roster objective.
 *
 * Known, bounded approximation: `planAssignment` was searched under the solver's own drifted
 * point vectors, but candidates are compared here at `currentPts`. This can occasionally reject
 * a move that would have paid off after the respec. Do not "fix" this by comparing at solver
 * points instead.
 */
export function chooseGearCandidate(input: ChooseGearCandidateInput): ChosenGear {
  const {
    contexts,
    gearInput,
    itemById,
    baselineAssignment,
    planAssignment,
    currentPts,
    finalPtsByHeroId,
    rosterHeroIds,
  } = input;
  const floor = gearInput.forgeFloor;
  // Kept for the caller (buildWaterfall derives `requiresFullPlan` / `gearDipDps` from it) —
  // option B no longer uses it to discard a candidate here (see the docstring above).
  const todayEvaluation = evaluateAt(contexts, baselineAssignment, currentPts, gearInput, itemById, 0);
  const sameAssignment = assignmentsMatch(baselineAssignment, planAssignment);

  const declared: GearCandidate[] = [{ key: 'none', assignment: baselineAssignment, floor: 0 }];
  if (floor > 0) declared.push({ key: 'forgeOnly', assignment: baselineAssignment, floor });
  if (!sameAssignment) declared.push({ key: 'movesOnly', assignment: planAssignment, floor: 0 });
  if (floor > 0 && !sameAssignment) declared.push({ key: 'forgeMoves', assignment: planAssignment, floor });

  type Evaluated = { candidate: GearCandidate; gearEvaluation: RosterEvaluation; respec: AcceptedRespec };
  // Every declared candidate is scored — none is discarded on its own `gearEvaluation` (option B:
  // the gear step may transiently dip below today; see the docstring above and `buildWaterfall`,
  // which turns any dip on the winner into `requiresFullPlan` / `gearDipDps` disclosure).
  const evaluated: Evaluated[] = [];

  for (const candidate of declared) {
    const gearEvaluation = evaluateAt(
      contexts,
      candidate.assignment,
      currentPts,
      gearInput,
      itemById,
      candidate.floor,
    );
    const respec = acceptPointResets(
      contexts,
      candidate.assignment,
      currentPts,
      finalPtsByHeroId,
      gearInput,
      itemById,
      candidate.floor,
      gearEvaluation,
    );
    evaluated.push({ candidate, gearEvaluation, respec });
  }

  // `declared` always includes 'none', so `evaluated` is never empty.
  let winner = evaluated[0];
  for (const entry of evaluated.slice(1)) {
    if (entry.respec.objective > winner.respec.objective + EPS) {
      winner = entry;
    } else if (Math.abs(entry.respec.objective - winner.respec.objective) <= EPS) {
      const entryChores = chorCount(gearInput, rosterHeroIds, baselineAssignment, entry.candidate);
      const winnerChores = chorCount(gearInput, rosterHeroIds, baselineAssignment, winner.candidate);
      // Tie-break 2 (declaration order) needs no code: ties keep `winner`, and `declared`/
      // `evaluated` are already in declaration order, so the earlier candidate wins by default.
      if (entryChores < winnerChores) winner = entry;
    }
  }

  return {
    candidate: winner.candidate,
    gearEvaluation: winner.gearEvaluation,
    respec: winner.respec,
    todayEvaluation,
  };
}
