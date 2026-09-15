/**
 * The farm objective: what "better" means for the respec solver, and the phase argmax under it.
 *
 * A player farms for gold, for chests, or for some blend of the two. This module resolves that
 * choice into a single scalar value per phase row (`farmObjectiveValue`) and picks the best
 * feasible phase for a given squad under it (`bestFarmPhase`). Neither function ever throws —
 * every input, however malformed, resolves to a total, defined answer.
 */
import { computeFarmRateRow, type FarmRateOptions, type FarmRateRow, type SquadFarmFacts } from './farm-rate';
import { WIKI_PHASE_LINES } from './phase-wiki';

const EPS_REL = 1e-9;

export type FarmObjectiveKind = 'gold' | 'chests' | 'blend';

/** `weight` applies to `'blend'` only and is the GOLD share: 1 ⇒ gold, 0 ⇒ chests. */
export type FarmObjective = { kind: FarmObjectiveKind; weight?: number };

export type FarmObjectiveUnit = 'goldPerHour' | 'chestsPerHour' | 'normalized';

export type ResolvedFarmObjective = {
  kind: FarmObjectiveKind;
  /** Clamped to `[0, 1]`; non-finite ⇒ 1. Meaningless for `'gold'`/`'chests'`, reported as 1/0. */
  weight: number;
  unit: FarmObjectiveUnit;
};

/**
 * Total function. Unknown `kind` ⇒ `'gold'`. Never throws. Blend at `weight === 1` resolves to
 * the `'gold'` object and at `weight === 0` to the `'chests'` object, so those cases are
 * literally the same objective, not merely equivalent.
 */
export function resolveFarmObjective(objective?: FarmObjective | null): ResolvedFarmObjective {
  const rawKind = objective?.kind;
  const kind: FarmObjectiveKind =
    rawKind === 'gold' || rawKind === 'chests' || rawKind === 'blend' ? rawKind : 'gold';

  const rawWeight = objective?.weight;
  const weight = Number.isFinite(rawWeight) ? Math.min(1, Math.max(0, rawWeight as number)) : 1;

  if (kind === 'gold') return { kind: 'gold', weight: 1, unit: 'goldPerHour' };
  if (kind === 'chests') return { kind: 'chests', weight: 0, unit: 'chestsPerHour' };
  if (weight === 1) return { kind: 'gold', weight: 1, unit: 'goldPerHour' };
  if (weight === 0) return { kind: 'chests', weight: 0, unit: 'chestsPerHour' };
  return { kind: 'blend', weight, unit: 'normalized' };
}

/**
 * The per-objective normalizers, computed ONCE per solve from the CURRENT build's best over the
 * candidate phase set, then frozen. Blend is scale-free because of these — gold/hr is ~10^5 and
 * chests/hr is ~1, so an unnormalized blend would be a gold objective wearing a weight.
 */
export type FarmObjectiveScales = { goldScale: number; chestScale: number };

/**
 * The frozen blend normalizers for a squad: each currency's own best over the candidate phase
 * set, independent of the other. Two sweeps. Reused verbatim by `bestFarmPhase`'s callers who
 * need a `'blend'` objective's scales, and by `farm-optimize.ts`'s own gold/chests read-out —
 * the SAME per-currency scan, not a second copy of it.
 *
 * `exhaustive` propagates to both sweeps. It matters twice over here: these two figures ARE the
 * reported gold/hr and chests/hr, and under `'blend'` they are the normalizer every other value
 * in the solve is divided by, so a screen miss would shift the whole objective rather than one
 * row.
 */
export function farmObjectiveScales(
  squad: SquadFarmFacts,
  options?: BestFarmPhaseOptions,
): FarmObjectiveScales {
  const dummyScales: FarmObjectiveScales = { goldScale: 1, chestScale: 1 };
  const goldPick = bestFarmPhase(squad, resolveFarmObjective({ kind: 'gold' }), dummyScales, options);
  const chestPick = bestFarmPhase(squad, resolveFarmObjective({ kind: 'chests' }), dummyScales, options);
  return {
    goldScale: goldPick ? goldPick.row.goldPerHour : 0,
    chestScale: chestPick ? chestPick.row.chestsPerHour : 0,
  };
}

