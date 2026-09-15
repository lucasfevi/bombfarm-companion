/** Damage per rank per ally, as a fraction — the live wiki's `habilidades[].per_level` for
 *  `pack_dmg` (2026-09-13). */
export const MATILHA_PER_RANK_PER_ALLY = 0.005;

/** The ceiling the pack bonus clamps at, as a fraction — the wiki's `combate.pack_dmg_cap`. A
 *  literal, not `max rank × per_level × allies`: no ally count is implied by the cap. */
export const MATILHA_CAP = 0.9;

/**
 * Matilha's damage multiplier for one carrier: `1 + min(cap, rate × allies)`, where `rate` is the
 * carrier's rank × per-rank bonus and `allies` is the number of OTHER heroes on the field beside
 * it. An own ability, not an aura — only the carrier's hits move — but one whose value is a
 * property of the field, which is why the field size reaches the combat multipliers as an input
 * rather than the ability catalog alone deciding it.
 */
export function matilhaMult(packRatePerAlly: number, allies: number): number {
  if (!(packRatePerAlly > 0) || !(allies > 0)) return 1;
  return 1 + Math.min(MATILHA_CAP, packRatePerAlly * allies);
}

/**
 * The allies a carrier has beside it over a ROTATION — the expected number of other heroes on
 * the field while the carrier stands on it, which is each other hero's own presence summed
 * (`Σ_{h≠carrier} presence_h`, under the same independence the auras' presence weights assume),
 * and never more than the field has room for beside the carrier (`fieldSlots − 1`).
 *
 * This is "field size − 1" read over wall clock rather than off a snapshot: on a per-hero screen
 * the field is the deployed heroes plus the hero being priced, so the allies are a count; on a
 * board that rotates a pool through the House each other hero is beside the carrier only for its
 * own share of the run.
 */
export function alliesOverRotation(
  presence: readonly number[],
  carrierIndex: number,
  fieldSlots: number,
): number {
  let others = 0;
  for (let index = 0; index < presence.length; index++) {
    if (index === carrierIndex) continue;
    const weight = presence[index];
    if (Number.isFinite(weight) && weight > 0) others += Math.min(1, weight);
  }
  return Math.max(0, Math.min(fieldSlots - 1, others));
}
