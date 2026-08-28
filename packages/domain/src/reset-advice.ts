/**
 * BSPW4-11 — the sustained-DPS reset-recommendation predicate.
 * Pure; consumes whatever `{ currentDps, reoptDps }` the caller supplies — `computeAdvisorPipeline`
 * feeds it Tier 1's own `findGateCandidate` output (`AC-69`), never an idealised reallocation,
 * so the gate can never promise a gain the optimiser will not deliver.
 */

/** Recommend a points reset when Tier 1 finds at least this % sustained-DPS gain. */
export const RESET_RECOMMEND_DPS_PCT = 1;

/**
 * `ASM-04` — the model's own residual is ~1e-11 relative, ~1e-7 percentage points at realistic
 * DPS magnitudes. `1e-6` sits comfortably above that residue and six orders below anything a
 * player could perceive, so exact-threshold builds are not misclassified by floating-point noise
 * without opening the gate to a false positive.
 */
export const RESET_GATE_EPSILON_PCT = 1e-6;

export type ResetAdviceInput = {
  currentDps: number;
  reoptDps: number;
};

/**
 * `gainPct >= RESET_RECOMMEND_DPS_PCT - RESET_GATE_EPSILON_PCT`. Returns `false` (no advice)
 * for a degenerate `currentDps` (zero, `NaN`, `Infinity`) rather than propagating a nonsensical
 * ratio.
 */
export function shouldRecommendReset(input: ResetAdviceInput): boolean {
  const { currentDps, reoptDps } = input;
  if (!Number.isFinite(currentDps) || currentDps <= 0) return false;
  if (!Number.isFinite(reoptDps)) return false;
  const gainPct = (reoptDps / currentDps - 1) * 100;
  return gainPct >= RESET_RECOMMEND_DPS_PCT - RESET_GATE_EPSILON_PCT;
}
