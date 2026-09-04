import { describe, expect, it } from 'vitest';
import { SLOTS, emptyLoadout } from '@bombfarm/domain/gear';
import { RARITIES } from '@bombfarm/domain/planner-constants';
import { compareRosterHeroes } from './roster-compare';
import type { RosterSortKey } from '@bombfarm/hero/components';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';

/**
 * `compareRosterHeroes` had no dedicated unit test. It was refactored from a switch-assign `let`
 * into an extracted early-return `compareByKey` with only indirect e2e coverage, and it drives
 * every roster/hero-picker sort.
 *
 * Every `RosterSortKey` branch is covered, in both directions, plus the name tiebreak.
 */
const ZERO_SHEET = {
  attack: 0,
  energy: 0,
  speed: 0,
  critChance: 0,
  critDmg: 0,
  penetration: 0,
  cdr: 0,
  luck: 0,
};

function hero(partial: Partial<HeroRecord> & Pick<HeroRecord, 'id' | 'name'>): HeroRecord {
  return {
    rarity: RARITIES[0],
    level: 60,
    stars: 0,
    naked: { ...ZERO_SHEET },
    loadout: emptyLoadout(),
    altLoadout: null,
    gearedOverride: { ...ZERO_SHEET },
    abilities: {},
    pts: { ...ZERO_SHEET },
    updatedAt: 0,
    ...partial,
  };
}

const NO_POWER = new Map<string, number>();

/** Sign of the comparison, which is all a sort comparator's contract actually promises. */
function order(
  left: HeroRecord,
  right: HeroRecord,
  key: RosterSortKey,
  direction: 'asc' | 'desc' = 'asc',
  powerById: Map<string, number> = NO_POWER,
): number {
  return Math.sign(compareRosterHeroes(left, right, key, direction, powerById));
}

