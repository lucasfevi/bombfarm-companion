import { POINT_GAIN, STAT_CAPS } from './rarity-constants';
import type { Context, HeroSheet } from './types';

const GRID_SPEED_COEF = 0.0386;
const EFF_IA = 0.9;

export function staminaFactor(energy: number): number {
  return 1 - 0.5 / (1.3 + 0.003 * energy);
}

export const FUSE_FLOOR = 0.6; // "piso de 30% do ciclo" — 30% of the 2s base

export function fuseSeconds(cdrPct: number): number {
  const cdr = clampCdrPct(cdrPct);
  return Math.max(2 * (1 - cdr / 100), FUSE_FLOOR);
}

/** Linear fuse for next-point CDR ranking — no early floor; ranks until `STAT_CAPS.cdr`. */
export function marginalFuseSeconds(cdrPct: number): number {
  const cdr = clampCdrPct(cdrPct);
  return 2 * (1 - cdr / 100);
}

function bombsPerSecondWithFuse(
  hero: Pick<HeroSheet, 'speed' | 'energy' | 'cdr'>,
  context: Context,
  fuseSec: number,
): number {
  if (context.cycleModel === 'serial') {
    return 1 / (fuseSec + context.walkDelay);
  }
  return (0.3 + 0.12 * hero.speed * GRID_SPEED_COEF) * staminaFactor(hero.energy);
}

function activeDpsWithFuse(hero: HeroSheet, context: Context, fuseSec: number): number {
  const dano = hero.attack * mitigationFactor(context.mitigation, hero.penetration) * critFactor(hero.critChance, hero.critDmg);
  return dano * bombsPerSecondWithFuse(hero, context, fuseSec) * (1 + 0.5 * context.blastRange) * EFF_IA;
}

/** Exposed for `points-rank`'s marginal-fuse CDR scoring; not part of the public barrel. */
export function sustainedDpsWithFuse(hero: HeroSheet, context: Context, fuseSec: number): number {
  const fieldSecondsValue = fieldSeconds(hero, context);
  const duty = fieldSecondsValue / (fieldSecondsValue + context.restSeconds);
  return activeDpsWithFuse(hero, context, fuseSec) * duty;
}

export function bombsPerSecond(hero: Pick<HeroSheet, 'speed' | 'energy' | 'cdr'>, context: Context): number {
  if (context.cycleModel === 'serial') {
    return 1 / (fuseSeconds(hero.cdr) + context.walkDelay);
  }
  return (0.3 + 0.12 * hero.speed * GRID_SPEED_COEF) * staminaFactor(hero.energy);
}

export function critFactor(critChancePct: number, critDmgPct: number): number {
  const clampedCritChance = clampCritChancePct(critChancePct);
  return 1 + (clampedCritChance / 100) * (critDmgPct / 100);
}

export function mitigationFactor(mitigation: number, penetrationPct: number): number {
  const pen = clampPenPct(penetrationPct);
  return 1 - mitigation * (1 - pen / 100);
}

/** Linear level power from wiki `herois.curva_nivel` / `combate.level_power` (+0.04 per level).
 * Scales intrinsic Attack (poder). Sheet Attack at level L is birth×stars×points × this mult
 * (before items). Changing hero level in the UI rescales naked Attack by new/old. */
export function levelPowerMult(level: number): number {
  return 1 + 0.04 * Math.max(0, level - 1);
}

/** Flat attack gained per spent point at this hero level (+10 × level power mult). */
export function attackPointGain(level: number): number {
  return POINT_GAIN.attackNative * levelPowerMult(level);
}

export function clampCritChancePct(value: number): number {
  return Math.min(value, STAT_CAPS.critChance);
}

export function clampCdrPct(value: number): number {
  return Math.min(value, STAT_CAPS.cdr);
}

export function clampPenPct(value: number): number {
  return Math.min(value, STAT_CAPS.penetration);
}

/** Single-target hit (no crit, no IA, no second-blast). */
export function predictHitDamage(attack: number, mitigation: number, penetrationPct: number, dmgMult: number): number {
  return attack * mitigationFactor(mitigation, penetrationPct) * dmgMult;
}

/** Field seconds per deployment: energy at 1/s drain, scaled by drain reducers. */
export function fieldSeconds(hero: HeroSheet, context: Context): number {
  return hero.energy / context.drainMult;
}

/** Sustained farming DPS including house downtime. */
export function sustainedDps(hero: HeroSheet, context: Context): number {
  const fieldSecondsValue = fieldSeconds(hero, context);
  const duty = fieldSecondsValue / (fieldSecondsValue + context.restSeconds);
  return activeDps(hero, context) * duty;
}

/** Active-phase DPS while deployed (no downtime). */
export function activeDps(hero: HeroSheet, context: Context): number {
  const dano = hero.attack * mitigationFactor(context.mitigation, hero.penetration) * critFactor(hero.critChance, hero.critDmg);
  return dano * bombsPerSecond(hero, context) * (1 + 0.5 * context.blastRange) * EFF_IA;
}

/** Total damage inside a timed gate window (hero enters at full energy). */
export function gateDamage(hero: HeroSheet, context: Context, gateSeconds: number): number {
  return activeDps(hero, context) * Math.min(fieldSeconds(hero, context), gateSeconds);
}
