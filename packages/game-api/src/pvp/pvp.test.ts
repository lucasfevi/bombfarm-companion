import { describe, expect, it } from 'vitest';
import { ROUTE_FINGERPRINTS } from '../fingerprints.js';
import { identifyObservedBody } from '../identify-observed-body.js';
import { checkShape } from '../shape.js';
import { identifyPvpBody } from './identify.js';
import { wireKey } from './lexicon.js';
import { isPvpPointsBoard, parsePvpDuelResult, parsePvpDuelState, parsePvpFilm, parsePvpRanking, parsePvpState } from './parse.js';

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

function stateBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    [wireKey('statePoints')]: 205,
    [wireKey('stateTier')]: 'r2',
    [wireKey('phase')]: 50,
    [wireKey('stateTierNumber')]: 2,
    [wireKey('stateTierNext')]: 375,
    [wireKey('stateSlots')]: 9,
    [wireKey('stateSlotsMax')]: 9,
    [wireKey('stateSquad')]: [{ [wireKey('squadSlot')]: 0, [wireKey('squadHeroId')]: 862212 }],
    [wireKey('stateDuelsUsed')]: 8,
    [wireKey('duelsMax')]: 10,
    [wireKey('stateEnabled')]: true,
    ...overrides,
  };
}

function rankingBody(board: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    [wireKey('rankingBy')]: board,
    [wireKey('rankingTop')]: [{ [wireKey('rankingRank')]: 1, [wireKey('rankingName')]: 'Top', [wireKey('rankingValue')]: '240' }],
    [wireKey('rankingMe')]: { [wireKey('rankingRank')]: 2, [wireKey('rankingName')]: 'Me', [wireKey('rankingValue')]: '200' },
    ...overrides,
  };
}

describe('identifyPvpBody', () => {
  it('names the polled state by its points, tier and squad at the top level, and a ranking by its board, top and own entry', () => {
    expect(identifyPvpBody(stateBody())).toBe('state');
    expect(identifyPvpBody(rankingBody('pvp'))).toBe('ranking');
    expect(identifyPvpBody(rankingBody('hero'))).toBe('ranking');
  });

  it('does not take a duel result for a state, though it carries the same object nested', () => {
    expect(identifyPvpBody(duelResult())).toBe('duel');
  });

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

  it('reads a squad whose hero ids are numbers — the wire form — as the roster spells them', () => {
    const state = {
      [wireKey('stateTier')]: 'r2',
      [wireKey('phase')]: 50,
      [wireKey('stateSquad')]: [
        { [wireKey('squadSlot')]: 1, [wireKey('squadHeroId')]: 591239 },
        { [wireKey('squadSlot')]: 0, [wireKey('squadHeroId')]: 862212 },
      ],
    };
    expect(parsePvpDuelResult(duelResult({ [wireKey('state')]: state }))?.squadHeroIds).toEqual(['862212', '591239']);
  });

  it('tolerates a squad the state does not carry', () => {
    const state = { [wireKey('stateTier')]: 'r1', [wireKey('phase')]: 1 };
    expect(parsePvpDuelResult(duelResult({ [wireKey('state')]: state }))?.squadHeroIds).toEqual([]);
  });
});

describe('parsePvpState', () => {
  it('reads the standing from the polled body, and the same from a duel result', () => {
    const expected = {
      points: 205,
      tier: 'r2',
      tierNumber: 2,
      nextTierAt: 375,
      tierFloor: 50,
      duelsUsed: 8,
      duelsMax: 10,
      slots: 9,
      slotsMax: 9,
      squadHeroIds: ['862212'],
    };
    expect(parsePvpState(stateBody())).toEqual(expected);
    expect(parsePvpDuelState(duelResult({ [wireKey('state')]: stateBody() }))).toEqual(expected);
  });

  it('leaves out figures the wire does not carry rather than inventing them', () => {
    const sparse = { [wireKey('statePoints')]: 1, [wireKey('stateTier')]: 'r1', [wireKey('phase')]: 1 };
    expect(parsePvpState(sparse)).toEqual({
      points: 1,
      tier: 'r1',
      tierNumber: null,
      nextTierAt: null,
      tierFloor: 1,
      duelsUsed: null,
      duelsMax: null,
      slots: null,
      slotsMax: null,
      squadHeroIds: [],
    });
  });

  it('refuses a state without points, tier or floor', () => {
    expect(parsePvpState(stateBody({ [wireKey('statePoints')]: '205' }))).toBeNull();
    expect(parsePvpState(stateBody({ [wireKey('stateTier')]: 2 }))).toBeNull();
    expect(parsePvpState('x')).toBeNull();
  });
});

describe('parsePvpRanking', () => {
  it("reads the player's own entry and names the board, with the digit-string value as a number", () => {
    expect(parsePvpRanking(rankingBody('pvp'))).toEqual({ board: 'pvp', position: 2, value: 200 });
    expect(parsePvpRanking(rankingBody('power'))).toEqual({ board: 'power', position: 2, value: 200 });
  });

  it('tells the PVP points board from the others', () => {
    expect(isPvpPointsBoard({ board: 'pvp', position: 1, value: 1 })).toBe(true);
    expect(isPvpPointsBoard({ board: 'hero', position: 1, value: 1 })).toBe(false);
  });

  it('refuses a ranking without a usable own entry', () => {
    expect(parsePvpRanking(rankingBody('pvp', { [wireKey('rankingMe')]: {} }))).toBeNull();
    expect(parsePvpRanking(rankingBody('pvp', { [wireKey('rankingMe')]: { [wireKey('rankingRank')]: 2, [wireKey('rankingValue')]: 'n/a' } }))).toBeNull();
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
