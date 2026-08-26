import { describe, expect, it } from 'vitest';
import { DRAIN_RATE_FLOOR } from '@bombfarm/domain/drain';
import {
  advanceFrameClock,
  advanceHeroEnergyClock,
  EMPTY_HERO_ENERGY_CLOCK,
  INITIAL_FRAME_CLOCK_STATE,
  MAX_TRUSTED_DRAIN_RATE,
  measuredSecondsPerFrame,
  MIN_FRAME_CLOCK_SAMPLES,
  MIN_TRUSTED_DRAIN_RATE,
  type FrameClockState,
  type HeroEnergyClockState,
} from '@bombfarm/domain/live';

describe('MIN_TRUSTED_DRAIN_RATE', () => {
  it('is sourced from DRAIN_RATE_FLOOR, not a second literal', () => {
    expect(MIN_TRUSTED_DRAIN_RATE).toBe(DRAIN_RATE_FLOOR);
  });
});

describe('MAX_TRUSTED_DRAIN_RATE', () => {
  it("is the law's unreduced base rate", () => {
    expect(MAX_TRUSTED_DRAIN_RATE).toBe(1);
  });
});

function drainFor(count: number, startEnergy: number, deltaPerFrame: number): number[] {
  const energies: number[] = [];
  for (let i = 0; i < count; i += 1) energies.push(startEnergy - i * deltaPerFrame);
  return energies;
}

function replayEnergyClock(energies: readonly number[]): { readonly deltasByFrame: readonly (number | undefined)[] } {
  let clock: HeroEnergyClockState = EMPTY_HERO_ENERGY_CLOCK;
  const deltasByFrame: (number | undefined)[] = [];
  for (const energy of energies) {
    clock = advanceHeroEnergyClock(clock, energy);
    deltasByFrame.push(clock.deltaPerFrame);
  }
  return { deltasByFrame };
}

describe('advanceHeroEnergyClock — establishing a rate', () => {
  it("reports no rate from a single reading — there is nothing yet to take a delta between", () => {
    const clock = advanceHeroEnergyClock(EMPTY_HERO_ENERGY_CLOCK, 900);
    expect(clock.deltaPerFrame).toBeUndefined();
  });

  it('reads the exact per-frame drop off two consecutive readings, no warm-up required', () => {
    const { deltasByFrame } = replayEnergyClock(drainFor(3, 900, 0.08));
    expect(deltasByFrame[0]).toBeUndefined();
    expect(deltasByFrame[1]).toBeCloseTo(0.08, 10);
    expect(deltasByFrame[2]).toBeCloseTo(0.08, 10);
  });
});

describe('advanceHeroEnergyClock — a skipped frame is not a rate change', () => {
  it('keeps the established delta when one frame is dropped, reproducing exactly 2x the delta', () => {
    const energies = drainFor(5, 900, 0.08);
    // Remove the 4th reading: the gap between readings 3 and 5 is 2x the per-frame delta.
    const withSkip = [...energies.slice(0, 3), energies[4]!];
    const { deltasByFrame } = replayEnergyClock(withSkip);
    expect(deltasByFrame[2]).toBeCloseTo(0.08, 10);
    // Reverting the multiple-of-delta rule to "always adopt the raw delta" would report 0.16 here.
    expect(deltasByFrame[3]).toBeCloseTo(0.08, 10);
  });

  it('keeps the established delta across a run of several dropped frames', () => {
    const energies = drainFor(6, 900, 0.08);
    const withSkips = [energies[0]!, energies[1]!, energies[5]!]; // 4 frames dropped between readings 2 and 3
    const { deltasByFrame } = replayEnergyClock(withSkips);
    expect(deltasByFrame[2]).toBeCloseTo(0.08, 10);
  });
});

