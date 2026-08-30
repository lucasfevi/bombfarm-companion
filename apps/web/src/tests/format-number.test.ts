import { describe, expect, it } from 'vitest';
import {
  formatCompactNumber,
  formatNumber,
  numberFormatterFor,
} from '@/shared/lib/format-number';

describe('formatNumber', () => {
  it('separates in the reader own convention, which is opposite between the two languages', () => {
    expect(formatNumber(1234.5, 'en', 1)).toBe('1,234.5');
    expect(formatNumber(1234.5, 'pt', 1)).toBe('1.234,5');
  });

  it('is not merely swapping characters — a thousands group survives either way', () => {
    // `9,000` in Portuguese reads as nine, which is what this whole parameter exists to stop.
    expect(formatNumber(9000, 'en', 0)).toBe('9,000');
    expect(formatNumber(9000, 'pt', 0)).toBe('9.000');
    expect(formatNumber(1234567.8, 'pt', 1)).toBe('1.234.567,8');
  });

  it('pads fraction digits to the requested width', () => {
    expect(formatNumber(10, 'en', 2)).toBe('10.00');
    expect(formatNumber(10, 'pt', 2)).toBe('10,00');
    expect(formatNumber(10.1, 'en', 0)).toBe('10');
  });
});

describe('formatCompactNumber', () => {
  it('abbreviates thousands and millions', () => {
    expect(formatCompactNumber(90200, 'en')).toBe('90.2k');
    expect(formatCompactNumber(194460, 'en')).toBe('194.5k');
    expect(formatCompactNumber(12174, 'en')).toBe('12.2k');
    expect(formatCompactNumber(1_200_000, 'en')).toBe('1.2m');
  });

  it('carries the language into the abbreviated mantissa, not just the full number', () => {
    expect(formatCompactNumber(90200, 'pt')).toBe('90,2k');
    expect(formatCompactNumber(1_200_000, 'pt')).toBe('1,2m');
    expect(formatCompactNumber(1_720_000_000, 'pt')).toBe('1,7bi');
  });

  it('drops a zero fraction in either convention rather than printing 24,0bi', () => {
    expect(formatCompactNumber(24_000_000_000, 'en')).toBe('24bi');
    expect(formatCompactNumber(24_000_000_000, 'pt')).toBe('24bi');
  });

  it('keeps values under 1k readable', () => {
    expect(formatCompactNumber(999, 'en')).toBe('999');
    expect(formatCompactNumber(86.3, 'en', 1)).toBe('86.3');
    expect(formatCompactNumber(86.3, 'pt', 1)).toBe('86,3');
  });

  it('preserves sign', () => {
    expect(formatCompactNumber(-1500, 'en')).toBe('-1.5k');
    expect(formatCompactNumber(-2_000_000_000, 'pt')).toBe('-2bi');
  });
});

describe('numberFormatterFor', () => {
  it('binds one language into the two-argument shape the injected formatters use', () => {
    const pt = numberFormatterFor('pt');
    expect(pt(1234.5, 1)).toBe('1.234,5');
    expect(pt(10, 2)).toBe('10,00');
  });

  it('binds the language, not the moment — the same formatter keeps its own language', () => {
    const en = numberFormatterFor('en');
    const pt = numberFormatterFor('pt');
    expect(en(9000, 0)).toBe('9,000');
    expect(pt(9000, 0)).toBe('9.000');
  });
});
