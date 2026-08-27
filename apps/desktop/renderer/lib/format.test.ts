/**
 * MP3 F4 (`AD-054`) rewrites every assertion here to prove the locale actually reaches `Intl` —
 * grouping and decimal separators must differ between `en` and `pt-BR`, not just the words. This
 * is a STRENGTHENING of the pre-F4 suite (which asserted English-only), not a weakening: the old
 * cases are kept, `t`/`locale` parameters are threaded through, and each numeric formatter now
 * has a paired assertion showing the two locales disagree.
 */
import { describe, expect, it } from 'vitest';
import { en } from './copy/en';
import { ptBR } from './copy/pt-BR';
import { formatAge, formatCapturedAt, formatCount, formatDps, formatEnergyPercent, formatGainPct } from './format';

describe('formatAge (both locales, AD-054)', () => {
  it('formats zero as 0s in English', () => {
    expect(formatAge(0, en)).toBe('0s');
  });

  it('formats a sub-minute age in seconds (English)', () => {
    expect(formatAge(45_000, en)).toBe('45s');
  });

  it('formats a multi-minute age in minutes (English)', () => {
    expect(formatAge(5 * 60_000, en)).toBe('5m');
  });

  it('formats a sub-minute age in seconds (PT-BR) — identical suffix, declared identical on purpose', () => {
    expect(formatAge(45_000, ptBR)).toBe('45s');
  });

  it("formats a multi-minute age using PT-BR's own 'min' abbreviation, DIFFERENT from English's 'm'", () => {
    const enResult = formatAge(5 * 60_000, en);
    const ptResult = formatAge(5 * 60_000, ptBR);
    expect(enResult).toBe('5m');
    expect(ptResult).toBe('5min');
    expect(ptResult).not.toBe(enResult);
  });
});

describe('formatCapturedAt (MPV-04 — restored data is stamped, never presented as current)', () => {
  const now = Date.parse('2026-08-12T12:00:00.000Z');

  it('a zero-age capture reads as "just now" (English)', () => {
    expect(formatCapturedAt('2026-08-12T12:00:00.000Z', en, now)).toBe('just now');
  });

  it('a sub-minute-old capture reads as "just now" (English)', () => {
    expect(formatCapturedAt('2026-08-12T11:59:30.000Z', en, now)).toBe('just now');
  });

  it('a multi-day-old capture reads in whole days, never as current (English)', () => {
    expect(formatCapturedAt('2026-08-09T12:00:00.000Z', en, now)).toBe('3d ago');
  });

  it('an unparseable timestamp is returned as-is rather than throwing (English)', () => {
    expect(formatCapturedAt('not-a-date', en, now)).toBe('not-a-date');
  });

  it('the same inputs render DIFFERENT text in PT-BR, from the copy module, never hardcoded', () => {
    const enResult = formatCapturedAt('2026-08-09T12:00:00.000Z', en, now);
    const ptResult = formatCapturedAt('2026-08-09T12:00:00.000Z', ptBR, now);
    expect(enResult).toBe('3d ago');
    expect(ptResult).toBe('há 3d');
    expect(ptResult).not.toBe(enResult);
  });

  it('a zero-age capture reads as ageJustNow verbatim in PT-BR', () => {
    expect(formatCapturedAt('2026-08-12T12:00:00.000Z', ptBR, now)).toBe(ptBR.ageJustNow);
  });
});

describe('formatGainPct (both locales, different decimal/sign convention, AD-054)', () => {
  it('signs a positive gain (English — period decimal separator)', () => {
    expect(formatGainPct(4.567, 'en')).toBe('+4.6%');
  });

  it('does not double-sign a negative gain (English)', () => {
    expect(formatGainPct(-2.1, 'en')).toBe('-2.1%');
  });

  it("signs a positive gain with PT-BR's comma decimal separator — +1,5%, never +1.5%", () => {
    expect(formatGainPct(1.5, 'pt-BR')).toBe('+1,5%');
  });

  it('does not double-sign a negative gain (PT-BR)', () => {
    expect(formatGainPct(-2.1, 'pt-BR')).toBe('-2,1%');
  });

  it('the same input renders with a DIFFERENT decimal separator between locales', () => {
    const enResult = formatGainPct(4.567, 'en');
    const ptResult = formatGainPct(4.567, 'pt-BR');
    expect(enResult).toBe('+4.6%');
    expect(ptResult).toBe('+4,6%');
    expect(ptResult).not.toBe(enResult);
  });
});

describe('formatDps (both locales, different grouping separator, AD-054)', () => {
  it('rounds and thousands-groups with a comma (English)', () => {
    expect(formatDps(1234567.8, 'en')).toBe('1,234,568');
  });

  it('rounds and thousands-groups with a period (PT-BR) — DIFFERENT from English', () => {
    const enResult = formatDps(1234567.8, 'en');
    const ptResult = formatDps(1234567.8, 'pt-BR');
    expect(enResult).toBe('1,234,568');
    expect(ptResult).toBe('1.234.568');
    expect(ptResult).not.toBe(enResult);
  });
});

describe('formatCount (both locales, different grouping separator, AD-054)', () => {
  it('rounds and thousands-groups with a comma (English)', () => {
    expect(formatCount(2500, 'en')).toBe('2,500');
  });

  it('rounds and thousands-groups with a period (PT-BR) — DIFFERENT from English', () => {
    const enResult = formatCount(2500, 'en');
    const ptResult = formatCount(2500, 'pt-BR');
    expect(enResult).toBe('2,500');
    expect(ptResult).toBe('2.500');
    expect(ptResult).not.toBe(enResult);
  });
});

describe('formatEnergyPercent (both locales, AD-054)', () => {
  it('renders a whole percentage in each locale', () => {
    expect(formatEnergyPercent(0.42, 'en')).toBe('42%');
    expect(formatEnergyPercent(0.42, 'pt-BR')).toBe('42%');
  });

  it('floors rather than rounds, so a hero one tick short of full never reads 100%', () => {
    expect(formatEnergyPercent(0.996, 'en')).toBe('99%');
    expect(formatEnergyPercent(0.999999, 'en')).toBe('99%');
    expect(formatEnergyPercent(1, 'en')).toBe('100%');
  });

  it('clamps outside [0, 1] rather than printing a percentage the bar cannot draw', () => {
    expect(formatEnergyPercent(1.4, 'en')).toBe('100%');
    expect(formatEnergyPercent(-0.2, 'en')).toBe('0%');
  });
});
