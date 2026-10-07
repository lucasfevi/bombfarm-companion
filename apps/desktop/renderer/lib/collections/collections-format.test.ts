import { describe, expect, it } from 'vitest';
import { fillPercent, formatBonus, formatLimit } from './collections-format';

describe('formatBonus', () => {
  it('prints a sign and drops trailing zeros', () => {
    expect(formatBonus(13.65, 'en')).toBe('+13.65%');
    expect(formatBonus(7.74, 'en')).toBe('+7.74%');
    expect(formatBonus(30, 'en')).toBe('+30%');
    expect(formatBonus(0.5, 'en')).toBe('+0.5%');
  });

  it('prints a bonus of nothing as +0%, not as a bare zero', () => {
    expect(formatBonus(0, 'en')).toBe('+0%');
  });

  it('keeps at most two decimals, so a rounded cent never shows float noise', () => {
    expect(formatBonus(0.1 + 0.2, 'en')).toBe('+0.3%');
    expect(formatBonus(26.000000000000004, 'en')).toBe('+26%');
    expect(formatBonus(12.345, 'en')).toBe('+12.35%');
  });

  it('follows the language for the decimal separator', () => {
    expect(formatBonus(13.65, 'pt-BR')).toBe('+13,65%');
    expect(formatBonus(30, 'pt-BR')).toBe('+30%');
  });
});

describe('formatLimit', () => {
  it('prints a cap without a sign', () => {
    expect(formatLimit(75, 'en')).toBe('75%');
    expect(formatLimit(22.5, 'en')).toBe('22.5%');
    expect(formatLimit(22.5, 'pt-BR')).toBe('22,5%');
  });
});

describe('fillPercent', () => {
  it('is the share of the limit reached', () => {
    expect(fillPercent(15, 60)).toBe(25);
  });

  it('stops at a full track however far past the limit the value is', () => {
    expect(fillPercent(42.13, 30)).toBe(100);
  });

  it('is empty for nothing, for a negative, and for an axis with no limit', () => {
    expect(fillPercent(0, 30)).toBe(0);
    expect(fillPercent(-1, 30)).toBe(0);
    expect(fillPercent(10, 0)).toBe(0);
  });
});
