import { describe, expect, it } from 'vitest';
import {
  computePhaseIntelGlobal,
  estimateClearSeconds,
  penGap,
} from '@bombfarm/domain/phase-intel';

describe('phase-intel', () => {
  it('computes phase 1 globals from wiki snapshot', () => {
    const intel = computePhaseIntelGlobal(1, 0);
    expect(intel).not.toBeNull();
    expect(intel!.phase).toBe(1);
    expect(intel!.stoneHp).toBeGreaterThan(0);
    expect(intel!.propRows.length).toBeGreaterThan(0);
    expect(intel!.itemLevelLabel).toMatch(/\d/);
    expect(intel!.bossHp).toBeGreaterThan(intel!.stoneHp);
  });

  it('scales comum gold with team coin %', () => {
    const base = computePhaseIntelGlobal(10, 0)!;
    const boosted = computePhaseIntelGlobal(10, 40)!;
    expect(boosted.goldComumActual).toBeCloseTo(base.goldComumWiki * 1.4, 5);
    expect(boosted.weightedAvgGoldActual).toBeGreaterThan(base.weightedAvgGoldWiki);
  });

  it('penGap never negative', () => {
    expect(penGap(50, 30)).toBe(20);
    expect(penGap(30, 50)).toBe(0);
  });

  it('estimateClearSeconds divides HP by DPS', () => {
    expect(estimateClearSeconds(1000, 100)).toBe(10);
    expect(estimateClearSeconds(1000, 0)).toBeNull();
  });
});
