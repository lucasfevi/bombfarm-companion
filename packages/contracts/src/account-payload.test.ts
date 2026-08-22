import { describe, expect, it } from 'vitest';
import type { SectionFidelity } from './account-payload.js';
import { isTrustworthySection } from './account-payload.js';

function degraded(missingKeys: readonly string[], addedKeys: readonly string[]): Extract<SectionFidelity, { status: 'degraded' }> {
  return { status: 'degraded', capturedAt: '2026-08-12T00:00:00.000Z', missingKeys, addedKeys };
}

describe('isTrustworthySection', () => {
  it('an added-only drift is trustworthy', () => {
    expect(isTrustworthySection(degraded([], ['seasonal_flag']))).toBe(true);
  });

  it('any missing key is not trustworthy', () => {
    expect(isTrustworthySection(degraded(['rescues_left'], []))).toBe(false);
  });

  it('a drift with both missing and added keys is not trustworthy', () => {
    expect(isTrustworthySection(degraded(['rescues_left'], ['seasonal_flag']))).toBe(false);
  });

  it('a drift with neither missing nor added keys is trustworthy', () => {
    expect(isTrustworthySection(degraded([], []))).toBe(true);
  });
});
