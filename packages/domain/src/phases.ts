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

/** Past this many bombs the expectation `hp / (hit × (1 + chance × frac))` is exact to under 1%. */
const SECOND_BLAST_EXACT_MAX_BOMBS = 60;

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
  if (firstBlastsOnly > SECOND_BLAST_EXACT_MAX_BOMBS) return targetHp / (hitDamage * (1 + s * SECOND_BLAST_FRAC));
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