/** Objective value for one row. UNIT: gold/hr, chests/hr, or dimensionless for `'blend'`. */
export function farmObjectiveValue(
  row: FarmRateRow,
  objective: ResolvedFarmObjective,
  scales: FarmObjectiveScales,
): number {
  if (objective.kind === 'gold') return row.goldPerHour;
  if (objective.kind === 'chests') return row.chestsPerHour;
  const goldTerm = scales.goldScale > 0 ? row.goldPerHour / scales.goldScale : 0;
  const chestTerm = scales.chestScale > 0 ? row.chestsPerHour / scales.chestScale : 0;
  return objective.weight * goldTerm + (1 - objective.weight) * chestTerm;
}

export type FarmPhasePick = { phase: number; value: number; row: FarmRateRow };

/** `exhaustive` forces the linear sweep, giving up the screen-and-refine speedup for an argmax
 *  that is proven rather than screened. Set it on every pick that becomes a REPORTED answer. */
export type BestFarmPhaseOptions = FarmRateOptions & {
  phaseStride?: number;
  exhaustive?: boolean;
  /**
   * One phase to price, instead of an argmax over any candidate set.
   *
   * Deliberately NOT filtered by `maxPhase`: a caller naming a phase is asking what the squad
   * would earn holding it, which is a fair question about a phase the account has not unlocked
   * yet. The row still reports `locked` so the caller can say so.
   */
  pinnedPhase?: number | null;
};

/** `null`/non-positive/non-finite ⇒ every phase in `[1, 600]`; a finite value ⇒ `[1, min(v, 600)]`. */
function resolveUpperPhase(maxPhase: number | null | undefined): number {
  const ceiling = WIKI_PHASE_LINES.length;
  if (maxPhase == null || !Number.isFinite(maxPhase) || maxPhase <= 0) return ceiling;
  return Math.min(ceiling, Math.floor(maxPhase));
}

/** `null`/non-finite/out of `[1, 600]` ⇒ no pin. Fractional values round, matching `wikiPhaseLine`. */
function resolvePinnedPhase(pinnedPhase: number | null | undefined): number | null {
  if (pinnedPhase == null || !Number.isFinite(pinnedPhase)) return null;
  const phase = Math.round(pinnedPhase);
  if (phase < 1 || phase > WIKI_PHASE_LINES.length) return null;
  return phase;
}

/** `null`/non-finite/`< 1` ⇒ no subsampling (every phase in range is a candidate). */
function resolveStride(stride: number | null | undefined): number {
  if (stride == null || !Number.isFinite(stride) || stride < 1) return 1;
  return Math.floor(stride);
}

/** `{1, 1+stride, 1+2·stride, …} ∪ {upper}` — the trailing union keeps the range's own ceiling a
 *  candidate even when the stride does not land on it exactly. */
function candidatePhases(upper: number, stride: number): number[] {
  const phases: number[] = [];
  for (let phase = 1; phase <= upper; phase += stride) phases.push(phase);
  if (stride > 1 && phases[phases.length - 1] !== upper) phases.push(upper);
  return phases;
}

/**
 * A world is ten phases and every one of the wiki's 60 gates is a phase ending in 0, so 1, 11,
 * 21, … are each the first phase after a boss — where the economy steps, and hardest at an act
 * boundary: `hp` holds flat at 5250 across phase 50 while `goldComum` doubles, 188 → 375.
 *
 * That makes the openers a useful SCREEN and nothing more. An opener's own score does not bound
 * its world's peak, so a world whose opener screens low can still hold the global best — measured
 * at 0.5% of randomized squad states, costing up to 1.6% of the objective when it happens. The
 * screen is therefore confined to the search, where a miss only bends the search trajectory;
 * every REPORTED pick passes `exhaustive` and is resolved by the full sweep.
 */
const PHASES_PER_WORLD = 10;

