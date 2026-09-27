import { describe, expect, it } from 'vitest';
import { emptyLoadout } from '@bombfarm/domain/gear';
import { ZERO_PTS } from '@bombfarm/domain/planner-constants';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import { heroStatSheet, treeSheetFromAccountTree } from '@bombfarm/hero/model';
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

const TREE = { danoTotal: 1.3, critChance: 4, critDmg: 10, speed: 2, energy: 3, luckFlatPct: 1 };

function rosterOf(...heroes: HeroRecord[]): AccountRoster {
  return {
    heroes,
    account: { tree: TREE } as AccountRoster['account'],
    inventory: [],
    pointsUnrecovered: [],
  };
}

function spent(id: string): HeroRecord {
  return { ...record(id, 'Vex', 42), birth: { ...SHEET, attack: 180, critChance: 5 }, pts: { ...ZERO_PTS(), attack: 20 } };
}

describe('rosterHeroPeeks', () => {
  it('keys one card per roster hero by the game id a live row carries', () => {
    const peeks = rosterHeroPeeks(rosterOf(record('h1', 'Vex', 42), record('h2', 'Nim', 7)));

    expect([...peeks.keys()]).toEqual(['h1', 'h2']);
    expect(peeks.get('h1')).toMatchObject({ name: 'Vex', level: 42, rank: 'S', rarityIdx: 4, power: 1234 });
    expect(peeks.get('h2')).toMatchObject({ name: 'Nim', level: 7 });
  });

  it('carries the sheet the detail pane totals, spent points included — never the import-time sheet', () => {
    const hero = spent('h1');
    const peek = rosterHeroPeeks(rosterOf(hero)).get('h1');

    expect(peek?.stats).toEqual(heroStatSheet(hero, treeSheetFromAccountTree(TREE)));
    expect(peek?.stats).not.toEqual(hero.gearedOverride);
  });

  it('carries no sheet for a hero whose spent points were not read, nor while the tree is unread', () => {
    const withheld = { ...rosterOf(spent('h1'), spent('h2')), pointsUnrecovered: [{ id: 'h1', name: 'Vex' }] };
    expect(rosterHeroPeeks(withheld).get('h1')?.stats).toBeUndefined();
    expect(rosterHeroPeeks(withheld).get('h2')?.stats).toBeDefined();

    const treeless = { ...rosterOf(spent('h1')), account: { tree: null } as AccountRoster['account'] };
    expect(rosterHeroPeeks(treeless).get('h1')?.stats).toBeUndefined();
  });

  it('carries the abilities and the loadout — what the row itself cannot say', () => {
    const peek = rosterHeroPeeks(rosterOf(record('h1', 'Vex', 42))).get('h1');

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
