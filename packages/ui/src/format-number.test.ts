import { describe, expect, it } from 'vitest';
import { formatCompactNumber, formatSignificantCompact } from './format-number';

describe('formatSignificantCompact', () => {
  it('keeps three significant digits, including trailing zeros that still count', () => {
    expect(formatSignificantCompact(4_300_000, 'en', 3)).toBe('4.30m');
    expect(formatSignificantCompact(3_900, 'en', 3)).toBe('3.90k');
    expect(formatSignificantCompact(12_300, 'en', 3)).toBe('12.3k');
    expect(formatSignificantCompact(430, 'en', 3)).toBe('430');
  });

  it('uses the reader\'s decimal separator', () => {
    expect(formatSignificantCompact(4_300_000, 'pt', 3)).toBe('4,30m');
    expect(formatSignificantCompact(3_900, 'pt', 3)).toBe('3,90k');
  });

  it('prints a non-finite value as an em dash', () => {
    expect(formatSignificantCompact(Number.POSITIVE_INFINITY, 'en', 3)).toBe('—');
    expect(formatSignificantCompact(Number.NaN, 'en', 3)).toBe('—');
  });

  it('one-decimal compact still collapses 4.3m, which is why rates use the significant form', () => {
    expect(formatCompactNumber(4_300_000, 'en', 1)).toBe('4.3m');
    expect(formatCompactNumber(4_303_900, 'en', 1)).toBe('4.3m');
  });
});