describe('advanceHeroEnergyClock — a genuine rate change is adopted, in both directions', () => {
  it('adopts a slower rate the instant it appears', () => {
    const energies = [...drainFor(4, 900, 0.08), ...drainFor(4, 900 - 3 * 0.08 - 0.05, 0.05)];
    const { deltasByFrame } = replayEnergyClock(energies);
    expect(deltasByFrame[3]).toBeCloseTo(0.08, 10);
    expect(deltasByFrame[4]).toBeCloseTo(0.05, 10);
    expect(deltasByFrame[5]).toBeCloseTo(0.05, 10);
  });

  it('adopts a faster rate the instant it appears — a minimum-over-a-window rule could never do this', () => {
    // 0.13 is deliberately not a clean multiple of 0.08 (unlike, say, 0.16): a rate change that
    // happened to land on an exact integer multiple of the old delta would be indistinguishable
    // from a skipped frame, which is exactly the ambiguity the multiple-of-delta rule accepts.
    const energies = [...drainFor(4, 900, 0.08), ...drainFor(4, 900 - 3 * 0.08 - 0.13, 0.13)];
    const { deltasByFrame } = replayEnergyClock(energies);
    expect(deltasByFrame[3]).toBeCloseTo(0.08, 10);
    expect(deltasByFrame[4]).toBeCloseTo(0.13, 10);
    expect(deltasByFrame[5]).toBeCloseTo(0.13, 10);
  });
});

describe('advanceHeroEnergyClock — energy rising resets tracking', () => {
  it('reports no rate, never a negative one, the reading after energy rises', () => {
    const energies = [...drainFor(3, 900, 0.08), 950, 950 - 0.03];
    const { deltasByFrame } = replayEnergyClock(energies);
    expect(deltasByFrame[2]).toBeCloseTo(0.08, 10);
    expect(deltasByFrame[3]).toBeUndefined();
    // The very next reading re-establishes a rate from scratch rather than being read against
    // the pre-recharge energy.
    expect(deltasByFrame[4]).toBeCloseTo(0.03, 10);
  });
});

describe('advanceHeroEnergyClock — energy not moving is not a countdown of zero', () => {
  it('falls back to no rate known on a flat reading, exactly as an unmeasured hero would', () => {
    const energies = [...drainFor(3, 900, 0.08), 900 - 2 * 0.08];
    const { deltasByFrame } = replayEnergyClock(energies);
    expect(deltasByFrame[2]).toBeCloseTo(0.08, 10);
    expect(deltasByFrame[3]).toBeUndefined();
  });
});

function arrivalsAt(intervalMs: number, count: number): number[] {
  return Array.from({ length: count }, (_, i) => i * intervalMs);
}

function replayFrameClock(arrivalTimesMs: readonly number[]): FrameClockState {
  let clock: FrameClockState = INITIAL_FRAME_CLOCK_STATE;
  for (const atMs of arrivalTimesMs) clock = advanceFrameClock(clock, atMs);
  return clock;
}

describe('advanceFrameClock', () => {
  it('is unmeasured before MIN_FRAME_CLOCK_SAMPLES gaps have been observed', () => {
    const arrivals = arrivalsAt(100, MIN_FRAME_CLOCK_SAMPLES); // MIN_FRAME_CLOCK_SAMPLES - 1 gaps
    const clock = replayFrameClock(arrivals);
    expect(measuredSecondsPerFrame(clock)).toBeUndefined();
  });

  it('is measured once MIN_FRAME_CLOCK_SAMPLES gaps have been observed, converging on the true cadence', () => {
    const arrivals = arrivalsAt(100, MIN_FRAME_CLOCK_SAMPLES + 1); // exactly MIN_FRAME_CLOCK_SAMPLES gaps
    const clock = replayFrameClock(arrivals);
    expect(measuredSecondsPerFrame(clock)).toBeCloseTo(0.1, 6);
  });

  it('ignores a stalled gap instead of folding it into the average', () => {
    const steady = arrivalsAt(100, 30);
    const lastSteady = steady[steady.length - 1]!;
    const withStall = [...steady, lastSteady + 20_000, lastSteady + 20_100];
    const clock = replayFrameClock(withStall);
    // Reverting the outlier guard would drag the estimate toward the 20s stall.
    expect(measuredSecondsPerFrame(clock)).toBeCloseTo(0.1, 3);
  });

  it("jitter in arrival timing averages out rather than tracking any single gap", () => {
    const steady = arrivalsAt(100, 40);
    const jittered = steady.map((atMs, i) => atMs + (i % 2 === 0 ? 15 : -15));
    const clock = replayFrameClock(jittered);
    expect(measuredSecondsPerFrame(clock)).toBeCloseTo(0.1, 2);
  });
});
