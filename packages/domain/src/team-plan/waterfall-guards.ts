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
import { SLOTS } from '../gear/catalog';
import type { PointAlloc } from '../gear/types';
import type { InventoryItem } from '../inventory';
import { wikiPhaseLine } from '../phase-wiki';
import { dominates, statsForEntry } from './dominance';
import { evaluateRoster } from './evaluate';
import { eligibleForHero, poolEntryForItem } from './pool';
import { applyMove, loadoutsFromAssignment, type AssignmentState } from './solver-assignment';
import type {
  EvaluateRosterInput,
  FarmContext,
  TeamPlanInput,
  HeroPlanContext,
  RosterEvaluation,
  TeamPlanFarmObjective,
} from './types';

const EPS = 1e-9;

/**
 * The `FarmContext` every roster evaluation scores heroes in — the ONE definition, shared with
 * `solver-search.ts`.
 *
 * A named `targetPhase` replaces the account's own phase AND its mitigation, taken from that
 * phase's wiki row rather than carried over from the save: mitigation is a property of the phase
 * being fought, so scoring damage at phase 400 with phase 151's mitigation would answer neither
 * question. Without one this is the account exactly as the save reports it.
 */
export function farmFromAccount(input: TeamPlanInput): FarmContext {
  const targetPhase = input.targetPhase;
  const line = targetPhase != null && Number.isFinite(targetPhase) ? wikiPhaseLine(targetPhase) : undefined;
  return {
    houseIdx: input.account.houseIdx,
    houseLevel: input.account.houseLevel,
    phase: line ? line.phase : input.account.phase,
    mitigationPct: line ? line.mitig * 100 : input.account.mitigationPct,
    cycleSecs: input.account.cycleSecs,
    cycleSecsHouseIdx: input.account.cycleSecsHouseIdx,
    cycleSecsLevel: input.account.cycleSecsLevel,
  };
}

export function evaluateAt(
  contexts: HeroPlanContext[],
  assignment: AssignmentState,
  ptsByHeroId: Record<string, PointAlloc>,
  gearInput: TeamPlanInput,
  itemById: ReadonlyMap<string, InventoryItem>,
  forgeFloor: number,
  farmObjective?: TeamPlanFarmObjective,
): RosterEvaluation {
  const evalInput: EvaluateRosterInput = {
    contexts,
    loadoutsByHeroId: loadoutsFromAssignment(assignment, itemById),
    ptsByHeroId,
    slots: gearInput.account.fieldSlots,
    farm: farmFromAccount(gearInput),
    forgeFloor,
    farmObjective,
    ignoreFieldCrowding: gearInput.ignoreFieldCrowding,
  };
  return evaluateRoster(evalInput);
}

export type PolishDominatedInput = {
  contexts: HeroPlanContext[];
  gearInput: TeamPlanInput;
  itemById: ReadonlyMap<string, InventoryItem>;
  baselineAssignment: AssignmentState;
  planAssignment: AssignmentState;
  currentPts: Record<string, PointAlloc>;
  floor: number;
  farmObjective?: TeamPlanFarmObjective;
};

/**
 * Where the plan is already re-gearing a slot, make it hand over the best piece it could.
 *
 * The search accepts a move only on a strict objective gain, and the gold objective is flat over
 * wide plateaus — hero damage reaches it through an integer hits-to-kill, and Sorte does not reach
 * it at all. So a swap chain that pays for itself elsewhere can leave a hero holding gear another
 * FREE piece beats outright, and the search has no reason to correct it. That is what a player
 * sees as "the optimizer ignored my epic amulet".
 *
 * SUBSTITUTIONS ONLY, NEVER NEW CHORES — unless the run asked for the opposite. Normally only
 * slots the plan is already changing are considered, so this swaps what a chore hands over and
 * never adds one, and a plan that touches no gear stays a plan that touches no gear. Under
 * `ignoreFieldCrowding` the player has asked for every hero to end up geared, so an empty slot
 * becomes fair game too and the new chore is the point rather than a side effect.
 *
 * STILL EVALUATED, because dominance is not monotone in the objective. More energy raises a
 * hero's uptime, and on a field already saturated more uptime raises queue contention and can
 * lower the served fraction. A strictly better piece can therefore score slightly worse, so each
 * substitution is scored and kept only when the objective holds. (Under `ignoreFieldCrowding` that
 * term is gone and the check passes by construction — it is kept because the guard, not the
 * caller's flag, is what makes this pass safe.)
 */
