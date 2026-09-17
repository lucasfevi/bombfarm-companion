import { describe, expect, it } from 'vitest';
import {
  DEFAULT_POINTS_PER_WIN,
  pointsPerWin,
  pointsSeries,
  resultMarks,
  streak,
  tierAfter,
  tierMeterPercent,
  trendWindow,
  winRate,
  winsToNextTier,
} from './pvp-trend';

function move(won: boolean, pointsBefore: number, pointsAfter: number) {
  return { won, pointsBefore, pointsAfter };
}

describe('pointsPerWin', () => {
  it('reads the step off the latest won row, newest first', () => {
    expect(pointsPerWin([move(false, 130, 120), move(true, 124, 130), move(true, 119, 124)])).toBe(6);
  });

  it('falls back to the observed default with no won row, or a won row that paid nothing', () => {
    expect(pointsPerWin([])).toBe(DEFAULT_POINTS_PER_WIN);
    expect(pointsPerWin([move(false, 130, 120)])).toBe(DEFAULT_POINTS_PER_WIN);
    expect(pointsPerWin([move(true, 130, 130)])).toBe(DEFAULT_POINTS_PER_WIN);
  });
});

describe('winsToNextTier', () => {
  it('rounds the wins up, and the days up over the daily quota', () => {
    expect(winsToNextTier({ points: 205, nextTierAt: 375, duelsMax: 10 }, 5)).toEqual({ wins: 34, days: 4 });
    expect(winsToNextTier({ points: 206, nextTierAt: 375, duelsMax: 10 }, 5)).toEqual({ wins: 34, days: 4 });
    expect(winsToNextTier({ points: 370, nextTierAt: 375, duelsMax: 10 }, 5)).toEqual({ wins: 1, days: 1 });
  });

  it('leaves the days out when the quota is not known', () => {
    expect(winsToNextTier({ points: 205, nextTierAt: 375, duelsMax: null }, 5)).toEqual({ wins: 34, days: null });
    expect(winsToNextTier({ points: 205, nextTierAt: 375, duelsMax: 0 }, 5)).toEqual({ wins: 34, days: null });
  });

  it('is null at the top tier, and never negative past the threshold', () => {
    expect(winsToNextTier({ points: 900, nextTierAt: null, duelsMax: 10 }, 5)).toBeNull();
    expect(winsToNextTier({ points: 380, nextTierAt: 375, duelsMax: 10 }, 5)).toEqual({ wins: 0, days: 0 });
  });
});

describe('tierMeterPercent', () => {
  it('fills from zero to the next threshold, clamped to the track', () => {
    expect(tierMeterPercent({ points: 205, nextTierAt: 375 })).toBeCloseTo(54.67, 2);
    expect(tierMeterPercent({ points: 0, nextTierAt: 375 })).toBe(0);
    expect(tierMeterPercent({ points: 400, nextTierAt: 375 })).toBe(100);
    expect(tierMeterPercent({ points: 400, nextTierAt: null })).toBe(100);
  });
});

describe('tierAfter', () => {
  it('counts one up from a numeric tier and has nothing to say for any other token', () => {
    expect(tierAfter('2')).toBe('3');
    expect(tierAfter('bronze')).toBeNull();
  });
});

describe('trendWindow and pointsSeries', () => {
  it('keeps the newest twelve and draws them oldest first', () => {
    const rows = Array.from({ length: 15 }, (_, index) => ({ pointsAfter: 100 + index }));
    const window = trendWindow(rows);
    expect(window).toHaveLength(12);
    expect(pointsSeries(window)).toEqual([111, 110, 109, 108, 107, 106, 105, 104, 103, 102, 101, 100]);
    expect(trendWindow(rows, 3)).toEqual([{ pointsAfter: 100 }, { pointsAfter: 101 }, { pointsAfter: 102 }]);
  });
});

describe('resultMarks', () => {
  it('tones each duel by its result, oldest first to match the series', () => {
    expect(resultMarks([{ won: true }, { won: false }, { won: false }])).toEqual(['down', 'down', 'up']);
  });
});

describe('winRate', () => {
  it('is the won share of the rows given, and zero for none', () => {
    expect(winRate([{ won: true }, { won: false }, { won: true }, { won: true }])).toBe(0.75);
    expect(winRate([])).toBe(0);
  });
});

describe('streak', () => {
  it('runs from the newest row back until the result changes', () => {
    expect(streak([{ won: true }, { won: true }, { won: false }, { won: true }])).toEqual({ result: 'won', length: 2 });
    expect(streak([{ won: false }])).toEqual({ result: 'lost', length: 1 });
    expect(streak([{ won: false }, { won: false }, { won: false }])).toEqual({ result: 'lost', length: 3 });
  });

  it('is null with no rows', () => {
    expect(streak([])).toBeNull();
  });
});
