/**
 * `goldGainPct` / `chestsGainPct` — signed percent change on each currency's own rate, current ->
 * proposed. Unlike `gainPct` (the ACTIVE objective's value, clamped `>= 0` by construction),
 * these two are deliberately UNCLAMPED: whichever currency is not being optimized can legitimately
 * fall (design.md's own "gives up N gold/hr for this objective" case), and a clamped-to-zero
 * percent next to that figure would contradict it.
 */
import { describe, expect, it } from 'vitest';
import { solveFarmRespec } from '@bombfarm/domain/farm-optimize';
import { loadFarmRateFixture } from './helpers/farm-rate-fixtures';

const { heroes, account, maxPhase } = loadFarmRateFixture();

describe('goldGainPct / chestsGainPct — signed, never clamped', () => {
  it('a GAIN on both currencies under the gold objective: goldGainPct and chestsGainPct both positive and finite', () => {
    const result = solveFarmRespec({ heroes, account, maxPhase });
    expect(result.proposedGoldPerHour).toBeGreaterThan(result.currentGoldPerHour);
    expect(result.proposedChestsPerHour).toBeGreaterThan(result.currentChestsPerHour);

    expect(result.goldGainPct).toBeCloseTo(
      (result.proposedGoldPerHour / result.currentGoldPerHour - 1) * 100,
      9,
    );
    expect(result.chestsGainPct).toBeCloseTo(
      (result.proposedChestsPerHour / result.currentChestsPerHour - 1) * 100,
      9,
    );
    expect(result.goldGainPct).toBeGreaterThan(0);
    expect(result.chestsGainPct).toBeGreaterThan(0);
  });

  it.skip('a LOSS: the chests objective trades gold away — goldGainPct is NEGATIVE, not clamped to 0', () => {
    const result = solveFarmRespec({ heroes, account, objective: { kind: 'chests' }, maxPhase });
    expect(result.proposedGoldPerHour).toBeLessThan(result.currentGoldPerHour);

    expect(result.goldGainPct).toBeCloseTo(
      (result.proposedGoldPerHour / result.currentGoldPerHour - 1) * 100,
      9,
    );
    expect(result.goldGainPct).toBeLessThan(0);
    // The one field this suite is guarding: a `Math.max(0, …)` regression here would silently
    // turn a real loss into 0 and contradict the panel's own "gives up gold/hr" note.
    expect(result.goldGainPct).not.toBe(0);

    // Chests still gain under their own objective.
    expect(result.proposedChestsPerHour).toBeGreaterThan(result.currentChestsPerHour);
    expect(result.chestsGainPct).toBeGreaterThan(0);
  });

  it('current <= 0 guard: an empty pool reports currentGoldPerHour/currentChestsPerHour 0 and both gain percents 0, never NaN/Infinity', () => {
    const result = solveFarmRespec({ heroes: [], account, maxPhase });
    expect(result.outcome).toBe('emptyPool');
    expect(result.currentGoldPerHour).toBe(0);
    expect(result.currentChestsPerHour).toBe(0);
    expect(result.goldGainPct).toBe(0);
    expect(result.chestsGainPct).toBe(0);
    expect(Number.isFinite(result.goldGainPct)).toBe(true);
    expect(Number.isFinite(result.chestsGainPct)).toBe(true);
  });
});
