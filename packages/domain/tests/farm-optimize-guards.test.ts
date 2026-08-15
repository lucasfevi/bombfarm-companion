/**
 * Structural, hygiene and literal guards for the farm-objective optimizer.
 *
 * This file starts small (T2's respec-cost cases) and is extended by T12 with the import
 * allowlist, purity scan, forbidden-literal scan and public-repo hygiene scan described in
 * design.md §9/§12.
 */
import { describe, expect, it } from 'vitest';
import { RESPEC_COST_GOLD_PER_LEVEL, respecCostGold } from '@bombfarm/domain/respec-cost';

describe('respecCostGold', () => {
  it('is level × RESPEC_COST_GOLD_PER_LEVEL, with no clamp, round or floor', () => {
    expect(RESPEC_COST_GOLD_PER_LEVEL).toBe(1000);
    expect(respecCostGold(0)).toBe(0);
    expect(respecCostGold(42)).toBe(42_000);
    // No clamp — deliberately pinned: a negative level is not normalized here.
    expect(respecCostGold(-3)).toBe(-3000);
    // No round — deliberately pinned: a fractional level is not normalized here.
    expect(respecCostGold(1.5)).toBe(1500);
  });
});
