import { describe, expect, it } from 'vitest';
import { formatCompactNumber, formatNumber } from '@/shared/lib/format-number';

describe('formatNumber', () => {
  it('uses . as decimal separator', () => {
    expect(formatNumber(12.5, 1)).toBe('12.5');
    expect(formatNumber(1.333, 3)).toBe('1.333');
  });

  it('uses , as thousand separator', () => {
    expect(formatNumber(1234, 0)).toBe('1,234');
    expect(formatNumber(1234567.8, 1)).toBe('1,234,567.8');
  });

  it('pads fraction digits to the requested width', () => {
    expect(formatNumber(10, 2)).toBe('10.00');
    expect(formatNumber(10.1, 0)).toBe('10');
  });
});

describe('formatCompactNumber', () => {
  it('abbreviates thousands and millions', () => {
    expect(formatCompactNumber(90200)).toBe('90.2k');
    expect(formatCompactNumber(194460)).toBe('194.5k');
    expect(formatCompactNumber(12174)).toBe('12.2k');
    expect(formatCompactNumber(1_200_000)).toBe('1.2m');
  });

  it('keeps values under 1k readable', () => {
    expect(formatCompactNumber(999)).toBe('999');
    expect(formatCompactNumber(86.3, 1)).toBe('86.3');
  });

  it('preserves sign', () => {
    expect(formatCompactNumber(-1500)).toBe('-1.5k');
  });
});
