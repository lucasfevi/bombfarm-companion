import { describe, expect, it } from 'vitest';
import { computePhaseIntelGlobal, mitigationLossPct } from '@bombfarm/domain/phase-intel';

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

  it('mitigationLossPct is the share of a hit the phase still takes: penetration pierces a percentage of the mitigation, never points off it', () => {
    expect(mitigationLossPct(8.36, 42.6)).toBeCloseTo(8.36 * (1 - 0.426), 6);
    expect(mitigationLossPct(8.36, 100)).toBe(0);
    expect(mitigationLossPct(8.36, 0)).toBeCloseTo(8.36, 6);
    // 50% penetration against a 30% phase is not "covered" — half of the 30% is still taken.
    expect(mitigationLossPct(30, 50)).toBeCloseTo(15, 6);
  });
});
