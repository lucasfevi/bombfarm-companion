/**
 * `importHeroes` — the roster ARRAY IDENTITY contract on the save-import path.
 *
 * The sibling of `storage-patch-hero-in-list.test.ts`, which locks the same contract for the
 * 700ms autosave path. See `importHeroes` in `@/shared/lib/storage` for the mechanism and why it
 * is load-bearing; `farm-ranking-selectors.test.ts` covers the user-visible consequence.
 *
 * Isolation model: a per-file in-memory localStorage stub, the same pattern `roster-sync.test.ts`
 * uses — these cases assert on what was written, so the stub has to be real.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { importHeroes, normalizeHero, saveHeroes, type HeroRecord } from '@/shared/lib/storage';

const HEROES_KEY = 'bf-hp-heroes-v1';

function memoryLocalStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => store.clear(),
  };
}

/** A hero with every nested branch populated — an all-zero record would let a broken
 *  comparison pass by accident (same reasoning as the `patchHeroInList` suite). */
function hero(id: string, sourceId: string, patch: Partial<HeroRecord> = {}): HeroRecord {
  return normalizeHero({
    id,
    name: `Hero ${id}`,
    sourceId,
    updatedAt: 1,
    rarity: 'Raro',
    level: 40,
    stars: 2,
    naked: { attack: 900, energy: 120, speed: 11, critChance: 14, critDmg: 210, penetration: 8, cdr: 6, luck: 4 },
    pts: { attack: 30, energy: 5, speed: 2, critChance: 4, critDmg: 6, penetration: 1, cdr: 0, luck: 3 },
    abilities: { bomba_potente: 5, mineracao: 2 },
    loadout: { arma: { defId: 'arma-1', rarityIdx: 3, level: 60, upgrade: 4 } },
    gearedOverride: { attack: 1400, energy: 150, speed: 12, critChance: 18, critDmg: 260, penetration: 9, cdr: 7, luck: 5 },
    statPointsAvailable: 7,
    ...patch,
  });
}

/** The same hero as an import RECORD — what `parseSaveFile` hands `importHeroes`. */
function record(source: HeroRecord, patch: Partial<HeroRecord> = {}) {
  const { id: _id, updatedAt: _updatedAt, sourceId, ...rest } = { ...source, ...patch };
  return { ...rest, sourceId: sourceId ?? '' };
}

describe('importHeroes — roster array identity', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryLocalStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns the SAME array on a genuine no-op re-import (same roster, same records, same sourceIds)', () => {
    const roster = [hero('a', 'save-a'), hero('b', 'save-b')];
    const records = [record(roster[0]), record(roster[1])];
    const sourceIds = new Set(['save-a', 'save-b']);

    const result = importHeroes(roster, records, sourceIds);

    expect(result.heroes).toBe(roster);
    expect(result.removed).toBe(0);
    expect(result.created).toBe(0);
  });

  it('returns the SAME array when the import carries no records at all', () => {
    const roster = [hero('a', 'save-a')];
    expect(importHeroes(roster, []).heroes).toBe(roster);
  });

  it('returns a DIFFERENT array when a record VALUE changed', () => {
    const roster = [hero('a', 'save-a'), hero('b', 'save-b')];
    const records = [record(roster[0]), record(roster[1], { level: roster[1].level + 1 })];

    const result = importHeroes(roster, records, new Set(['save-a', 'save-b']));

    expect(result.heroes).not.toBe(roster);
    expect(result.heroes[1].level).toBe(roster[1].level + 1);
  });

  it('returns a DIFFERENT array when a hero was CREATED', () => {
    const roster = [hero('a', 'save-a')];
    const records = [record(roster[0]), record(hero('n', 'save-new'))];

    const result = importHeroes(roster, records, new Set(['save-a', 'save-new']));

    expect(result.heroes).not.toBe(roster);
    expect(result.created).toBe(1);
    expect(result.heroes.map((h) => h.sourceId)).toEqual(['save-a', 'save-new']);
  });

  it('returns a DIFFERENT array when a hero was REMOVED', () => {
    const roster = [hero('a', 'save-a'), hero('b', 'save-b')];
    const records = [record(roster[0])];

    const result = importHeroes(roster, records, new Set(['save-a']));

    expect(result.heroes).not.toBe(roster);
    expect(result.removed).toBe(1);
    expect(result.heroes.map((h) => h.sourceId)).toEqual(['save-a']);
  });

  it('a NESTED edit is never swallowed by the identity guard', () => {
    const roster = [hero('a', 'save-a')];
    const records = [
      record(roster[0], { naked: { ...roster[0].naked, attack: roster[0].naked.attack + 1 } }),
    ];

    const result = importHeroes(roster, records, new Set(['save-a']));

    expect(result.heroes).not.toBe(roster);
    expect(result.heroes[0].naked.attack).toBe(roster[0].naked.attack + 1);
  });

  /**
   * The guard covers in-memory state ONLY — the precedent `patchHeroInList` set. A no-op import
   * still writes the freshly-merged, freshly-stamped records, and still reports what the save
   * touched: `updated` counts matched records, not moved data.
   */
  describe('save semantics and counts are unchanged by the guard', () => {
    it('still writes the merged records to localStorage on a no-op re-import', () => {
      const roster = [hero('a', 'save-a')];
      saveHeroes(roster);
      localStorage.removeItem(HEROES_KEY);

      const result = importHeroes(roster, [record(roster[0])], new Set(['save-a']));

      expect(result.heroes).toBe(roster);
      const stored = JSON.parse(localStorage.getItem(HEROES_KEY) ?? 'null') as HeroRecord[] | null;
      expect(stored?.map((h) => h.sourceId)).toEqual(['save-a']);
    });

    it('still counts a value-equal merge as `updated`', () => {
      const roster = [hero('a', 'save-a'), hero('b', 'save-b')];

      const result = importHeroes(roster, [record(roster[0]), record(roster[1])], new Set(['save-a', 'save-b']));

      expect(result.heroes).toBe(roster);
      expect(result.updated).toBe(2);
    });
  });
});
