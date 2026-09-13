/** Damage bonus per rank while a pulse is up — the wiki's `habilidades[].per_level` for `swap_dmg`. */
export const PASSAGEM_BASTAO_PER_RANK = 0.04;

/** Seconds a pulse lasts once it fires — the wiki's `combate.swap_dmg_secs`. */
export const PASSAGEM_BASTAO_WINDOW_SEC = 120;

/**
 * Seconds a carrier must wait between pulses — the wiki's `combate.swap_dmg_cooldown_secs`.
 *
 * **It cannot bind today, and that is a fact about the House, not about this ability.** A hero's
 * re-entry interval is their field seconds plus a full House recovery cycle, and the fastest
 * House in the game recovers in exactly 600 s (`HOUSES`, Casa V at level 20), so every carrier's
 * interval already exceeds this cooldown before their own field time is added. Every entry
 * pulses.
 *
 * The term below is written out anyway rather than dropped, because the thing keeping it inert
 * is a balance table that moves: a faster House — shipped by the game, or reported by a save's
 * own `casa.cycle_secs` — makes it bind immediately, and silently over-crediting the ability is
 * the failure mode worth spending three lines to prevent.
 * `passagem-bastao.test.ts` fails if that floor ever drops.
 */
export const PASSAGEM_BASTAO_COOLDOWN_SEC = 600;

/**
 * The field-wide ceiling overlapping pulses clamp at — the wiki's "+80% at max", one rank-20
 * carrier's whole pulse. A literal rather than `max rank × perLevel`, for the reason
 * `TEAM_BUFF_CAP` gives: that product is a reading, not a law (`matilha`'s cap does not follow
 * it).
 */
export const PASSAGEM_BASTAO_CAP = 0.8;

/**
 * Share of wall clock one carrier's pulse keeps the field lit. The pulse fires on every field
 * entry, so once per rotation cycle `T = F / duty`, lasts `W`, and fires at most once per `C`:
 * `min(1, W / T) × min(1, T / C)`. The second factor is 1 for every hero reachable today — see
 * the cooldown constant.
 *
 * `min(1, T / C)` is the smooth reading, not the exact one. A strictly periodic rotation pulses
 * on every `ceil(C / T)`-th entry, so the true share is `1 / ceil(C / T)` — a step function that
 * halves on an arbitrarily small change in energy, and would make this term jump under the
 * optimizer for no physical reason. Real rotations are FIFO-queued and jittered, which smooths
 * those steps out. The smooth form is also the larger of the two, so it errs toward crediting
 * the ability rather than discounting it.
 *
 * The window is the carrier's entry, not its stint: a carrier that empties before the 120 s are
 * up leaves the field lit behind it, which is what "buffs the whole field for a fixed window"
 * says. No reachable hero has a stint that short.
 */
export function passagemBastaoPresence(fieldSecondsValue: number, dutyValue: number): number {
  if (!Number.isFinite(fieldSecondsValue) || fieldSecondsValue <= 0) return 0;
  if (!Number.isFinite(dutyValue) || dutyValue <= 0 || dutyValue > 1) {
    throw new RangeError(
      `passagemBastaoPresence needs the carrier's duty in (0, 1] to derive their rotation cycle; got ${dutyValue}`,
    );
  }
  const cycleSeconds = fieldSecondsValue / dutyValue;
  return (
    Math.min(1, PASSAGEM_BASTAO_WINDOW_SEC / cycleSeconds) *
    Math.min(1, cycleSeconds / PASSAGEM_BASTAO_COOLDOWN_SEC)
  );
}

export type PassagemBastaoCarrier = {
  rank: number;
  /** Share of wall clock this carrier's pulse lights the field — {@link passagemBastaoPresence}. */
  presence: number;
};

export type PassagemBastaoLevel = {
  /** The field's damage multiplier at this level: `1 + 0.04 × (Σ ranks of the pulses up, capped)`. */
  mult: number;
  /** Share of wall clock the field sits at exactly this level. */
  probability: number;
};

/**
 * Passagem de Bastão as the field experiences it: a team aura that is up in pulses. At any
 * instant the field's damage multiplier is `1 + 0.04 × min(20, Σ ranks of the carriers whose
 * pulse is up)`, and this is the distribution of that multiplier over wall clock.
 *
 * Two consumers read it differently, which is why it is a distribution and not one number. A DPS
 * figure is linear in damage and takes {@link expectedMult}. The Farm board is not: its prop rate
 * goes through hits-to-kill, a step in the hit, so it prices every level through its own step and
 * time-weights the RATES (`farm-rate.ts`). Averaging the multiplier into the hit first would
 * credit a threshold the field crosses at no level it actually sits at.
 */
export type PassagemBastaoFieldPulse = {
  /** Ascending by `mult`, probabilities summing to 1. `[{ mult: 1, probability: 1 }]` with no carrier. */
  levels: readonly PassagemBastaoLevel[];
  /** `E[mult]` over wall clock — the cap taken inside the expectation, as every team aura is. */
  expectedMult: number;
};

const NO_FIELD_PULSE: PassagemBastaoFieldPulse = Object.freeze({
  levels: Object.freeze([Object.freeze({ mult: 1, probability: 1 })]),
  expectedMult: 1,
});

/**
 * Priced like the other team auras (`computeTeamBuffsOverRotation`): each carrier's pulse is up
 * independently for its own share of wall clock, the pulses that overlap sum their ranks, and
 * the sum is clamped at the cap INSIDE the expectation — `E[min(cap, Σ)]`, never
 * `min(cap, E[Σ])`, or two part-time carriers would read as one permanent one. Independence is
 * the same approximation the auras make and for the same reason: it is the neutral reading
 * between a hand-played rotation and a deliberately staggered one.
 *
 * Exact: the support is walked carrier by carrier in whole ranks, and the clamp keeps it to at
 * most 21 levels however many carriers there are.
 */
export function passagemBastaoFieldPulse(
  carriers: readonly PassagemBastaoCarrier[],
): PassagemBastaoFieldPulse {
  const capRanks = Math.round(PASSAGEM_BASTAO_CAP / PASSAGEM_BASTAO_PER_RANK);
  let byRanks = new Map<number, number>([[0, 1]]);
  let anyCarrier = false;
  for (const { rank, presence } of carriers) {
    if (!(rank > 0) || !(presence > 0)) continue;
    anyCarrier = true;
    const up = Math.min(1, presence);
    const next = new Map<number, number>();
    for (const [ranks, probability] of byRanks) {
      const withCarrier = Math.min(capRanks, ranks + rank);
      next.set(ranks, (next.get(ranks) ?? 0) + probability * (1 - up));
      next.set(withCarrier, (next.get(withCarrier) ?? 0) + probability * up);
    }
    byRanks = next;
  }
  if (!anyCarrier) return NO_FIELD_PULSE;

  const levels = [...byRanks]
    .filter(([, probability]) => probability > 0)
    .sort(([a], [b]) => a - b)
    .map(([ranks, probability]) => ({ mult: 1 + PASSAGEM_BASTAO_PER_RANK * ranks, probability }));
  let expectedMult = 0;
  for (const level of levels) expectedMult += level.probability * level.mult;
  return { levels, expectedMult };
}
