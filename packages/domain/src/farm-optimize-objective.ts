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
 */
export function farmObjectiveScales(
  squad: SquadFarmFacts,
  options?: FarmRateOptions & { phaseStride?: number },
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

/** `null`/non-positive/non-finite ⇒ every phase in `[1, 600]`; a finite value ⇒ `[1, min(v, 600)]`. */
function resolveUpperPhase(maxPhase: number | null | undefined): number {
  const ceiling = WIKI_PHASE_LINES.length;
  if (maxPhase == null || !Number.isFinite(maxPhase) || maxPhase <= 0) return ceiling;
  return Math.min(ceiling, Math.floor(maxPhase));
}

/** `null`/non-finite/`< 1` ⇒ no subsampling (every phase in range is a candidate). */
function resolveStride(stride: number | null | undefined): number {
  if (stride == null || !Number.isFinite(stride) || stride < 1) return 1;
  return Math.floor(stride);
}

/** `{1, 1+stride, 1+2·stride, …} ∪ {upper}` — the trailing union keeps the range's own ceiling a
 *  candidate even when the stride does not land on it exactly (design.md §4.8's `Pg`). */
function candidatePhases(upper: number, stride: number): number[] {
  const phases: number[] = [];
  for (let phase = 1; phase <= upper; phase += stride) phases.push(phase);
  if (stride > 1 && phases[phases.length - 1] !== upper) phases.push(upper);
  return phases;
}

/**
 * `null`/non-positive/non-finite `maxPhase` is normalized to `null` before it reaches
 * `computeFarmRateRow`, so a row's own `locked` flag agrees with the "no row excluded for being
 * locked" contract: a `maxPhase` of `0`/`-1`/`NaN` means "absent", not "lock everything".
 */
function sanitizeRowOptions(options: (FarmRateOptions & { phaseStride?: number }) | undefined): FarmRateOptions {
  const maxPhase = options?.maxPhase;
  const sanitizedMaxPhase = maxPhase != null && Number.isFinite(maxPhase) && maxPhase > 0 ? maxPhase : null;
  return { returnBonus: options?.returnBonus, maxPhase: sanitizedMaxPhase };
}

/**
 * `argmax` over the candidate phase set of `farmObjectiveValue`, skipping `infeasible` rows
 * and non-finite values — an infeasible phase is never recommended regardless of its nominal
 * rate. Ties keep the LOWER phase — a lower phase is already unlocked and cheaper to hold.
 * `null` when nothing is feasible.
 */
export function bestFarmPhase(
  squad: SquadFarmFacts,
  objective: ResolvedFarmObjective,
  scales: FarmObjectiveScales,
  options?: FarmRateOptions & { phaseStride?: number },
): FarmPhasePick | null {
  const upper = resolveUpperPhase(options?.maxPhase);
  const stride = resolveStride(options?.phaseStride);
  const rowOptions = sanitizeRowOptions(options);

  let best: FarmPhasePick | null = null;
  for (const phase of candidatePhases(upper, stride)) {
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
