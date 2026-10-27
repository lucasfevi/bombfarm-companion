import phases from './data/phases.json' with { type: 'json' };
import { SECOND_BLAST_FRAC } from './phase-wiki';

export type PhaseLine = (typeof phases.lines)[number];
export type PropDef = (typeof phases.props)[number];

export const PHASE_LINES: PhaseLine[] = phases.lines;
export const PROPS: PropDef[] = phases.props;
export const BOSS_HP_MULT = phases.bossHpMult;

export function phaseLine(phase: number): PhaseLine | undefined {
  return PHASE_LINES[Math.max(1, Math.min(600, Math.round(phase))) - 1];
}

export function propHp(stoneHp: number, hpMult: number): number {
  return stoneHp * hpMult;
}

export function hitsToKill(hitDamage: number, targetHp: number): number {
  if (hitDamage <= 0) return Infinity;
  return Math.ceil(targetHp / hitDamage);
}

/** Past this many bombs {@link averagedHitsToKill} replaces the exact sum. */
const SECOND_BLAST_EXACT_MAX_BOMBS = 60;

/** One end of a two-outcome hit: its mean, its mean square, and the exact hits it needs alone. */
export type HitsToKillEnd = { readonly mean: number; readonly meanSquare: number; readonly hits: number };

/**
 * Expected hits to destroy `hp` past the exact sums, for a hit that rolls its `high` outcome with
 * chance `p` and its `low` one otherwise; `mean` and `meanSquare` are the hit's moments at `p`.
 *
 * `hp / E[hit]` alone reads about half a hit low: the killing hit overshoots the HP, and renewal
 * theory puts the mean overshoot at `E[hit²] / (2 E[hit])`, so the count gains
 * `E[hit²] / (2 E[hit]²)` — within a hundredth of a hit of the exact sum on average over HPs.
 *
 * At either end every hit is the same and the exact count is a whole number, which the averaged
 * reading smooths away. Each end's rounding is kept, weighted by how much of it survives: it
 * fades once the other outcome has moved about one hit of damage, so `p = 0` and `p = 1` read
 * their exact counts and the curve between them never rises as `p` does.
 */
export function averagedHitsToKill(
  hp: number,
  mean: number,
  meanSquare: number,
  p: number,
  low: HitsToKillEnd,
  high: HitsToKillEnd,
): number {
  const averaged = (m: number, m2: number) => hp / m + m2 / (2 * m * m);
  const spread = high.mean / low.mean - 1;
  const lowWeight = Math.pow(1 - p, Math.max(1, (hp / low.mean) * spread));
  const highWeight = Math.pow(p, Math.max(1, ((hp / high.mean) * spread) / (1 + spread)));
  return (
    averaged(mean, meanSquare) +
    lowWeight * (low.hits - averaged(low.mean, low.meanSquare)) +
    highWeight * (high.hits - averaged(high.mean, high.meanSquare))
  );
}

/**
 * Expected bombs to destroy `targetHp` when each bomb's blast deals `hitDamage` and, with
 * `chance`, blasts again for {@link SECOND_BLAST_FRAC} of it. The second blast lands only on a prop the
 * first left standing, which never changes the count, so `E[bombs] = Σ_k P(alive after k)`
 * holds exactly: alive after `k` bombs while `k × hit + b × frac × hit < hp`, `b` the second
 * blasts among them, binomial in `k`. With no chance it is {@link hitsToKill} bit for bit.
 */
export function hitsToKillWithSecondBlast(hitDamage: number, targetHp: number, chance: number): number {
  const s = Math.min(1, Math.max(0, chance));
  if (!(s > 0)) return hitsToKill(hitDamage, targetHp);
  if (hitDamage <= 0) return Infinity;
  if (!(targetHp > 0)) return 0;
  const firstBlastsOnly = Math.ceil(targetHp / hitDamage);
  if (firstBlastsOnly > SECOND_BLAST_EXACT_MAX_BOMBS) {
    const both = hitDamage * (1 + SECOND_BLAST_FRAC);
    return averagedHitsToKill(
      targetHp,
      (1 - s) * hitDamage + s * both,
      (1 - s) * hitDamage * hitDamage + s * both * both,
      s,
      { mean: hitDamage, meanSquare: hitDamage * hitDamage, hits: firstBlastsOnly },
      { mean: both, meanSquare: both * both, hits: Math.ceil(targetHp / both) },
    );
  }
  let expected = 0;
  for (let k = 0; k < firstBlastsOnly; k++) {
    const secondBlastsBelow = (targetHp / hitDamage - k) / SECOND_BLAST_FRAC;
    expected += binomialCdfBelow(k, s, secondBlastsBelow);
  }
  return expected;
}

/** `P(B < limit)` for `B ~ Binomial(trials, p)`, `0 < p ≤ 1`. */
export function binomialCdfBelow(trials: number, p: number, limit: number): number {
  if (!(limit > 0)) return 0;
  if (limit > trials) return 1;
  if (p >= 1) return 0;
  const q = 1 - p;
  let pmf = q ** trials;
  let cdf = 0;
  for (let b = 0; b < limit - 1e-12; b++) {
    cdf += pmf;
    pmf *= (p * (trials - b)) / (q * (b + 1));
  }
  return Math.min(1, cdf);
}

/** Weighted-average prop HP using spawn weights (approx clear difficulty). */
export function weightedAvgPropHp(stoneHp: number): number {
  const totalWeight = PROPS.reduce((sum, prop) => sum + prop.weight, 0);
  return PROPS.reduce((sum, prop) => sum + propHp(stoneHp, prop.hpMult) * prop.weight, 0) / totalWeight;
}

/**
 * How much extra hit damage (%) is needed to oneshot `hp`.
 * 0 if already oneshotting.
 */
export function oneshotGapPct(hitDamage: number, targetHp: number): number {
  if (hitDamage <= 0) return 100;
  if (hitDamage >= targetHp) return 0;
  return ((targetHp - hitDamage) / hitDamage) * 100;
}
