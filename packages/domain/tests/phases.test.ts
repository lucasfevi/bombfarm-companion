import { describe, expect, it } from 'vitest';
import {
  phaseLine,
  propHp,
  hitsToKill,
  oneshotGapPct,
  weightedAvgPropHp,
  BOSS_HP_MULT,
  PROPS,
} from '@/shared/domain/phases';

describe('phaseLine', () => {
  it('clamps phase into 1..600', () => {
    expect(phaseLine(1)?.phase).toBe(1);
    expect(phaseLine(71)?.phase).toBe(71);
    expect(phaseLine(0)?.phase).toBe(1);
    expect(phaseLine(999)?.phase).toBe(600);
  });
});

describe('prop helpers', () => {
  it('scales prop HP from stone', () => {
    expect(propHp(1000, 1.45)).toBe(1450);
    expect(propHp(1000, BOSS_HP_MULT)).toBe(10_000);
  });

  it('computes hits-to-kill and oneshot gap', () => {
    expect(hitsToKill(100, 350)).toBe(4);
    expect(hitsToKill(0, 100)).toBe(Infinity);
    expect(oneshotGapPct(80, 100)).toBeCloseTo(25, 6);
    expect(oneshotGapPct(120, 100)).toBe(0);
  });

  it('weights average prop HP', () => {
    const stone = 10_000;
    const avg = weightedAvgPropHp(stone);
    const w = PROPS.reduce((a, p) => a + p.weight, 0);
    const expected = PROPS.reduce((a, p) => a + stone * p.hpMult * p.weight, 0) / w;
    expect(avg).toBeCloseTo(expected, 6);
  });
});
