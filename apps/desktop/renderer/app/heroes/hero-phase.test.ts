import { describe, expect, it } from 'vitest';
import { LAST_KNOWN_PHASE, clampToKnownPhase } from './hero-phase';

describe('clampToKnownPhase', () => {
  it('passes a phase inside the known run through untouched', () => {
    expect(clampToKnownPhase(51)).toBe(51);
    expect(clampToKnownPhase(1)).toBe(1);
    expect(clampToKnownPhase(LAST_KNOWN_PHASE)).toBe(LAST_KNOWN_PHASE);
  });

  it('clamps a phase past the end of what the tables describe onto the last one they do', () => {
    expect(clampToKnownPhase(LAST_KNOWN_PHASE + 1)).toBe(LAST_KNOWN_PHASE);
    expect(clampToKnownPhase(9_000)).toBe(LAST_KNOWN_PHASE);
  });

  it('clamps a phase below the first one onto the first one', () => {
    expect(clampToKnownPhase(0)).toBe(1);
    expect(clampToKnownPhase(-40)).toBe(1);
  });

  it('rounds a fractional phase to the row it names', () => {
    expect(clampToKnownPhase(51.4)).toBe(51);
    expect(clampToKnownPhase(51.6)).toBe(52);
  });

  it('answers with nothing at all for a reading that is not a phase', () => {
    expect(clampToKnownPhase(null)).toBeNull();
    expect(clampToKnownPhase(undefined)).toBeNull();
    expect(clampToKnownPhase(Number.NaN)).toBeNull();
    expect(clampToKnownPhase(Number.POSITIVE_INFINITY)).toBeNull();
  });

  it('knows a real run of phases, so the clamp is a bound and not a constant', () => {
    expect(LAST_KNOWN_PHASE).toBeGreaterThan(1);
  });
});
