import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  formatGainPct,
  formatGold,
  formatHours,
  formatSharePct,
  formatSignedPct,
  formatSignedPoints,
} from '@/features/phases/model/farm-respec-format';
import { WEB_PACKAGE_ROOT } from './helpers/web-package-root';

describe('farm-respec-format', () => {
  it('is React-free — no import from "react" anywhere in the file', () => {
    const source = readFileSync(
      `${WEB_PACKAGE_ROOT}/src/features/phases/model/farm-respec-format.ts`,
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
      expect(formatGainPct(value)).toBe(expected);
    });

    it('non-finite input renders the dash, never NaN or Infinity text', () => {
      expect(formatGainPct(Number.NaN)).toBe('—');
      expect(formatGainPct(Number.POSITIVE_INFINITY)).toBe('—');
    });
  });

  describe('formatGold', () => {
    it.each([
      [83000, '83,000'],
      [0, '0'],
      [1500, '1,500'],
    ])('formats %s as %s (whole numbers, thousands separator)', (value, expected) => {
      expect(formatGold(value)).toBe(expected);
    });

    it('non-finite input renders the dash', () => {
      expect(formatGold(Number.NaN)).toBe('—');
    });
  });

  describe('formatHours', () => {
    it.each([
      [2.4482758383687027, '2.4'],
      [0, '0.0'],
    ])('formats %s as %s', (value, expected) => {
      expect(formatHours(value)).toBe(expected);
    });

    it('non-finite input renders the dash', () => {
      expect(formatHours(Number.POSITIVE_INFINITY)).toBe('—');
    });
  });

  describe('formatSharePct', () => {
    it.each([
      [0.55, '55'],
      [0.754, '75'],
      [1, '100'],
      [0, '0'],
    ])('formats fraction %s as whole-percent %s', (fraction, expected) => {
      expect(formatSharePct(fraction)).toBe(expected);
    });

    it('non-finite input renders the dash', () => {
      expect(formatSharePct(Number.NaN)).toBe('—');
    });
  });

  describe('formatSignedPoints', () => {
    it('a positive delta gets a plus sign', () => {
      expect(formatSignedPoints(3)).toBe('+3');
    });

    it('a negative delta gets a minus sign, magnitude only after it', () => {
      expect(formatSignedPoints(-2)).toBe('-2');
    });

    it('zero gets no sign', () => {
      expect(formatSignedPoints(0)).toBe('0');
    });

    it('non-finite input renders the dash', () => {
      expect(formatSignedPoints(Number.NaN)).toBe('—');
    });
  });

  describe('formatSignedPct', () => {
    it('a positive change gets a plus sign, one decimal', () => {
      expect(formatSignedPct(12.793113950535506)).toBe('+12.8');
    });

    it('a negative change gets a minus sign, magnitude only after it', () => {
      expect(formatSignedPct(-10.649355160356)).toBe('-10.6');
    });

    it('zero gets no sign', () => {
      expect(formatSignedPct(0)).toBe('0.0');
    });

    it('non-finite input renders the dash, never NaN or Infinity text', () => {
      expect(formatSignedPct(Number.NaN)).toBe('—');
      expect(formatSignedPct(Number.POSITIVE_INFINITY)).toBe('—');
    });
  });
});
