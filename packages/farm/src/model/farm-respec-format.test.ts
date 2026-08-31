import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  formatGainPct,
  formatGold,
  formatHours,
  formatSignedPct,
} from './farm-respec-format';

describe('farm-respec-format', () => {
  it('is React-free — no import from "react" anywhere in the file', () => {
    const source = readFileSync(
      new URL('./farm-respec-format.ts', import.meta.url),
      'utf8',
    );
    expect(source).not.toMatch(/from ['"]react['"]/);
  });

  describe('formatGainPct', () => {
    it.each([
      [12.793113950535506, '12.8'],
      [0, '0.0'],
      [5, '5.0'],
    ])('formats %s as %s', (value, expected) => {
      expect(formatGainPct(value, 'en')).toBe(expected);
    });

    it('non-finite input renders the dash, never NaN or Infinity text', () => {
      expect(formatGainPct(Number.NaN, 'en')).toBe('—');
      expect(formatGainPct(Number.POSITIVE_INFINITY, 'en')).toBe('—');
    });
  });

  describe('formatGold', () => {
    it.each([
      [83000, '83,000'],
      [0, '0'],
      [1500, '1,500'],
    ])('formats %s as %s (whole numbers, thousands separator)', (value, expected) => {
      expect(formatGold(value, 'en')).toBe(expected);
    });

    it('non-finite input renders the dash', () => {
      expect(formatGold(Number.NaN, 'en')).toBe('—');
    });
  });

  describe('formatHours', () => {
    it.each([
      [2.4482758383687027, '2.4'],
      [0, '0.0'],
    ])('formats %s as %s', (value, expected) => {
      expect(formatHours(value, 'en')).toBe(expected);
    });

    it('non-finite input renders the dash', () => {
      expect(formatHours(Number.POSITIVE_INFINITY, 'en')).toBe('—');
    });
  });

  describe('formatSignedPct', () => {
    it('a positive change gets a plus sign, one decimal', () => {
      expect(formatSignedPct(12.793113950535506, 'en')).toBe('+12.8');
    });

    it('a negative change gets a minus sign, magnitude only after it', () => {
      expect(formatSignedPct(-10.649355160356, 'en')).toBe('-10.6');
    });

    it('zero gets no sign', () => {
      expect(formatSignedPct(0, 'en')).toBe('0.0');
    });

    it('non-finite input renders the dash, never NaN or Infinity text', () => {
      expect(formatSignedPct(Number.NaN, 'en')).toBe('—');
      expect(formatSignedPct(Number.POSITIVE_INFINITY, 'en')).toBe('—');
    });
  });
});