describe('compareRosterHeroes', () => {
  describe('per-key ordering (ascending puts the lesser hero first)', () => {
    it('rank orders S before F, and ranked before unranked', () => {
      const strong = hero({ id: 'a', name: 'A', rank: 'S' });
      const weak = hero({ id: 'b', name: 'B', rank: 'F' });
      const unranked = hero({ id: 'c', name: 'C' });

      expect(order(strong, weak, 'rank')).toBe(-1);
      expect(order(weak, strong, 'rank')).toBe(1);
      // Missing rank sorts last — rankSortIdx returns RANK_ORDER.length.
      expect(order(weak, unranked, 'rank')).toBe(-1);
    });

    it('name compares case- and accent-insensitively', () => {
      const alpha = hero({ id: 'a', name: 'alpha' });
      const beta = hero({ id: 'b', name: 'Beta' });

      expect(order(alpha, beta, 'name')).toBe(-1);
      // `sensitivity: 'base'` — casing alone is not an ordering difference.
      expect(order(hero({ id: 'x', name: 'zeta' }), hero({ id: 'y', name: 'ZETA' }), 'name')).toBe(0);
    });

    it('rarity follows the RARITIES catalogue order', () => {
      const first = hero({ id: 'a', name: 'A', rarity: RARITIES[0] });
      const later = hero({ id: 'b', name: 'B', rarity: RARITIES[RARITIES.length - 1] });

      expect(order(first, later, 'rarity')).toBe(-1);
      expect(order(later, first, 'rarity')).toBe(1);
    });

    it('level orders numerically', () => {
      expect(
        order(hero({ id: 'a', name: 'A', level: 10 }), hero({ id: 'b', name: 'B', level: 80 }), 'level'),
      ).toBe(-1);
    });

    it('gear counts equipped slots', () => {
      const loadout = emptyLoadout();
      const slot = SLOTS[0];
      const geared = hero({
        id: 'a',
        name: 'A',
        loadout: { ...loadout, [slot]: { defId: 'x', rarityIdx: 0, level: 1, upgrade: 0 } },
      });
      const bare = hero({ id: 'b', name: 'B' });

      expect(order(bare, geared, 'gear')).toBe(-1);
      expect(order(geared, bare, 'gear')).toBe(1);
    });

    it('updated orders by timestamp', () => {
      expect(
        order(
          hero({ id: 'a', name: 'A', updatedAt: 100 }),
          hero({ id: 'b', name: 'B', updatedAt: 900 }),
          'updated',
        ),
      ).toBe(-1);
    });

    it('an unlisted key falls through to the geared sheet stat', () => {
      const weak = hero({ id: 'a', name: 'A', gearedOverride: { ...ZERO_SHEET, attack: 10 } });
      const strong = hero({ id: 'b', name: 'B', gearedOverride: { ...ZERO_SHEET, attack: 900 } });

      expect(order(weak, strong, 'attack')).toBe(-1);
      expect(order(strong, weak, 'attack')).toBe(1);
    });
  });

  describe('power resolution', () => {
    it('prefers the hero.power field when present', () => {
      const low = hero({ id: 'a', name: 'A', power: 5 });
      const high = hero({ id: 'b', name: 'B', power: 50 });

      expect(order(low, high, 'power')).toBe(-1);
    });

    it('falls back to powerById when hero.power is absent', () => {
      const left = hero({ id: 'a', name: 'A' });
      const right = hero({ id: 'b', name: 'B' });
      const powerById = new Map([
        ['a', 5],
        ['b', 50],
      ]);

      expect(order(left, right, 'power', 'asc', powerById)).toBe(-1);
      expect(order(right, left, 'power', 'asc', powerById)).toBe(1);
    });

    it('treats a hero with neither field nor map entry as zero', () => {
      const unknown = hero({ id: 'a', name: 'A' });
      const known = hero({ id: 'b', name: 'B', power: 7 });

      expect(order(unknown, known, 'power')).toBe(-1);
    });
  });

  describe('direction', () => {
    it('descending inverts every key', () => {
      const keys: RosterSortKey[] = ['rank', 'name', 'rarity', 'level', 'gear', 'updated', 'attack'];
      const left = hero({
        id: 'a',
        name: 'A',
        rank: 'S',
        level: 10,
        updatedAt: 100,
        gearedOverride: { ...ZERO_SHEET, attack: 10 },
      });
      const loadout = emptyLoadout();
      const slot = SLOTS[0];
      const right = hero({
        id: 'b',
        name: 'B',
        rank: 'F',
        level: 80,
        rarity: RARITIES[RARITIES.length - 1],
        updatedAt: 900,
        gearedOverride: { ...ZERO_SHEET, attack: 900 },
        // Must differ on `gear` too — otherwise that key ties and falls through to the
        // name tiebreak, which is deliberately not inverted by direction.
        loadout: { ...loadout, [slot]: { defId: 'x', rarityIdx: 0, level: 1, upgrade: 0 } },
      });

      for (const key of keys) {
        const ascending = order(left, right, key, 'asc');
        expect(ascending, `${key} should differentiate these heroes`).not.toBe(0);
        expect(order(left, right, key, 'desc'), `${key} should invert`).toBe(-ascending);
      }
    });
  });

  describe('name tiebreak', () => {
    it('breaks ties on name when the sorted key is equal', () => {
      const first = hero({ id: 'a', name: 'Aaa', level: 60 });
      const second = hero({ id: 'b', name: 'Zzz', level: 60 });

      expect(order(first, second, 'level')).toBe(-1);
      expect(order(second, first, 'level')).toBe(1);
    });

    it('applies the tiebreak ascending even when the sort is descending', () => {
      // The tiebreak is deliberately not multiplied by direction, so equal-key rows keep a
      // stable A→Z presentation in both directions.
      const first = hero({ id: 'a', name: 'Aaa', level: 60 });
      const second = hero({ id: 'b', name: 'Zzz', level: 60 });

      expect(order(first, second, 'level', 'desc')).toBe(-1);
    });

    it('returns 0 only when key and name are both equal', () => {
      const left = hero({ id: 'a', name: 'Same', level: 60 });
      const right = hero({ id: 'b', name: 'Same', level: 60 });

      expect(order(left, right, 'level')).toBe(0);
    });
  });
});
