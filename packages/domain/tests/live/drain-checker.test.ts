import { describe, expect, it } from 'vitest';
import {
  DRAIN_RATE_DISAGREEMENT_MARGIN,
  drainRateDisagrees,
  EMPTY_HERO_DRAIN_OBSERVATION,
  observeDrainRate,
} from '@bombfarm/domain/live';

describe('observeDrainRate — establishing a rate', () => {
  it('reports no rate from a single reading — there is nothing yet to take a delta between', () => {
    const { observedDrainPerSecond } = observeDrainRate(EMPTY_HERO_DRAIN_OBSERVATION, 900, 0);
    expect(observedDrainPerSecond).toBeUndefined();
  });

  it('divides the energy drop by the real elapsed time between two readings, however far apart they are', () => {
    const first = observeDrainRate(EMPTY_HERO_DRAIN_OBSERVATION, 900, 0);
    const second = observeDrainRate(first.state, 900 - 0.8 * 7.3, 7_300);
    expect(second.observedDrainPerSecond).toBeCloseTo(0.8, 6);
  });

  it('needs no frame count and no shared clock: a gap spanning many missed frames still reports the exact average rate', () => {
    const first = observeDrainRate(EMPTY_HERO_DRAIN_OBSERVATION, 900, 0);
    // Whatever happened between these two readings, however many frames were dropped, the two
    // real timestamps alone give the true average rate over the interval.
    const second = observeDrainRate(first.state, 900 - 0.6 * 42, 42_000);
    expect(second.observedDrainPerSecond).toBeCloseTo(0.6, 6);
  });
});

describe('observeDrainRate — energy not falling is not evidence of a rate', () => {
  it('reports no rate, never a negative one, the reading after energy rises', () => {
    const first = observeDrainRate(EMPTY_HERO_DRAIN_OBSERVATION, 900, 0);
    const second = observeDrainRate(first.state, 950, 1_000);
    expect(second.observedDrainPerSecond).toBeUndefined();
  });

  it('reports no rate on a flat reading, exactly as an unmeasured hero would', () => {
    const first = observeDrainRate(EMPTY_HERO_DRAIN_OBSERVATION, 900, 0);
    const second = observeDrainRate(first.state, 900, 1_000);
    expect(second.observedDrainPerSecond).toBeUndefined();
  });

  it('reports no rate when two readings land at the same instant', () => {
    const first = observeDrainRate(EMPTY_HERO_DRAIN_OBSERVATION, 900, 1_000);
    const second = observeDrainRate(first.state, 899, 1_000);
    expect(second.observedDrainPerSecond).toBeUndefined();
  });
});

describe('drainRateDisagrees', () => {
  it('is defined as a relative gap against the margin, not an absolute one', () => {
    const modelled = 0.8;
    const justInside = modelled * (1 + DRAIN_RATE_DISAGREEMENT_MARGIN - 0.001);
    const justOutside = modelled * (1 + DRAIN_RATE_DISAGREEMENT_MARGIN + 0.001);
    expect(drainRateDisagrees(justInside, modelled)).toBe(false);
    expect(drainRateDisagrees(justOutside, modelled)).toBe(true);
  });

  it('is symmetric: the observed rate can disagree by running slower than the law too', () => {
    const modelled = 0.8;
    const slower = modelled * (1 - DRAIN_RATE_DISAGREEMENT_MARGIN - 0.001);
    expect(drainRateDisagrees(slower, modelled)).toBe(true);
  });

  it('agrees exactly when the observed rate equals the modelled one', () => {
    expect(drainRateDisagrees(0.8, 0.8)).toBe(false);
  });
});
