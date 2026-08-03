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

  it('importHeroRecords merges by sourceId and does not touch the active pointer', () => {
    const a = hero('local-1', 'game-1');
    usePlannerStore.getState().hydrateRoster([a], 'local-1');
    usePlannerStore.getState().setActiveHeroId('local-1');
    const beforeActive = localStorage.getItem('bf-hp-active-hero-v1');

    const incoming = {
      ...hero('new', 'game-1'),
      id: undefined as unknown as string,
      name: 'Updated',
      level: 9,
    };
    const { updated, created } = usePlannerStore.getState().importHeroRecords([
      { ...incoming, sourceId: 'game-1' },
    ]);
    expect(updated).toBe(1);
    expect(created).toBe(0);
    expect(usePlannerStore.getState().heroes[0]?.name).toBe('Updated');
    expect(localStorage.getItem('bf-hp-active-hero-v1')).toBe(beforeActive);
  });
});
