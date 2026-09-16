import { describe, expect, it } from 'vitest';
import { ROUTE_FINGERPRINTS } from '../fingerprints.js';
import { identifyObservedBody } from '../identify-observed-body.js';
import { checkShape } from '../shape.js';
import { identifyPvpBody } from './identify.js';
import { wireKey } from './lexicon.js';
import { parsePvpDuelResult, parsePvpFilm } from './parse.js';

function side(name: string, heroes: unknown, score: number): Record<string, unknown> {
  return { [wireKey('sideName')]: name, [wireKey('sideHeroes')]: heroes, [wireKey('sideScore')]: score };
}

function duelResult(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    [wireKey('won')]: true,
    [wireKey('phase')]: 120,
    [wireKey('filmId')]: 48117,
    [wireKey('rooms')]: 3,
    [wireKey('seconds')]: 60,
    [wireKey('attacker')]: side('Player', 5, 184320),
    [wireKey('defender')]: side('Opponent', 4, 151960),
    [wireKey('pointsBefore')]: 118,
    [wireKey('pointsAfter')]: 123,
    [wireKey('duelsLeft')]: 3,
    [wireKey('duelsMax')]: 5,
    [wireKey('prize')]: 'won',
    [wireKey('state')]: {
      [wireKey('statePoints')]: 123,
      [wireKey('stateTier')]: 'r3',
      [wireKey('stateTierNumber')]: 3,
      [wireKey('stateTierNext')]: 150,
      [wireKey('phase')]: 100,
      [wireKey('stateSlots')]: 5,
      [wireKey('stateSquad')]: [
        { [wireKey('squadSlot')]: 1, [wireKey('squadHeroId')]: 'h-second' },
        { [wireKey('squadSlot')]: 0, [wireKey('squadHeroId')]: 'h-first' },
      ],
      [wireKey('stateDuelsUsed')]: 2,
      [wireKey('duelsMax')]: 5,
      [wireKey('stateEnabled')]: true,
    },
    ...overrides,
  };
}

function film(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    [wireKey('filmIdField')]: 48117,
    [wireKey('phase')]: 120,
    [wireKey('filmVisualPhase')]: 51,
    [wireKey('filmHz')]: 12,
    [wireKey('seconds')]: 60,
    [wireKey('rooms')]: 3,
    [wireKey('filmAttackerHeroes')]: [],
    [wireKey('filmDefenderHeroes')]: [],
    [wireKey('filmFrames')]: [{ [wireKey('frameT')]: 0 }, { [wireKey('frameT')]: 0.0833 }],
    ...overrides,
  };
}

describe('identifyPvpBody', () => {
  it('names a duel result by the won flag and the film id together', () => {
    expect(identifyPvpBody(duelResult())).toBe('duel');
  });

  it('names a film by its frames array and its phase together', () => {
    expect(identifyPvpBody(film())).toBe('film');
  });

  it('refuses a body carrying only half of either pair', () => {
    expect(identifyPvpBody({ [wireKey('won')]: true })).toBeNull();
    expect(identifyPvpBody({ [wireKey('filmId')]: 1 })).toBeNull();
    expect(identifyPvpBody({ [wireKey('filmFrames')]: [] })).toBeNull();
    expect(identifyPvpBody({ [wireKey('phase')]: 3 })).toBeNull();
  });

  it('refuses a body carrying both pairs rather than guessing', () => {
    expect(identifyPvpBody({ ...duelResult(), ...film() })).toBeNull();
  });

  it('refuses a non-object without throwing', () => {
    expect(identifyPvpBody(null)).toBeNull();
    expect(identifyPvpBody([1])).toBeNull();
    expect(identifyPvpBody('x')).toBeNull();
  });
});

describe('identifyObservedBody: the PVP bodies are their own verdict', () => {
  it('returns the pvp verdict for a duel result and for a film', () => {
    expect(identifyObservedBody(duelResult())).toEqual({ kind: 'pvp', route: 'duel' });
    expect(identifyObservedBody(film())).toEqual({ kind: 'pvp', route: 'film' });
  });

  it('matches neither body against any account section fingerprint', () => {
    for (const body of [duelResult(), film()]) {
      for (const fingerprint of Object.values(ROUTE_FINGERPRINTS)) {
        expect(checkShape(body, fingerprint).ok).toBe(false);
      }
    }
  });
});

describe('parsePvpDuelResult', () => {
  it('reads every row field, and the squad in slot order', () => {
    expect(parsePvpDuelResult(duelResult())).toEqual({
      won: true,
      phase: 120,
      filmId: 48117,
      rooms: 3,
      seconds: 60,
      attacker: { name: 'Player', heroes: 5, score: 184320 },
      defender: { name: 'Opponent', heroes: 4, score: 151960 },
      pointsBefore: 118,
      pointsAfter: 123,
      duelsLeft: 3,
      duelsMax: 5,
      prize: 'won',
      tier: 'r3',
      tierFloor: 100,
      squadHeroIds: ['h-first', 'h-second'],
    });
  });

  it('keeps the room phase and the tier floor apart', () => {
    const record = parsePvpDuelResult(duelResult());
    expect(record?.phase).toBe(120);
    expect(record?.tierFloor).toBe(100);
  });

  it('reads a side that lists its heroes as a count of them', () => {
    const record = parsePvpDuelResult(duelResult({ [wireKey('defender')]: side('Opponent', [{}, {}, {}], 10) }));
    expect(record?.defender.heroes).toBe(3);
  });

  it('records a duel without a film as film id 0', () => {
    expect(parsePvpDuelResult(duelResult({ [wireKey('filmId')]: 0 }))?.filmId).toBe(0);
  });

  it('refuses a result missing a field the row cannot do without', () => {
    expect(parsePvpDuelResult(duelResult({ [wireKey('prize')]: 'maybe' }))).toBeNull();
    expect(parsePvpDuelResult(duelResult({ [wireKey('attacker')]: null }))).toBeNull();
    expect(parsePvpDuelResult(duelResult({ [wireKey('state')]: {} }))).toBeNull();
    expect(parsePvpDuelResult(duelResult({ [wireKey('pointsAfter')]: '123' }))).toBeNull();
    expect(parsePvpDuelResult('nope')).toBeNull();
  });

  it('tolerates a squad the state does not carry', () => {
    const state = { [wireKey('stateTier')]: 'r1', [wireKey('phase')]: 1 };
    expect(parsePvpDuelResult(duelResult({ [wireKey('state')]: state }))?.squadHeroIds).toEqual([]);
  });
});

describe('parsePvpFilm', () => {
  it('reads the header and counts the frames without decoding them', () => {
    expect(parsePvpFilm(film())).toEqual({
      filmId: 48117,
      phase: 120,
      visualPhase: 51,
      hz: 12,
      seconds: 60,
      rooms: 3,
      frames: 2,
    });
  });

  it('refuses a film with no id, no phase or no frames', () => {
    expect(parsePvpFilm(film({ [wireKey('filmIdField')]: undefined }))).toBeNull();
    expect(parsePvpFilm(film({ [wireKey('phase')]: undefined }))).toBeNull();
    expect(parsePvpFilm(film({ [wireKey('filmFrames')]: 'frames' }))).toBeNull();
  });
});
