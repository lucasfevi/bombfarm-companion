import { describe, expect, it } from 'vitest';
import type { PvpHistoryResult } from '@bombfarm/contracts';
import { pvpRoomPhaseInput } from './pvp-room-phase-input';

function history(rows: PvpHistoryResult['rows'] = [], standing: PvpHistoryResult['standing'] = null): PvpHistoryResult {
  return { rows, totals: { duels: rows.length, won: 0, films: 0 }, standing, rank: null };
}

const standing: NonNullable<PvpHistoryResult['standing']> = {
  points: 1,
  tier: 'r1',
  tierNumber: 1,
  nextTierAt: null,
  tierFloor: 50,
  duelsUsed: null,
  duelsMax: null,
  slots: 3,
  slotsMax: 9,
  squadHeroIds: ['b', 'a'],
  capturedAt: '2026-09-17T00:00:00.000Z',
};

const duel: PvpHistoryResult['rows'][number] = {
  id: 2,
  recordedAt: '2026-09-17T01:00:00.000Z',
  accountId: null,
  filmStored: false,
  won: true,
  phase: 120,
  filmId: 0,
  rooms: 1,
  seconds: 60,
  attacker: { name: 'you', heroes: 2, score: 10 },
  defender: { name: 'them', heroes: 2, score: 1 },
  pointsBefore: 1,
  pointsAfter: 2,
  duelsLeft: 1,
  duelsMax: 5,
  prize: null,
  tier: 'r1',
  tierFloor: 50,
  squadHeroIds: ['b', 'a'],
};

describe('pvpRoomPhaseInput', () => {
  it('is null with nothing on record', () => {
    expect(pvpRoomPhaseInput(null)).toBeNull();
    expect(pvpRoomPhaseInput(history())).toBeNull();
  });

  it('reads the tier floor from the standing until a duel has been fought', () => {
    expect(pvpRoomPhaseInput(history([], standing))).toBe(50);
  });

  it('prefers the phase of the latest duel over the tier floor', () => {
    expect(pvpRoomPhaseInput(history([duel], standing))).toBe(120);
    expect(pvpRoomPhaseInput(history([duel], null))).toBe(120);
  });
});
