import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadAccountShared, loadHeroes } from '@/shared/lib/storage';
import { hydratePlannerStore } from '@/shared/stores/hydrate-planner-store';
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

const NON_ARRAY_VALUES: readonly string[] = ['{}', '{"heroes":[]}', '"hero-1"', '42', 'null'];

describe('a roster entry that is not an array', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryLocalStorage());
    resetPlannerStoreForTests();
  });

  afterEach(() => {
    resetPlannerStoreForTests();
    vi.unstubAllGlobals();
  });

  it('loads as an empty roster instead of throwing', () => {
    for (const stored of NON_ARRAY_VALUES) {
      localStorage.setItem('bf-hp-heroes-v1', stored);

      let heroes: ReturnType<typeof loadHeroes> = [];
      expect(() => {
        heroes = loadHeroes();
      }, stored).not.toThrow();
      expect(heroes, stored).toEqual([]);
    }
  });

  it('loads as an empty roster when it sits under an older roster key', () => {
    for (const stored of NON_ARRAY_VALUES) {
      localStorage.setItem('bf-pa-heroes-v1', stored);

      let heroes: ReturnType<typeof loadHeroes> = [];
      expect(() => {
        heroes = loadHeroes();
      }, stored).not.toThrow();
      expect(heroes, stored).toEqual([]);
    }
  });

  it('does not stop the account-wide settings from seeding themselves off the roster', () => {
    localStorage.setItem('bf-hp-heroes-v1', '{}');
    localStorage.setItem('bf-hp-active-hero-v1', '"hero-1"');

    expect(() => loadAccountShared()).not.toThrow();
    expect(loadAccountShared().tree).toBeDefined();
  });

  it('lets the planner finish booting, with the roster empty', () => {
    localStorage.setItem('bf-hp-heroes-v1', '{}');

    expect(() => hydratePlannerStore()).not.toThrow();

    const state = usePlannerStore.getState();
    expect(state.booted).toBe(true);
    expect(state.heroes).toEqual([]);
  });

  it('still loads a well-formed roster', () => {
    const hero = {
      id: 'hero-1',
      name: 'Brick',
      sourceId: 'save-1',
      rarity: 'Raro',
      level: 10,
      stars: 0,
    };
    localStorage.setItem('bf-hp-heroes-v1', JSON.stringify([hero]));

    const heroes = loadHeroes();

    expect(heroes).toHaveLength(1);
    expect(heroes[0].id).toBe('hero-1');
    expect(heroes[0].sourceId).toBe('save-1');
  });
});
