import phases from './data/phases.json';

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
