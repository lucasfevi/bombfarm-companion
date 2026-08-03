/**
 * Mechanical, behaviour-free extraction of the prop-HTK and gate-window row tables out of
 * `advisor-pipeline.ts`, to buy line budget before T5 and T11 add to that file (`AC-36`).
 * No literal or formula changed — see `advisor-pipeline.test.ts` for the discrimination
 * check proving this is a pure move.
 */
import { gateDamage, type Context, type HeroSheet, type ReoptResult } from '@/shared/domain/model';
import { GATES } from '@/shared/domain/planner-constants';
import { PROPS, hitsToKill, oneshotGapPct, propHp } from '@/shared/domain/phases';
import { shouldRecommendReset } from '@/shared/domain/reset-advice';

export type PropHtkRow = {
  name: string;
  hp: number;
  hits: number;
  oneshotGapPct: number;
  highlight: boolean;
};

export type GateRow = {
  name: string;
  secs: number;
  windowSecs: number;
  dmg: number;
};

export function propHtkRows(stoneHp: number, avgHit: number, targetProp: string | null): PropHtkRow[] {
  return PROPS.map((prop) => {
    const hitPoints = propHp(stoneHp, prop.hpMult);
    return {
      name: prop.name,
      hp: hitPoints,
      hits: hitsToKill(avgHit, hitPoints),
      oneshotGapPct: oneshotGapPct(avgHit, hitPoints),
      highlight: targetProp != null && prop.name === targetProp,
    };
  });
}

export function gateRows(
  effective: HeroSheet,
  context: Context,
  field: number,
  dmgMult: number,
  gateAttackMult: number,
): GateRow[] {
  return GATES.map((gate) => ({
    name: gate.name,
    secs: gate.secs,
    windowSecs: Math.min(field, gate.secs),
    dmg: gateDamage(effective, context, gate.secs) * dmgMult * gateAttackMult,
  }));
}

export type ResetAdvice = {
  recommend: boolean;
  tier: 'gate';
  gainIsLowerBound: true;
  currentDps: number;
  reoptDps: number;
  gainPct: number;
};

/** BSPW4-11/BSPW4-15 (AC-70a/AC-70b) — Tier 1's own gate result, never an idealised reallocation. */
export function buildResetAdvice(gate: ReoptResult): ResetAdvice {
  return {
    recommend: shouldRecommendReset({ currentDps: gate.currentDps, reoptDps: gate.reoptDps }),
    tier: 'gate',
    gainIsLowerBound: true,
    currentDps: gate.currentDps,
    reoptDps: gate.reoptDps,
    gainPct: gate.gainPct,
  };
}
