import { describe, expect, it } from 'vitest';
import type { PvpHistoryResult } from '@bombfarm/contracts';
import { pvpSquadSlotsInput } from './pvp-squad-slots-input';

function history(standing: PvpHistoryResult['standing']): PvpHistoryResult {
  return { rows: [], totals: { duels: 0, won: 0, films: 0 }, standing, rank: null };
}

const standing: NonNullable<PvpHistoryResult['standing']> = {
  points: 1,
  tier: 'r1',
  tierNumber: 1,
  nextTierAt: null,
  tierFloor: 50,
  duelsUsed: null,
  duelsMax: null,
  slots: 6,
  slotsMax: 9,
  squadHeroIds: ['a'],
  capturedAt: '2026-09-17T00:00:00.000Z',
};

describe('pvpSquadSlotsInput', () => {
  it('is null with no standing on record, so the plan assumes the top squad house', () => {
    expect(pvpSquadSlotsInput(null)).toBeNull();
    expect(pvpSquadSlotsInput(history(null))).toBeNull();
    expect(pvpSquadSlotsInput(history({ ...standing, slots: null }))).toBeNull();
  });

  it('reads the slots the account can field now, never the top of the ladder', () => {
    expect(pvpSquadSlotsInput(history(standing))).toBe(6);
  });
});
