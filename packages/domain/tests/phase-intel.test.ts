import { describe, expect, it } from 'vitest';
import { computePhaseIntelGlobal, penGap } from '@bombfarm/domain/phase-intel';

describe('phase-intel', () => {
  it('computes phase 1 globals from wiki snapshot', () => {
    const intel = computePhaseIntelGlobal(1, { teamCoinPct: 0 });
    expect(intel).not.toBeNull();
    expect(intel!.phase).toBe(1);
    expect(intel!.stoneHp).toBeGreaterThan(0);
    expect(intel!.propRows.length).toBeGreaterThan(0);
    expect(intel!.itemLevelLabel).toMatch(/\d/);
    expect(intel!.bossHp).toBeGreaterThan(intel!.stoneHp);
  });

  it('scales comum gold with team coin %', () => {
    const base = computePhaseIntelGlobal(10, { teamCoinPct: 0 })!;
    const boosted = computePhaseIntelGlobal(10, { teamCoinPct: 40 })!;
    expect(boosted.goldComumActual).toBeCloseTo(base.goldComumWiki * 1.4, 5);
    expect(boosted.weightedAvgGoldActual).toBeGreaterThan(base.weightedAvgGoldWiki);
  });

  it('penGap never negative', () => {
    expect(penGap(50, 30)).toBe(20);
    expect(penGap(30, 50)).toBe(0);
  });
});