export function polishDominatedPlacements(input: PolishDominatedInput): AssignmentState {
  const { contexts, gearInput, itemById, baselineAssignment, planAssignment, currentPts, floor, farmObjective } = input;
  const optimize = contexts.filter((ctx) => ctx.scope === 'optimize');
  const heroOrder = [...optimize].sort((a, b) => a.heroId.localeCompare(b.heroId));
  const fillEmptySlots = gearInput.ignoreFieldCrowding === true;

  let assignment = planAssignment;
  let best = evaluateAt(contexts, assignment, currentPts, gearInput, itemById, floor, farmObjective).objective;

  for (const ctx of heroOrder) {
    for (const slot of SLOTS) {
      const placedId = assignment.slots[ctx.heroId]?.[slot];
      if (!placedId && !fillEmptySlots) continue;
      // A slot the plan leaves exactly as the player has it today is not this pass's business:
      // improving it would invent a chore the search did not ask for.
      if (placedId && baselineAssignment.slots[ctx.heroId]?.[slot] === placedId) continue;
      const placed = placedId ? itemById.get(placedId) : null;
      if (placedId && !placed?.slot) continue;
      // An empty slot compares as an item that rolls nothing, so every eligible piece beats it.
      const placedStats = placed ? statsForEntry(poolEntryForItem(placed, floor)) : new Map<string, number>();

      let winner: { itemId: string; stats: ReadonlyMap<string, number> } | null = null;
      for (const freeId of [...assignment.pool].sort()) {
        const free = itemById.get(freeId);
        if (!free?.slot) continue;
        const entry = poolEntryForItem(free, floor);
        if (!eligibleForHero(entry, ctx, slot)) continue;
        const stats = statsForEntry(entry);
        if (!dominates(stats, placedStats)) continue;
        if (winner && !dominates(stats, winner.stats)) continue;
        winner = { itemId: freeId, stats };
      }
      if (!winner) continue;

      const swapped = applyMove(assignment, { kind: 'assign', itemId: winner.itemId, heroId: ctx.heroId, slot });
      const objective = evaluateAt(contexts, swapped, currentPts, gearInput, itemById, floor, farmObjective).objective;
      if (objective < best - EPS) continue;
      assignment = swapped;
      best = objective;
    }
  }

  return assignment;
}

export type AcceptedRespec = {
  ptsByHeroId: Record<string, PointAlloc>;
  objective: number;
  acceptedHeroIds: string[];
  /**
   * Marginal ROSTER objective gain at the moment each hero was accepted (`bestObjective - base`
   * at that iteration of the greedy loop). Keyed by heroId. Display-only — feeds
   * `pointResets[].rosterGainObjective`, never the objective or the accept decision itself.
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
  farmObjective?: TeamPlanFarmObjective,
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
      const evaluation = evaluateAt(contexts, assignment, trial, gearInput, itemById, floor, farmObjective);
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
  farmObjective?: TeamPlanFarmObjective;
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
    farmObjective,
  } = input;
  const floor = gearInput.forgeFloor;
  // Kept for the caller (buildWaterfall derives `requiresFullPlan` / `gearDipDps` from it) —
  // option B no longer uses it to discard a candidate here (see the docstring above).
  const todayEvaluation = evaluateAt(contexts, baselineAssignment, currentPts, gearInput, itemById, 0, farmObjective);
  const sameAssignment = assignmentsMatch(baselineAssignment, planAssignment);

  // Polished per candidate, not once: dominance is compared at `effectiveUpgrade`, which the two
  // move-bearing candidates read at different floors. The two baseline candidates are deliberately
  // left alone — they are the "change no gear" arms, and polishing one would give it chores.
  const polishedFor = (candidateFloor: number): AssignmentState =>
    polishDominatedPlacements({
      contexts,
      gearInput,
      itemById,
      baselineAssignment,
      planAssignment,
      currentPts,
      floor: candidateFloor,
      farmObjective,
    });

  const declared: GearCandidate[] = [{ key: 'none', assignment: baselineAssignment, floor: 0 }];
  if (floor > 0) declared.push({ key: 'forgeOnly', assignment: baselineAssignment, floor });
  if (!sameAssignment) declared.push({ key: 'movesOnly', assignment: polishedFor(0), floor: 0 });
  if (floor > 0 && !sameAssignment) declared.push({ key: 'forgeMoves', assignment: polishedFor(floor), floor });

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
      farmObjective,
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
      farmObjective,
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
