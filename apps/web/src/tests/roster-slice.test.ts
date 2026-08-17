import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { normalizeHero, type HeroRecord } from '@/shared/lib/storage';
import { resetPlannerStoreForTests, usePlannerStore } from '@/shared/stores';

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

function hero(id: string, sourceId: string): HeroRecord {
  return normalizeHero({
    id,
    name: id,
    sourceId,
    updatedAt: 1,
    rarity: 'Raro',
    level: 1,
    stars: 0,
    naked: {
      attack: 10,
      energy: 10,
      speed: 10,
      critChance: 0,
      critDmg: 10,
      penetration: 0,
      cdr: 0,
      luck: 0,
    },
    gearedOverride: {
      attack: 10,
      energy: 10,
      speed: 10,
      critChance: 0,
      critDmg: 10,
      penetration: 0,
      cdr: 0,
      luck: 0,
    },
  });
}

describe('roster slice', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryLocalStorage());
    resetPlannerStoreForTests();
  });

  afterEach(() => {
    resetPlannerStoreForTests();
    vi.unstubAllGlobals();
  });

  it('patchHero replaces by id and appends when absent', () => {
    const a = hero('a', 's-a');
    usePlannerStore.getState().hydrateRoster([a], 'a');
    const updated = { ...a, level: 5, name: 'A2' };
    usePlannerStore.getState().patchHero(updated);
    expect(usePlannerStore.getState().heroes).toHaveLength(1);
    expect(usePlannerStore.getState().heroes[0]?.level).toBe(5);

    const b = hero('b', 's-b');
    usePlannerStore.getState().patchHero(b);
    expect(usePlannerStore.getState().heroes.map((h) => h.id)).toEqual(['a', 'b']);
  });

  it('removeHero writes roster and clears active pointer when deleting active', () => {
    const a = hero('a', 's-a');
    const b = hero('b', 's-b');
    usePlannerStore.getState().hydrateRoster([a, b], 'a');
    usePlannerStore.getState().setActiveHeroId('a');
    usePlannerStore.getState().removeHero('a');
    expect(usePlannerStore.getState().heroes.map((h) => h.id)).toEqual(['b']);
    expect(usePlannerStore.getState().activeHeroId).toBeNull();
    expect(localStorage.getItem('bf-hp-active-hero-v1')).toBeNull();
  });

  it('setActiveHeroId writes bf-hp-active-hero-v1 immediately', () => {
    usePlannerStore.getState().setActiveHeroId('x');
    expect(JSON.parse(localStorage.getItem('bf-hp-active-hero-v1')!)).toBe('x');
    usePlannerStore.getState().setActiveHeroId(null);
    expect(localStorage.getItem('bf-hp-active-hero-v1')).toBeNull();
  });

  it('setHeroBattleAllowedOnHero persists and syncs the active draft', () => {
    const a = hero('a', 's-a');
    const b = hero('b', 's-b');
    usePlannerStore.getState().hydrateRoster([a, b], 'a');
    usePlannerStore.getState().applyHero(a);

    usePlannerStore.getState().setHeroBattleAllowedOnHero('a', false);
    expect(usePlannerStore.getState().heroes.find((h) => h.id === 'a')?.battleAllowed).toBe(false);
    expect(usePlannerStore.getState().heroBattleAllowed).toBe(false);
    const stored = JSON.parse(localStorage.getItem('bf-hp-heroes-v1')!) as HeroRecord[];
    expect(stored.find((h) => h.id === 'a')?.battleAllowed).toBe(false);

    usePlannerStore.getState().setHeroBattleAllowedOnHero('b', false);
    expect(usePlannerStore.getState().heroes.find((h) => h.id === 'b')?.battleAllowed).toBe(false);
    expect(usePlannerStore.getState().heroBattleAllowed).toBe(false);
  });

  it('setHeroBattleAllowedOnHero re-enables the open hero and leaves other drafts alone', () => {
    const a = hero('a', 's-a');
    const b = hero('b', 's-b');
    usePlannerStore.getState().hydrateRoster([a, b], 'a');
    usePlannerStore.getState().applyHero(a);

    usePlannerStore.getState().setHeroBattleAllowedOnHero('a', false);
    usePlannerStore.getState().setHeroBattleAllowedOnHero('a', true);
    expect(usePlannerStore.getState().heroBattleAllowed).toBe(true);
    expect(usePlannerStore.getState().heroes.find((h) => h.id === 'a')?.battleAllowed).toBe(true);

    usePlannerStore.getState().setHeroBattleAllowedOnHero('b', false);
    expect(usePlannerStore.getState().heroBattleAllowed).toBe(true);
    expect(usePlannerStore.getState().heroes.find((h) => h.id === 'b')?.battleAllowed).toBe(false);
  });

  it('setHeroBattleAllowedOnHero is a no-op when the flag already matches', () => {
    const a = hero('a', 's-a');
    usePlannerStore.getState().hydrateRoster([a], 'a');
    const before = usePlannerStore.getState().heroes;
    usePlannerStore.getState().setHeroBattleAllowedOnHero('a', true);
    expect(usePlannerStore.getState().heroes).toBe(before);
  });

  /**
   * The consumer half of the roster-identity invariant — `commitRoster` in
   * `stores/slices/roster-slice.ts`. See `farm-ranking-selectors.test.ts` for what a fresh roster
   * array costs the Farm board.
   *
   * These cases observe the `set` ITSELF, via a plain (selector-less) store subscription that
   * fires on every write. Asserting on `state.heroes` identity instead would prove nothing: a
   * `set({ heroes: sameRef })` leaves the reference untouched, so a well-behaved producer alone
   * satisfies such an assertion whether or not the guard exists. Deleting the guard has to make
   * something here fail.
   */
  describe('roster write guard (commitRoster)', () => {
    /** Counts every store write while `run` executes. */
    function countSets(run: () => void): number {
      let writes = 0;
      const unsubscribe = usePlannerStore.subscribe(() => {
        writes++;
      });
      try {
        run();
      } finally {
        unsubscribe();
      }
      return writes;
    }

    /**
     * `patchHero` is the isolation case: it routes through `commitRoster` with no companion
     * fields and performs no other write of its own, so every counted `set` is the guard's.
     */
    it('does not `set` at all when the producer hands back the same array', () => {
      const a = hero('a', 's-a');
      usePlannerStore.getState().hydrateRoster([a], 'a');
      // What the 700ms autosave produces: a rebuilt record, identical data, a later save stamp.
      const rebuilt = normalizeHero({ ...structuredClone(a), updatedAt: a.updatedAt + 700 });

      expect(countSets(() => usePlannerStore.getState().patchHero(rebuilt))).toBe(0);
    });

    it('does `set` when the producer hands back a new array', () => {
      const a = hero('a', 's-a');
      usePlannerStore.getState().hydrateRoster([a], 'a');
      const edited = { ...a, level: a.level + 1 };

      expect(countSets(() => usePlannerStore.getState().patchHero(edited))).toBe(1);
      expect(usePlannerStore.getState().heroes[0]?.level).toBe(a.level + 1);
    });

    it('applies a companion field on the no-op branch — the guard covers `heroes`, not siblings', () => {
      const a = hero('a', 's-a');
      usePlannerStore.getState().hydrateRoster([a], null);
      const before = usePlannerStore.getState().heroes;

      // Same array reference, new active pointer: the write must still happen, for the pointer.
      const writes = countSets(() => usePlannerStore.getState().hydrateRoster(before, 'a'));

      expect(writes).toBe(1);
      expect(usePlannerStore.getState().heroes).toBe(before);
      expect(usePlannerStore.getState().activeHeroId).toBe('a');
    });

    it('still replaces the roster when the array reference actually changed', () => {
      const a = hero('a', 's-a');
      usePlannerStore.getState().hydrateRoster([a], 'a');
      const before = usePlannerStore.getState().heroes;

      usePlannerStore.getState().setHeroes([...before, hero('b', 's-b')]);

      expect(usePlannerStore.getState().heroes).not.toBe(before);
      expect(usePlannerStore.getState().heroes.map((h) => h.id)).toEqual(['a', 'b']);
    });
  });
});