function worldOpenerPhases(upper: number): number[] {
  const phases: number[] = [];
  for (let phase = 1; phase <= upper; phase += PHASES_PER_WORLD) phases.push(phase);
  if (phases[phases.length - 1] !== upper) phases.push(upper);
  return phases;
}

function phasesAroundWorld(center: number, upper: number): number[] {
  const phases: number[] = [];
  const from = Math.max(1, center - PHASES_PER_WORLD);
  const to = Math.min(upper, center + PHASES_PER_WORLD);
  for (let phase = from; phase <= to; phase++) phases.push(phase);
  return phases;
}

/**
 * `null`/non-positive/non-finite `maxPhase` is normalized to `null` before it reaches
 * `computeFarmRateRow`, so a row's own `locked` flag agrees with the "no row excluded for being
 * locked" contract: a `maxPhase` of `0`/`-1`/`NaN` means "absent", not "lock everything".
 */
function sanitizeRowOptions(options: BestFarmPhaseOptions | undefined): FarmRateOptions {
  const maxPhase = options?.maxPhase;
  const sanitizedMaxPhase = maxPhase != null && Number.isFinite(maxPhase) && maxPhase > 0 ? maxPhase : null;
  return {
    returnBonus: options?.returnBonus,
    maxPhase: sanitizedMaxPhase,
    ignoreFieldCrowding: options?.ignoreFieldCrowding,
  };
}

function scanPhases(
  phases: readonly number[],
  squad: SquadFarmFacts,
  objective: ResolvedFarmObjective,
  scales: FarmObjectiveScales,
  rowOptions: FarmRateOptions,
): FarmPhasePick | null {
  let best: FarmPhasePick | null = null;
  for (const phase of phases) {
    const row = computeFarmRateRow(phase, squad, rowOptions);
    if (row === null || row.infeasible) continue;
    const value = farmObjectiveValue(row, objective, scales);
    if (!Number.isFinite(value)) continue;
    if (best === null || value > best.value * (1 + EPS_REL)) {
      best = { phase, value, row };
    }
  }
  return best;
}

/**
 * `argmax` over the candidate phase set of `farmObjectiveValue`, skipping `infeasible` rows
 * and non-finite values — an infeasible phase is never recommended regardless of its nominal
 * rate. Ties keep the LOWER phase — a lower phase is already unlocked and cheaper to hold.
 * `null` when nothing is feasible.
 *
 * At the default stride the sweep is two-stage: screen the world openers, then refine one world
 * either side of the screen's winner. A subsampling `phaseStride`, or `exhaustive`, takes the
 * linear sweep instead.
 *
 * A `pinnedPhase` short-circuits all of that and reads exactly ONE row. It wins over every other
 * option, `exhaustive` included: there is no argmax left to prove once the caller has named the
 * phase, and this is the whole speedup — the sweep is ~96% of what a farm evaluation costs.
 */
export function bestFarmPhase(
  squad: SquadFarmFacts,
  objective: ResolvedFarmObjective,
  scales: FarmObjectiveScales,
  options?: BestFarmPhaseOptions,
): FarmPhasePick | null {
  const rowOptions = sanitizeRowOptions(options);
  const scan = (phases: readonly number[]) => scanPhases(phases, squad, objective, scales, rowOptions);

  const pinned = resolvePinnedPhase(options?.pinnedPhase);
  if (pinned !== null) return scan([pinned]);

  const upper = resolveUpperPhase(options?.maxPhase);
  const stride = resolveStride(options?.phaseStride);

  if (stride > 1 || options?.exhaustive === true) return scan(candidatePhases(upper, stride));

  const screened = scan(worldOpenerPhases(upper));
  // No opener is feasible, so the screen has nothing to refine around — but a phase between two
  // openers still might be, and `null` must mean "nothing feasible anywhere", not "none screened".
  if (screened === null) return scan(candidatePhases(upper, 1));
  // The refine window contains the screened phase itself, so this can only match or beat the
  // screen — no second comparison against it is needed.
  return scan(phasesAroundWorld(screened.phase, upper));
}
