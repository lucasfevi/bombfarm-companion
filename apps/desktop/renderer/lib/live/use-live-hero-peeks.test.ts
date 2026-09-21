import { describe, expect, it } from 'vitest';
import { emptyLoadout } from '@bombfarm/domain/gear';
import { ZERO_PTS } from '@bombfarm/domain/planner-constants';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import type { AccountRoster } from '../account/account-roster';
import { rosterHeroPeeks } from './use-live-hero-peeks';

const SHEET = { attack: 10, energy: 10, speed: 10, critChance: 0, critDmg: 10, penetration: 0, cdr: 0, luck: 0 };

function record(id: string, name: string, level: number): HeroRecord {
  return {
    id,
    name,
    updatedAt: 1,
    rarity: 'Lendária',
    level,
    stars: 1,
    naked: SHEET,
    loadout: emptyLoadout(),
    altLoadout: null,
    gearedOverride: SHEET,
    abilities: {},
    pts: ZERO_PTS(),
    rank: 'S',
    power: 1234,
  };
}

function rosterOf(...heroes: HeroRecord[]): AccountRoster {
  return {
    heroes,
    account: {} as AccountRoster['account'],
    inventory: [],
    pointsUnrecovered: [],
  };
}

describe('rosterHeroPeeks', () => {
  it('keys one card per roster hero by the game id a live row carries', () => {
    const peeks = rosterHeroPeeks(rosterOf(record('h1', 'Vex', 42), record('h2', 'Nim', 7)));

    expect([...peeks.keys()]).toEqual(['h1', 'h2']);
    expect(peeks.get('h1')).toMatchObject({ name: 'Vex', level: 42, rank: 'S', rarityIdx: 4, power: 1234 });
    expect(peeks.get('h2')).toMatchObject({ name: 'Nim', level: 7 });
  });

  it('carries the sheet, the abilities and the loadout — what the row itself cannot say', () => {
    const peek = rosterHeroPeeks(rosterOf(record('h1', 'Vex', 42))).get('h1');

    expect(peek?.stats).toEqual(SHEET);
    expect(peek?.abilities).toEqual({});
    expect(peek?.loadout).toEqual(emptyLoadout());
  });

  it('answers nothing for a hero the roster does not hold', () => {
    expect(rosterHeroPeeks(rosterOf(record('h1', 'Vex', 42))).get('h9')).toBeUndefined();
  });

  it('has no cards at all when the account did not parse', () => {
    expect(rosterHeroPeeks(null).size).toBe(0);
    expect(rosterHeroPeeks(null).get('h1')).toBeUndefined();
  });
});
