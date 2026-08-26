import { describe, expect, it } from 'vitest';
import { formatLiveDurationSeconds } from './format-live-duration';

describe('formatLiveDurationSeconds', () => {
  it('renders a genuine zero as 0:00, not a blank string', () => {
    expect(formatLiveDurationSeconds(0)).toBe('0:00');
  });

  it('renders minutes and seconds, zero-padding only the seconds', () => {
    expect(formatLiveDurationSeconds(65)).toBe('1:05');
  });

  it('renders hours once the duration reaches an hour, zero-padding minutes and seconds', () => {
    expect(formatLiveDurationSeconds(3661)).toBe('1:01:01');
  });

  it('rounds to the nearest whole second rather than truncating', () => {
    expect(formatLiveDurationSeconds(59.6)).toBe('1:00');
  });

  it('clamps a negative duration to zero instead of printing a negative sign', () => {
    expect(formatLiveDurationSeconds(-5)).toBe('0:00');
  });
});
