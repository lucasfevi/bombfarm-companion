/**
 * The Team Plan's stat-point pass in FARM mode — the counterpart to the DPS pass's per-hero
 * `optimizeBuild`/`findGateCandidate` calls in `solver-search.ts`.
 *
 * ONE JOINT SOLVE, NOT A PER-HERO LOOP. Gold per hour is a rate the whole rotation produces:
 * House allocation, field luck and the phase argmax are all nonlinear in who is present, so one
 * hero's points change what every other hero's points are worth. `runFarmSearch` — the same
 * search the Farm page's respec advisor runs, over the same `HeroFarmBasis[]` — already solves a
 * whole searchable set jointly, with a per-hero coordinate-descent pass inside it. Handing it the
 * scoped heroes at once is therefore both the faithful question and the cheap one; N separate
 * single-hero searches would pay N phase sweeps to answer a question each of them only sees part
 * of. The per-hero entry point `optimizeHeroForFarm` is that same search narrowed to one id.
 *
 * The DPS pass's two tiers do not carry over either: they exist because a gate check budgets its
 * points differently from a full build (`resetBudget` against `reoptBudget`), and the farm search
 * has only the latter — which is exactly the budget the respec advisor gives it.
 *
 * Pure: same arguments, same result, no clock, no `Math.random`, no module-level mutable state.
 */
import { heroFactsFromBasis } from '../farm-rate';
import {
  runFarmSearch,
  FARM_OPT_FULL_MAX_EVALUATIONS,
  FARM_OPT_JOINT_BUDGET_SHARE,
} from '../farm-optimize-search';
import { reoptBudget, REOPT_KEYS } from '../points-reopt-core';
import { FARM_GOLD_OBJECTIVE, FARM_UNREAD_SCALES, farmBasesForBuild } from './farm-objective';
import type { Loadout, PointAlloc } from '../gear/types';
import type { ScoreMemo, TeamPlanFarmObjective } from './types';

/**
 * What one pass may spend, before the plan's own remaining budget is applied on top.
 *
 * The respec advisor's joint-solve share, deliberately the same expression rather than the same
 * number: the two run the identical search over the identical bases, and a pass allowed to look
 * further than the advisor would propose points the advisor cannot reproduce.
 */
export const FARM_POINTS_PASS_MAX_EVALUATIONS = Math.floor(
  FARM_OPT_FULL_MAX_EVALUATIONS * FARM_OPT_JOINT_BUDGET_SHARE,
);

export type FarmPointsPassInput = {
  objective: TeamPlanFarmObjective;
  /** The forge-floored candidate loadouts `evaluateRoster` scores, for the optimize-scope heroes.
   *  A squad hero absent here farms the loadout the objective froze for it. */
  loadoutByHeroId: Readonly<Record<string, Loadout>>;
  ptsByHeroId: Readonly<Record<string, PointAlloc>>;
  memo: ScoreMemo | undefined;
  evaluationBudget: number;
};

export type FarmPointsPassResult = {
  ptsByHeroId: Record<string, PointAlloc>;
  /** Charged to the caller's own budget — a farm search evaluation is a squad reduction plus a
   *  phase argmax, the same shape and the same dominant cost as a farm roster evaluation. */
  evaluations: number;
};

export function farmPointsPass(input: FarmPointsPassInput): FarmPointsPassResult {
  const { objective } = input;
  const nextPts: Record<string, PointAlloc> = { ...input.ptsByHeroId };
  if (input.evaluationBudget <= 0) return { ptsByHeroId: nextPts, evaluations: 0 };

  const bases = farmBasesForBuild(objective, input.loadoutByHeroId, input.ptsByHeroId, input.memo);
  const budgetById = new Map<string, number>();
  const searchableIds: string[] = [];
  bases.forEach((basis, index) => {
    // A hero the estimator cannot rate is pinned to its current build, matching the respec
    // advisor: there is no rate to improve, so any vector the search picked would be arbitrary.
    const movable =
      objective.heroes[index].ctx.scope === 'optimize' &&
      !heroFactsFromBasis(basis, basis.pts).degenerate;
    const budget = movable ? reoptBudget(basis.pts, basis.level) : 0;
    budgetById.set(basis.heroId, budget);
    if (budget > 0) searchableIds.push(basis.heroId);
  });
  if (searchableIds.length === 0) return { ptsByHeroId: nextPts, evaluations: 0 };

  const search = runFarmSearch(
    bases,
    searchableIds,
    budgetById,
    objective.account,
    FARM_GOLD_OBJECTIVE,
    FARM_UNREAD_SCALES,
    objective.phaseOptions,
    input.evaluationBudget,
  );

  for (const basis of bases) {
    const proposed = search.winner.assignment.get(basis.heroId);
    if (!proposed) continue;
    // An equal-scoring reshuffle is not worth a reset the player has to buy, and the search's own
    // tie-break already prefers the current vector — this only refuses to write one back.
    if (!REOPT_KEYS.some((key) => proposed[key] !== basis.pts[key])) continue;
    nextPts[basis.heroId] = { ...proposed, luck: basis.pts.luck };
  }

  return { ptsByHeroId: nextPts, evaluations: search.evaluations };
}
