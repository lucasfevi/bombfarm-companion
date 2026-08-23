import { describe, expect, it } from 'vitest';
import { DRAIN_RATE_FLOOR } from '@bombfarm/domain/drain';
import {
  fitDrainRate,
  MAX_SAMPLE_AGE_MS,
  MAX_TRUSTED_DRAIN_RATE,
  MAX_WINDOW_SAMPLES,
  MIN_TRUSTED_DRAIN_RATE,
  MIN_TRUSTED_R_SQUARED,
  MIN_TRUSTED_SAMPLES,
  MIN_TRUSTED_SPAN_MS,
  pushDrainSample,
  type DrainSample,
} from '@bombfarm/domain/live';

function linearWindow(count: number, intervalMs: number, startEnergy: number, ratePerSecond: number): DrainSample[] {
  const samples: DrainSample[] = [];
  for (let i = 0; i < count; i += 1) {
    const atMs = i * intervalMs;
    samples.push({ atMs, energy: startEnergy - (ratePerSecond * atMs) / 1000 });
  }
  return samples;
}

describe('MIN_TRUSTED_DRAIN_RATE', () => {
  it('is sourced from DRAIN_RATE_FLOOR, not a second literal', () => {
    expect(MIN_TRUSTED_DRAIN_RATE).toBe(DRAIN_RATE_FLOOR);
  });
});

describe('fitDrainRate — trust gates', () => {
  it('rejects fewer than MIN_TRUSTED_SAMPLES regardless of span', () => {
    const window = linearWindow(MIN_TRUSTED_SAMPLES - 1, 1000, 900, 0.8);
    const fit = fitDrainRate(window);
    expect(fit.trusted).toBe(false);
    if (!fit.trusted) expect(fit.reason).toBe('insufficientSamples');
  });

  it('rejects a span shorter than MIN_TRUSTED_SPAN_MS even with enough samples', () => {
    const intervalMs = 50;
    const window = linearWindow(MIN_TRUSTED_SAMPLES, intervalMs, 900, 0.8);
    expect(window.length).toBeGreaterThanOrEqual(MIN_TRUSTED_SAMPLES);
    expect(window[window.length - 1].atMs - window[0].atMs).toBeLessThan(MIN_TRUSTED_SPAN_MS);

    const fit = fitDrainRate(window);
    expect(fit.trusted).toBe(false);
    if (!fit.trusted) expect(fit.reason).toBe('insufficientSpan');
  });

  it('rejects an R-squared below MIN_TRUSTED_R_SQUARED even with enough samples and span', () => {
    const window = linearWindow(8, 300, 900, 0.0008 * 1000);
    // Alternating noise dwarfs the tiny embedded trend, so the line explains almost none of
    // the variance while sample count and span both clear their gates.
    const noisy = window.map((sample, i) => ({ ...sample, energy: sample.energy + (i % 2 === 0 ? 5 : -5) }));
    expect(noisy.length).toBeGreaterThanOrEqual(MIN_TRUSTED_SAMPLES);
    expect(noisy[noisy.length - 1].atMs - noisy[0].atMs).toBeGreaterThanOrEqual(MIN_TRUSTED_SPAN_MS);

    const fit = fitDrainRate(noisy);
    expect(fit.trusted).toBe(false);
    if (!fit.trusted) {
      expect(fit.reason).toBe('lowRSquared');
      expect(fit.rSquared).toBeLessThan(MIN_TRUSTED_R_SQUARED);
    }
  });

  it('rejects a perfectly linear fit whose rate falls below MIN_TRUSTED_DRAIN_RATE', () => {
    const window = linearWindow(8, 300, 900, 0.3);
    const fit = fitDrainRate(window);
    expect(fit.trusted).toBe(false);
    if (!fit.trusted) {
      expect(fit.reason).toBe('rateOutOfRange');
      expect(fit.ratePerSecond).toBeCloseTo(0.3, 6);
    }
  });

  it('rejects a perfectly linear fit whose rate rises above MAX_TRUSTED_DRAIN_RATE', () => {
    const window = linearWindow(8, 300, 900, 1.5);
    const fit = fitDrainRate(window);
    expect(fit.trusted).toBe(false);
    if (!fit.trusted) {
      expect(fit.reason).toBe('rateOutOfRange');
      expect(fit.ratePerSecond).toBeCloseTo(1.5, 6);
    }
  });

  it('trusts a perfectly linear fit inside every gate', () => {
    const window = linearWindow(8, 300, 900, 0.8);
    const fit = fitDrainRate(window);
    expect(fit.trusted).toBe(true);
    if (fit.trusted) {
      expect(fit.ratePerSecond).toBeCloseTo(0.8, 6);
      expect(fit.rSquared).toBeCloseTo(1, 6);
    }
  });

  it('MAX_TRUSTED_DRAIN_RATE is the law\'s unreduced base rate', () => {
    expect(MAX_TRUSTED_DRAIN_RATE).toBe(1);
  });
});

describe('pushDrainSample', () => {
  it('keeps at most MAX_WINDOW_SAMPLES, dropping the oldest first', () => {
    let window: readonly DrainSample[] = [];
    for (let i = 0; i < MAX_WINDOW_SAMPLES + 1; i += 1) {
      window = pushDrainSample(window, { atMs: i * 100, energy: 1000 - i });
    }
    expect(window.length).toBe(MAX_WINDOW_SAMPLES);
    expect(window[0].atMs).toBe(100);
    expect(window[window.length - 1].atMs).toBe(MAX_WINDOW_SAMPLES * 100);
  });

  it('drops samples older than MAX_SAMPLE_AGE_MS relative to the newest sample', () => {
    let window: readonly DrainSample[] = [];
    window = pushDrainSample(window, { atMs: 0, energy: 1000 });
    window = pushDrainSample(window, { atMs: MAX_SAMPLE_AGE_MS + 1000, energy: 900 });
    expect(window.length).toBe(1);
    expect(window[0].atMs).toBe(MAX_SAMPLE_AGE_MS + 1000);
  });
});
