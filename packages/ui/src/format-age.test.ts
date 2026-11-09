import { describe, expect, it } from 'vitest';
import { formatAge, formatTimeAgo } from './format-age';

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe('formatAge — a short elapsed span', () => {
  it.each([
    [0, '0s', '0s'],
    [45 * SECOND, '45s', '45s'],
    [59.4 * SECOND, '59s', '59s'],
    [5 * MINUTE, '5m', '5min'],
    [90 * MINUTE, '90m', '90min'],
  ])('%d ms reads %s in English and %s in Portuguese', (ms, english, portuguese) => {
    expect(formatAge(ms, 'en')).toBe(english);
    expect(formatAge(ms, 'pt')).toBe(portuguese);
  });

  it('a negative span reads as zero seconds', () => {
    expect(formatAge(-5 * SECOND, 'en')).toBe('0s');
  });
});

describe('formatTimeAgo — how long ago, in four buckets', () => {
  it.each([
    [0, 'just now', 'agora mesmo'],
    [30 * SECOND, 'just now', 'agora mesmo'],
    [5 * MINUTE, '5m ago', 'há 5m'],
    [3 * HOUR, '3h ago', 'há 3h'],
    [3 * DAY, '3d ago', 'há 3d'],
  ])('%d ms reads %s in English and %s in Portuguese', (ms, english, portuguese) => {
    expect(formatTimeAgo(ms, 'en')).toBe(english);
    expect(formatTimeAgo(ms, 'pt')).toBe(portuguese);
  });

  it('an age from a clock ahead of ours reads as just now', () => {
    expect(formatTimeAgo(-10 * MINUTE, 'en')).toBe('just now');
  });
});
