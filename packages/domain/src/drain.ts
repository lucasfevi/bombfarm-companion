/** Per-source cap on the drain-reduction fraction a single term can contribute. */
export const DRAIN_REDUCTION_CAP = 0.2;

/** Combined drain rate never falls below this, in energy/s. */
export const DRAIN_RATE_FLOOR = 0.6;

function reductionFromMult(mult: number): number {
  return Math.min(DRAIN_REDUCTION_CAP, Math.max(0, 1 - mult));
}

/**
 * Combines a hero's own drain-reduction multiplier (Bateria Extra) with the team aura's
 * (Fôlego de Mineiro) into one drain rate. Measured to be additive, not multiplicative: a hero
 * holding both at their 20%-per-source caps drains at 1 − 0.20 − 0.20 = 0.60/s, not the
 * 0.80 × 0.80 = 0.64/s the old multiplicative combination gave.
 */
export function combineDrainRate(selfDrainMult: number, teamDrainMult: number): number {
  const selfReduction = reductionFromMult(selfDrainMult);
  const auraReduction = reductionFromMult(teamDrainMult);
  return Math.max(DRAIN_RATE_FLOOR, 1 - selfReduction - auraReduction);
}
