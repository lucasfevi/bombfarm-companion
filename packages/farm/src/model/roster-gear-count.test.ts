import { describe, expect, it } from 'vitest';
import { SLOTS, emptyLoadout } from '@bombfarm/domain/gear';
import { gearCountOf } from './roster-compare';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';

function hero(partial: Partial<HeroRecord> & Pick<HeroRecord, 'id' | 'name'>): HeroRecord {
  return {
    rarity: 'Raro',
    level: 60,
    stars: 0,
    naked: {
      attack: 0,
      energy: 0,
      speed: 0,
      critChance: 0,
      critDmg: 0,
      penetration: 0,
      cdr: 0,
      luck: 0,
    },
    loadout: emptyLoadout(),
    altLoadout: null,
    gearedOverride: {
      attack: 0,
      energy: 0,
      speed: 0,
      critChance: 0,
      critDmg: 0,
      penetration: 0,
      cdr: 0,
      luck: 0,
    },
    abilities: {},
    pts: {
      attack: 0,
      energy: 0,
      speed: 0,
      critChance: 0,
      critDmg: 0,
      penetration: 0,
      cdr: 0,
      luck: 0,
    },
    updatedAt: 0,
    ...partial,
  };
}

describe('gearCountOf', () => {
  it('counts equipped slots against the live catalog slot count (8)', () => {
    expect(SLOTS.length).toBe(8);

    const loadout = emptyLoadout();
    for (const slot of SLOTS) {
      loadout[slot] = { defId: 'clay_arma', rarityIdx: 0, level: 10, upgrade: 0 };
    }

    expect(gearCountOf(hero({ id: 'h1', name: 'Full', loadout }))).toBe(8);
    expect(gearCountOf(hero({ id: 'h2', name: 'Empty' }))).toBe(0);
  });
});
