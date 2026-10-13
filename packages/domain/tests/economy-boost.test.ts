import { describe, expect, it } from 'vitest';
import { runningBoostAxes } from '@bombfarm/contracts';
import { economyBoostOf, NO_ECONOMY_BOOST } from '@bombfarm/domain/farm-rate';

describe('economyBoostOf', () => {
  it('turns on exactly the axes that are running', () => {
    expect(economyBoostOf(['gold', 'drop'])).toEqual({ gold: true, xp: false, drop: true });
  });

  it('is the shared no-Boost value when nothing runs', () => {
    expect(economyBoostOf([])).toBe(NO_ECONOMY_BOOST);
  });

  it('prices a frame-carried Boost only while it has seconds left', () => {
    const axes = runningBoostAxes([
      { axis: 'xp', secondsLeft: 120, mult: 2 },
      { axis: 'gold', secondsLeft: 0, mult: 2 },
    ]);

    expect(economyBoostOf(axes)).toEqual({ gold: false, xp: true, drop: false });
  });

  it('reads a frame with no list as no Boost', () => {
    expect(economyBoostOf(runningBoostAxes(undefined))).toBe(NO_ECONOMY_BOOST);
  });
});
