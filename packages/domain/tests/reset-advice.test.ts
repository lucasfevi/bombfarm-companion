import { describe, expect, it } from 'vitest';
import {
  RESET_GATE_EPSILON_PCT,
  RESET_RECOMMEND_DPS_PCT,
  shouldRecommendReset,
} from '@/shared/domain/reset-advice';

describe('shouldRecommendReset (BSPW4-11)', () => {
  it('exports the named constants (ASM-04)', () => {
    expect(RESET_RECOMMEND_DPS_PCT).toBe(1);
    expect(RESET_GATE_EPSILON_PCT).toBe(1e-6);
  });

  it('AC-67: 0.9% -> false, exactly 1.0% -> true, 10% -> true', () => {
    const table: Array<[number, boolean]> = [
      [0.9, false],
      [1.0, true],
      [10, true],
    ];
    for (const [gainPct, expected] of table) {
      const currentDps = 1000;
      const reoptDps = currentDps * (1 + gainPct / 100);
      expect(shouldRecommendReset({ currentDps, reoptDps }), `${gainPct}%`).toBe(expected);
    }
  });

  it('AC-68: currentDps of 0, NaN or Infinity returns false rather than Infinity/NaN gain', () => {
    expect(shouldRecommendReset({ currentDps: 0, reoptDps: 100 })).toBe(false);
    expect(shouldRecommendReset({ currentDps: Number.NaN, reoptDps: 100 })).toBe(false);
    expect(shouldRecommendReset({ currentDps: Number.POSITIVE_INFINITY, reoptDps: 100 })).toBe(false);
    expect(shouldRecommendReset({ currentDps: -5, reoptDps: 100 })).toBe(false);
  });

  it('a non-finite reoptDps also returns false', () => {
    expect(shouldRecommendReset({ currentDps: 100, reoptDps: Number.NaN })).toBe(false);
    expect(shouldRecommendReset({ currentDps: 100, reoptDps: Number.POSITIVE_INFINITY })).toBe(false);
  });

  it('AC-66: implements gainPct >= RESET_RECOMMEND_DPS_PCT - RESET_GATE_EPSILON_PCT exactly', () => {
    const currentDps = 1000;
    const justBelow = currentDps * (1 + (RESET_RECOMMEND_DPS_PCT - RESET_GATE_EPSILON_PCT * 2) / 100);
    const justAtEps = currentDps * (1 + (RESET_RECOMMEND_DPS_PCT - RESET_GATE_EPSILON_PCT / 2) / 100);
    expect(shouldRecommendReset({ currentDps, reoptDps: justBelow })).toBe(false);
    expect(shouldRecommendReset({ currentDps, reoptDps: justAtEps })).toBe(true);
  });
});
