import { DRAIN_RATE_FLOOR } from '../drain';

/** At ~10 Hz, 8 samples is ~0.8s — two samples fit any line perfectly and say nothing. */
export const MIN_TRUSTED_SAMPLES = 8;
/** A sample count alone is satisfiable by a burst; the span is what makes the slope a rate. */
export const MIN_TRUSTED_SPAN_MS = 2000;
/** Admits a ~2s window carrying quantisation noise while still rejecting a hero whose energy
 *  is not moving linearly. */
export const MIN_TRUSTED_R_SQUARED = 0.98;
/** Bounded memory, and a slope that outlives the composition it was measured under is worse
 *  than no slope. */
export const MAX_WINDOW_SAMPLES = 60;
export const MAX_SAMPLE_AGE_MS = 30_000;
/** Same floor `combineDrainRate` already enforces — a fitted rate below it, or above the
 *  law's unreduced base of 1, means the fit is wrong, not the law. */
export const MIN_TRUSTED_DRAIN_RATE = DRAIN_RATE_FLOOR;
export const MAX_TRUSTED_DRAIN_RATE = 1;

export interface DrainSample {
  readonly atMs: number;
  readonly energy: number;
}

export type DrainFitRejectionReason =
  | 'insufficientSamples'
  | 'insufficientSpan'
  | 'lowRSquared'
  | 'rateOutOfRange';

export type DrainFit =
  | {
      readonly trusted: true;
      readonly ratePerSecond: number;
      readonly rSquared: number;
      /** Absolute `atMs` at which the fitted line reaches zero energy, read off the regression
       *  itself so a caller's countdown never has to re-derive it from a single jittery sample. */
      readonly zeroAtMs: number;
    }
  | {
      readonly trusted: false;
      readonly reason: DrainFitRejectionReason;
      readonly ratePerSecond?: number;
      readonly rSquared?: number;
    };

/**
 * Appends one `(timestampMs, absoluteEnergy)` sample to a hero's rolling window, discarding
 * samples older than {@link MAX_SAMPLE_AGE_MS} relative to the new sample and capping the
 * window at {@link MAX_WINDOW_SAMPLES}. Samples must be pushed in non-decreasing `atMs` order.
 */
export function pushDrainSample(
  window: readonly DrainSample[],
  sample: DrainSample,
): readonly DrainSample[] {
  const kept = window.filter((existing) => sample.atMs - existing.atMs <= MAX_SAMPLE_AGE_MS);
  const next = [...kept, sample];
  return next.length > MAX_WINDOW_SAMPLES ? next.slice(next.length - MAX_WINDOW_SAMPLES) : next;
}

/**
 * Ordinary least squares over the window, reporting a hero's drain rate as a positive
 * energy/second figure (energy falls as time rises, so the raw regression slope is negated).
 * Trusted only when every gate in the module's constants passes; otherwise the caller falls
 * back to the modelled rate.
 */
export function fitDrainRate(window: readonly DrainSample[]): DrainFit {
  if (window.length < MIN_TRUSTED_SAMPLES) {
    return { trusted: false, reason: 'insufficientSamples' };
  }

  const spanMs = window[window.length - 1].atMs - window[0].atMs;
  if (spanMs < MIN_TRUSTED_SPAN_MS) {
    return { trusted: false, reason: 'insufficientSpan' };
  }

  const n = window.length;
  let sumT = 0;
  let sumE = 0;
  for (const sample of window) {
    sumT += sample.atMs;
    sumE += sample.energy;
  }
  const meanT = sumT / n;
  const meanE = sumE / n;

  let sxx = 0;
  let sxy = 0;
  for (const sample of window) {
    const dt = sample.atMs - meanT;
    sxx += dt * dt;
    sxy += dt * (sample.energy - meanE);
  }
  const slopePerMs = sxy / sxx;
  const intercept = meanE - slopePerMs * meanT;

  let ssRes = 0;
  let ssTot = 0;
  for (const sample of window) {
    const residual = sample.energy - (slopePerMs * sample.atMs + intercept);
    ssRes += residual * residual;
    const deviation = sample.energy - meanE;
    ssTot += deviation * deviation;
  }
  const rSquared = ssTot === 0 ? 1 : 1 - ssRes / ssTot;
  const ratePerSecond = -slopePerMs * 1000;

  if (rSquared < MIN_TRUSTED_R_SQUARED) {
    return { trusted: false, reason: 'lowRSquared', ratePerSecond, rSquared };
  }
  if (ratePerSecond < MIN_TRUSTED_DRAIN_RATE || ratePerSecond > MAX_TRUSTED_DRAIN_RATE) {
    return { trusted: false, reason: 'rateOutOfRange', ratePerSecond, rSquared };
  }
  const zeroAtMs = -intercept / slopePerMs;
  return { trusted: true, ratePerSecond, rSquared, zeroAtMs };
}
