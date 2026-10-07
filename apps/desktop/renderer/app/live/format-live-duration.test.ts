import { describe, expect, it } from 'vitest';
import { STRINGS } from '../../lib/copy';
import { coverageMinutesLabel, formatLiveDurationMinutes, formatLiveDurationSeconds } from './format-live-duration';

describe('formatLiveDurationMinutes', () => {
  it.each(['en', 'pt-BR'] as const)('reads under a minute as <1 min in %s, down to a genuine zero', (locale) => {
    expect(formatLiveDurationMinutes(0, STRINGS[locale])).toBe('<1 min');
    expect(formatLiveDurationMinutes(59.9, STRINGS[locale])).toBe('<1 min');
  });

  it('clamps a negative span to under a minute', () => {
    expect(formatLiveDurationMinutes(-30, STRINGS.en)).toBe('<1 min');
  });

  it.each([
    [60, '1 min'],
    [119.9, '1 min'],
    [2_700, '45 min'],
    [3_599, '59 min'],
  ])('reads %d seconds as %s, whole minutes rounded down', (seconds, text) => {
    expect(formatLiveDurationMinutes(seconds, STRINGS.en)).toBe(text);
    expect(formatLiveDurationMinutes(seconds, STRINGS['pt-BR'])).toBe(text);
  });

  it.each([
    [3_600, '1 h 00 min'],
    [3_660, '1 h 01 min'],
    [3_725, '1 h 02 min'],
    [7_199, '1 h 59 min'],
    [36_000, '10 h 00 min'],
  ])('reads %d seconds as %s once it reaches an hour, minutes zero-padded', (seconds, text) => {
    expect(formatLiveDurationMinutes(seconds, STRINGS.en)).toBe(text);
    expect(formatLiveDurationMinutes(seconds, STRINGS['pt-BR'])).toBe(text);
  });

  it('never shows a shorter span longer than the longer one it sits inside', () => {
    const minutesOf = (text: string) => {
      const hoursAndMinutes = /^(\d+) h (\d+) min$/.exec(text);
      if (hoursAndMinutes) return Number(hoursAndMinutes[1]) * 60 + Number(hoursAndMinutes[2]);
      return text === '<1 min' ? 0 : Number.parseInt(text, 10);
    };

    for (let field = 0; field <= 7_300; field += 37) {
      const shown = formatLiveDurationMinutes(field, STRINGS.en);
      const sessionShown = formatLiveDurationMinutes(field + 13, STRINGS.en);
      expect(minutesOf(shown)).toBeLessThanOrEqual(minutesOf(sessionShown));
    }
  });
});

describe('formatLiveDurationSeconds', () => {
  it('renders a genuine zero as 0:00, not a blank string', () => {
    expect(formatLiveDurationSeconds(0)).toBe('0:00');
  });

  it('renders minutes and seconds, zero-padding only the seconds', () => {
    expect(formatLiveDurationSeconds(65)).toBe('1:05');
  });

  it('renders hours once the duration reaches an hour, zero-padding minutes and seconds', () => {
    expect(formatLiveDurationSeconds(3661)).toBe('1:01:01');
  });

  it('rounds to the nearest whole second rather than truncating', () => {
    expect(formatLiveDurationSeconds(59.6)).toBe('1:00');
  });

  it('clamps a negative duration to zero instead of printing a negative sign', () => {
    expect(formatLiveDurationSeconds(-5)).toBe('0:00');
  });
});

describe('coverageMinutesLabel', () => {
  it.each([
    [0, 1],
    [59, 1],
    [60, 1],
    [119, 1],
    [120, 2],
    [599, 9],
    [600, 10],
    [5_000, 10],
  ])('coverageSeconds=%d reads %d min, floored and capped at ten', (coverageSeconds, minutes) => {
    expect(coverageMinutesLabel(coverageSeconds)).toBe(minutes);
  });
});
