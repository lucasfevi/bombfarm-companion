import { describe, expect, it } from 'vitest';
import { PVP_WINDOW_SECS } from '@bombfarm/domain/skill-tree';
import { pvpCombatInput } from './pvp-combat-input';

describe('pvpCombatInput', () => {
  it('stays empty without a standing or when no squad hero is still on the roster', () => {
    expect(pvpCombatInput(null, new Set(['a']))).toEqual({
      windowSecs: PVP_WINDOW_SECS,
      heroIds: [],
      phase: null,
      empty: true,
    });
    const history = {
      rows: [],
      totals: { duels: 0, won: 0, films: 0 },
      standing: {
        points: 1,
        tier: 'r1',
        tierNumber: 1,
        nextTierAt: null,
        tierFloor: 50,
        duelsUsed: null,
        duelsMax: null,
        slots: 3,
        slotsMax: 9,
        squadHeroIds: ['gone'],
        capturedAt: '2026-09-17T00:00:00.000Z',
      },
      rank: null,
    };
    expect(pvpCombatInput(history, new Set(['still-here']))).toMatchObject({ empty: true, heroIds: [] });
  });

  it('keeps standing slot order and uses the latest duel phase when history has one', () => {
    const history = {
      rows: [
        {
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
        },
      ],
      totals: { duels: 1, won: 1, films: 0 },
      standing: {
        points: 2,
        tier: 'r1',
        tierNumber: 1,
        nextTierAt: null,
        tierFloor: 50,
        duelsUsed: 1,
        duelsMax: 5,
        slots: 2,
        slotsMax: 9,
        squadHeroIds: ['b', 'missing', 'a'],
        capturedAt: '2026-09-17T01:00:00.000Z',
      },
      rank: null,
    };
    expect(pvpCombatInput(history, new Set(['a', 'b']))).toEqual({
      windowSecs: PVP_WINDOW_SECS,
      heroIds: ['b', 'a'],
      phase: 120,
      empty: false,
    });
  });

  it('falls back to the standing tier floor when no duel has been recorded', () => {
    const history = {
      rows: [],
      totals: { duels: 0, won: 0, films: 0 },
      standing: {
        points: 1,
        tier: 'r2',
        tierNumber: 2,
        nextTierAt: null,
        tierFloor: 80,
        duelsUsed: null,
        duelsMax: null,
        slots: 1,
        slotsMax: 9,
        squadHeroIds: ['a'],
        capturedAt: '2026-09-17T00:00:00.000Z',
      },
      rank: null,
    };
    expect(pvpCombatInput(history, new Set(['a'])).phase).toBe(80);
  });
});
