import { describe, expect, it } from 'vitest';
import { formatElapsed } from './optimizing-elapsed';

describe('formatElapsed', () => {
  it('renders under a minute as bare seconds', () => {
    expect(formatElapsed(45_000)).toBe('45s');
    expect(formatElapsed(0)).toBe('0s');
  });

  it('renders a minute or more as m:ss, zero-padded', () => {
    expect(formatElapsed(65_000)).toBe('1:05');
    expect(formatElapsed(600_000)).toBe('10:00');
  });
});
