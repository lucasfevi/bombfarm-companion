import { describe, expect, it } from 'vitest';
import { isObservationCaptureEnabled } from './observation-capture.js';

const ENABLED = { BFC_OBSERVATION_CAPTURE: '1' } as const;

describe('isObservationCaptureEnabled: the full gate table', () => {
  it('stays disabled when packaged even with the enabling variable set', () => {
    expect(isObservationCaptureEnabled(ENABLED, true)).toBe(false);
  });

  it('stays disabled when packaged with the variable unset', () => {
    expect(isObservationCaptureEnabled({}, true)).toBe(false);
  });

  it('is enabled only when unpackaged and the variable is exactly "1"', () => {
    expect(isObservationCaptureEnabled(ENABLED, false)).toBe(true);
  });

  it('stays disabled when unpackaged and the variable is unset', () => {
    expect(isObservationCaptureEnabled({}, false)).toBe(false);
  });

  it('stays disabled for a truthy-looking value that is not "1"', () => {
    expect(isObservationCaptureEnabled({ BFC_OBSERVATION_CAPTURE: 'true' }, false)).toBe(false);
  });

  it('stays disabled for "0"', () => {
    expect(isObservationCaptureEnabled({ BFC_OBSERVATION_CAPTURE: '0' }, false)).toBe(false);
  });

  it('stays disabled for an empty value', () => {
    expect(isObservationCaptureEnabled({ BFC_OBSERVATION_CAPTURE: '' }, false)).toBe(false);
  });
});
