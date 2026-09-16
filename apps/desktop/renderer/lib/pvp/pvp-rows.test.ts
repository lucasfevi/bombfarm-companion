import { describe, expect, it } from 'vitest';
import type { PvpDuelRow } from '@bombfarm/contracts';
import { ALL_OPPONENTS, filterDuels, formatPointsDelta, headToHead, opponentNames, tierNumberOf } from './pvp-rows';

function row(id: number, defender: string, won: boolean, yours = 100, theirs = 50): PvpDuelRow {
  return {
    id,
    recordedAt: '2026-09-16T10:00:00.000Z',
    accountId: null,
    filmStored: false,
    won,
    phase: 120,
    filmId: 0,
    rooms: 0,
    seconds: 60,
    attacker: { name: 'Me', heroes: 9, score: yours },
    defender: { name: defender, heroes: 8, score: theirs },
    pointsBefore: 0,
    pointsAfter: won ? 5 : -10,
    duelsLeft: 1,
    duelsMax: 10,
    prize: 'won',
    tier: 'r2',
    tierFloor: 50,
    squadHeroIds: [],
  };
}

describe('tierNumberOf', () => {
  it('prints the number the state carries, else the one the token spells, else the token as it came', () => {
    expect(tierNumberOf('r2', 2)).toBe('2');
    expect(tierNumberOf('r3')).toBe('3');
    expect(tierNumberOf('R6')).toBe('6');
    expect(tierNumberOf('bronze')).toBe('bronze');
  });
});

describe('formatPointsDelta', () => {
  it('signs every non-zero move', () => {
    expect(formatPointsDelta({ pointsBefore: 200, pointsAfter: 205 }, 'en')).toBe('+5');
    expect(formatPointsDelta({ pointsBefore: 205, pointsAfter: 195 }, 'en')).toBe('-10');
    expect(formatPointsDelta({ pointsBefore: 5, pointsAfter: 5 }, 'en')).toBe('0');
  });
});

describe('the opponent and result filters', () => {
  const rows = [row(4, 'Silent', false, 90, 120), row(3, 'Corvo', true), row(2, 'Silent', true, 110, 80), row(1, 'Tempestade', false)];

  it('lists opponents most fought first, then by name', () => {
    expect(opponentNames(rows)).toEqual(['Silent', 'Corvo', 'Tempestade']);
  });

  it('narrows by opponent, by result, and by both', () => {
    expect(filterDuels(rows, ALL_OPPONENTS, 'all').map((r) => r.id)).toEqual([4, 3, 2, 1]);
    expect(filterDuels(rows, 'Silent', 'all').map((r) => r.id)).toEqual([4, 2]);
    expect(filterDuels(rows, ALL_OPPONENTS, 'lost').map((r) => r.id)).toEqual([4, 1]);
    expect(filterDuels(rows, 'Silent', 'won').map((r) => r.id)).toEqual([2]);
    expect(filterDuels(rows, 'Nobody', 'all')).toEqual([]);
  });

  it('sums the rivalry against one opponent over every duel, whatever the result filter shows', () => {
    expect(headToHead(rows, 'Silent')).toEqual({ duels: 2, won: 1, lost: 1, yourScore: 200, theirScore: 200 });
    expect(headToHead(rows, 'Nobody')).toEqual({ duels: 0, won: 0, lost: 0, yourScore: 0, theirScore: 0 });
  });
});
