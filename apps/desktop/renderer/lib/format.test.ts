import { describe, expect, it } from 'vitest';
import { formatAge, formatCapturedAt, formatCount, formatDps, formatGainPct } from './format';

describe('formatAge', () => {
  it('formats zero as 0s', () => {
    expect(formatAge(0)).toBe('0s');
  });

  it('formats a sub-minute age in seconds', () => {
    expect(formatAge(45_000)).toBe('45s');
  });

  it('formats a multi-minute age in minutes', () => {
    expect(formatAge(5 * 60_000)).toBe('5m');
  });
});

describe('formatCapturedAt (MPV-04 — restored data is stamped, never presented as current)', () => {
  const now = Date.parse('2026-08-12T12:00:00.000Z');

  it('a zero-age capture reads as "just now"', () => {
    expect(formatCapturedAt('2026-08-12T12:00:00.000Z', now)).toBe('just now');
  });

  it('a sub-minute-old capture reads as "just now"', () => {
    expect(formatCapturedAt('2026-08-12T11:59:30.000Z', now)).toBe('just now');
  });

  it('a multi-day-old capture reads in whole days, never as current', () => {
    expect(formatCapturedAt('2026-08-09T12:00:00.000Z', now)).toBe('3d ago');
  });

  it('an unparseable timestamp is returned as-is rather than throwing', () => {
    expect(formatCapturedAt('not-a-date', now)).toBe('not-a-date');
  });
});

describe('formatGainPct', () => {
  it('signs a positive gain', () => {
    expect(formatGainPct(4.567)).toBe('+4.6%');
  });

  it('does not double-sign a negative gain', () => {
    expect(formatGainPct(-2.1)).toBe('-2.1%');
  });
});

describe('formatDps', () => {
  it('rounds and thousands-groups', () => {
    expect(formatDps(1234567.8)).toBe('1,234,568');
  });
});

describe('formatCount', () => {
  it('rounds and thousands-groups', () => {
    expect(formatCount(2500)).toBe('2,500');
  });
});
