/**
 * Ranks the next stat point by its marginal effect on the FARM objective — the counterpart to
 * `model/points-rank.ts`'s DPS ranker, for the mode that scores against the rotation, not one
 * hero's damage.
 *
 * WHY THIS CANNOT LIVE INSIDE THE ADVISOR PIPELINE: `computeAdvisorPipeline` computes one hero's
 * advice. Farm ranking needs the marginal objective over the WHOLE rotation pool at the
 * objective's own best phase — a fundamentally different input shape, not a mode flag. If this
 * scorer called back into the pipeline (directly, or through `computeHeroFarmBases` →
 * `pipelineForHero` → `computeAdvisorPipeline`), and the pipeline in turn called this scorer,
 * every farm rank would re-enter the pipeline once per pool hero, and each of those would
 * re-enter it again — unbounded recursion, not a performance concern. So this module is a PURE
 * scorer that consumes already-extracted `HeroFarmBasis[]` (one pipeline call per pool hero,
 * paid once by the caller) and makes ZERO pipeline calls of its own. `farm-point-rank-guards.test.ts`
 * enforces both the import boundary and the pipeline-call budget as a regression guard, not just
 * a design note.
 */
import { squadFactsFromBases, type HeroFarmBasis } from './farm-rate';
import type { ReturnBonusMode } from './farm-rate';
import {
  resolveFarmObjective,
  bestFarmPhase,
  farmObjectiveScales,
  type FarmObjective,
  type ResolvedFarmObjective,
  type FarmObjectiveScales,
} from './farm-optimize-objective';
import { RANK_STATS, STAT_LABELS, type PointValue } from './model';
import type { SheetKey } from './planner-constants';
import type { AccountShared } from './shims/storage';

export { computeHeroFarmBases, type HeroFarmBasis } from './farm-rate';

/**
 * Sweeps spent by one call: 1 baseline + 7 candidates, plus 2 more only under a `'blend'`
 * objective (the frozen gold/chest normalizers). Exported and asserted so this can never quietly
 * become a per-candidate re-solve or a second phase sweep per key.
 */
export const FARM_RANK_MAX_EVALUATIONS = 10;

/** Never read: `farmObjectiveValue`'s `'gold'`/`'chests'` branches ignore scales entirely. */
const UNIT_SCALES: FarmObjectiveScales = { goldScale: 1, chestScale: 1 };

export type FarmPointRankOutcome =
  | 'ranked' // rows is a full 7-entry ranking
  | 'emptyPool' // bases is empty
  | 'heroNotInPool' // heroId names no basis — a caller error, reported not thrown
  | 'allDegenerate' // every basis is degenerate at its own current points
  | 'noBaseline'; // no feasible phase, or the baseline objective is <= 0 / non-finite

export type FarmPointRankResult = {
  outcome: FarmPointRankOutcome;
  /** Exactly 7 entries in `RANK_STATS` order, sorted by `gainPct` descending with a stable sort.
   *  `null` for every outcome except `'ranked'` — the caller falls back to its own DPS ranking
   *  rather than being handed a table of zeros. */
  rows: readonly PointValue[] | null;
  /** The objective's own argmax phase for the CURRENT build — what the gains are measured at.
   *  `null` unless `'ranked'`. */
  phase: number | null;
  /** The resolved objective, echoed so a caller can label the number it renders. */
  objective: ResolvedFarmObjective;
  /** Phase sweeps actually spent. `<= FARM_RANK_MAX_EVALUATIONS`, always. */
  evaluations: number;
};

export type FarmPointRankInput = {
  /** The rotation pool's bases, INCLUDING the ranked hero, in the order the caller wants
   *  summed (squad reductions are float sums, so order is part of the contract). */
  bases: readonly HeroFarmBasis[];
  account: AccountShared;
  /** The hero whose next point is being ranked. Must appear in `bases`. */
  heroId: string;
  /** Default `{ kind: 'gold' }`. */
  objective?: FarmObjective | null;
  /** null / non-positive / non-finite ⇒ every phase in [1, 600]. */
  maxPhase?: number | null;
  /** Default `'off'`, matching the estimator and the Farm board. */
  returnBonus?: ReturnBonusMode;
};

function emptyResult(
  outcome: FarmPointRankOutcome,
  objective: ResolvedFarmObjective,
  evaluations: number,
): FarmPointRankResult {
  return { outcome, rows: null, phase: null, objective, evaluations };
}

/** Pure. Never throws. ZERO pipeline calls — it consumes bases, it does not extract them. */
export function rankNextPointForFarm(input: FarmPointRankInput): FarmPointRankResult {
  const { bases, account, heroId } = input;
  const objective = resolveFarmObjective(input.objective);
  const options = { maxPhase: input.maxPhase, returnBonus: input.returnBonus };

  if (bases.length === 0) return emptyResult('emptyPool', objective, 0);

  const basis = bases.find((b) => b.heroId === heroId);
  if (basis === undefined) return emptyResult('heroNotInPool', objective, 0);

  const currentSquad = squadFactsFromBases(bases, null, account);
  if (currentSquad.heroes.every((hero) => hero.degenerate)) {
    return emptyResult('allDegenerate', objective, 0);
  }

  const scales = objective.kind === 'blend' ? farmObjectiveScales(currentSquad, options) : UNIT_SCALES;
  const scaleEvaluations = objective.kind === 'blend' ? 2 : 0;

  const base = bestFarmPhase(currentSquad, objective, scales, options);
  const baselineEvaluations = scaleEvaluations + 1;
  if (base === null || !(base.value > 0)) {
    return emptyResult('noBaseline', objective, baselineEvaluations);
  }

  const rows: PointValue[] = RANK_STATS.map((stat) => {
    const candidatePts: Record<SheetKey, number> = { ...basis.pts, [stat]: basis.pts[stat] + 1 };
    const candidateSquad = squadFactsFromBases(bases, new Map([[heroId, candidatePts]]), account);
    const pick = bestFarmPhase(candidateSquad, objective, scales, options);
    return {
      stat,
      label: STAT_LABELS[stat],
      gainPct: pick === null ? 0 : (pick.value / base.value - 1) * 100,
    };
  });
  rows.sort((left, right) => right.gainPct - left.gainPct);

  return {
    outcome: 'ranked',
    rows,
    phase: base.phase,
    objective,
    evaluations: baselineEvaluations + RANK_STATS.length,
  };
}
