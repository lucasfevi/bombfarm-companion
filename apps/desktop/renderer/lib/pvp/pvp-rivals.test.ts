import { describe, expect, it } from 'vitest';
import type { PvpDuelRow } from '@bombfarm/contracts';
import { rivalRecords } from './pvp-rivals';

function row(id: number, defender: string, won: boolean, yours = 100, theirs = 50, recordedAt = '2026-09-16T10:00:00.000Z'): PvpDuelRow {
  return {
    id,
    recordedAt,
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

describe('rivalRecords', () => {
  it('folds every duel against one opponent into one record with both scores summed', () => {
    const [ana] = rivalRecords([row(1, 'Ana', true, 120, 80), row(2, 'Ana', false, 60, 90), row(3, 'Ana', true, 100, 100)]);
    expect(ana).toMatchObject({ name: 'Ana', duels: 3, won: 2, lost: 1, yourScore: 280, theirScore: 270 });
    expect(ana?.marginPct).toBeCloseTo((280 - 270) / 270 * 100, 6);
  });

  it('sorts the worst record first, then the most fought, then by name', () => {
    const names = rivalRecords([
      row(1, 'Even', true),
      row(2, 'Even', false),
      row(3, 'Beaten', false),
      row(4, 'Beaten', false),
      row(5, 'Beaten', true),
      row(6, 'Winning', true),
      row(7, 'Also even', true),
      row(8, 'Also even', false),
      row(9, 'Also even', true),
      row(10, 'Also even', false),
    ]).map((record) => record.name);
    expect(names).toEqual(['Beaten', 'Also even', 'Even', 'Winning']);
  });

  it('points at the newest duel against each opponent whatever order the rows came in', () => {
    const [ana] = rivalRecords([
      row(1, 'Ana', false, 100, 50, '2026-09-15T10:00:00.000Z'),
      row(2, 'Ana', true, 100, 50, '2026-09-16T10:00:00.000Z'),
      row(3, 'Ana', false, 100, 50, '2026-09-14T10:00:00.000Z'),
    ]);
    expect(ana?.latest.id).toBe(2);
  });

  it('leaves the margin null while the opponent has scored nothing, instead of dividing by zero', () => {
    const [ana] = rivalRecords([row(1, 'Ana', true, 100, 0)]);
    expect(ana?.marginPct).toBeNull();
  });

  it('is empty with no duels', () => {
    expect(rivalRecords([])).toEqual([]);
  });
});
