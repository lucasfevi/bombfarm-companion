import { describe, expect, it } from 'vitest';
import { ONLINE_PLAYERS_MAX, readOnlinePlayersBody } from './online-players.js';

describe('readOnlinePlayersBody', () => {
  it('reads the versioned shape the relay sends', () => {
    expect(readOnlinePlayersBody({ v: 1, at: 1790727000, players: 2537 })).toEqual({ at: 1790727000, players: 2537 });
  });

  it('tolerates keys it does not know', () => {
    expect(readOnlinePlayersBody({ v: 1, at: 1, players: 0, extra: 'x' })).toEqual({ at: 1, players: 0 });
  });

  it.each([
    ['null', null],
    ['an array', [1, 2, 3]],
    ['a string', '{"v":1}'],
    ['another version', { v: 2, at: 1, players: 5 }],
    ['no version', { at: 1, players: 5 }],
    ['a missing count', { v: 1, at: 1 }],
    ['a missing time', { v: 1, players: 5 }],
    ['a fractional count', { v: 1, at: 1, players: 2.5 }],
    ['a negative count', { v: 1, at: 1, players: -1 }],
    ['a count as text', { v: 1, at: 1, players: '2537' }],
    ['an absurd count', { v: 1, at: 1, players: ONLINE_PLAYERS_MAX + 1 }],
    ['a non-finite count', { v: 1, at: 1, players: Number.POSITIVE_INFINITY }],
    ['a negative time', { v: 1, at: -5, players: 3 }],
  ])('refuses %s, so the readout blanks instead of printing a wrong number', (_name, body) => {
    expect(readOnlinePlayersBody(body)).toBeNull();
  });
});
