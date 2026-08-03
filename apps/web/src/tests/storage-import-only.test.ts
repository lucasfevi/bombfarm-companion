import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getActiveHeroId,
  loadHeroes,
  setActiveHeroId,
  type HeroRecord,
} from '@/shared/lib/storage';

const HEROES_KEY = 'bf-hp-heroes-v1';
const ACTIVE_KEY = 'bf-hp-active-hero-v1';

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
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  };
}

function partialHero(
  partial: Partial<HeroRecord> & Pick<HeroRecord, 'id' | 'name'>,
): Partial<HeroRecord> {
  return {
    updatedAt: 1,
    rarity: 'Raro',
    level: 1,
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
    loadout: {
      arma: null,
      elmo: null,
      anel: null,
      amuleto: null,
      peito: null,
      calca: null,
      luva: null,
      bota: null,
    },
    altLoadout: null,
    gearedOverride: {
      attack: 1,
      energy: 1,
      speed: 1,
      critChance: 0,
      critDmg: 1,
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
    ...partial,
  };
}

describe('import-only heroes (loadHeroes)', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryLocalStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('drops heroes without sourceId and rewrites storage', () => {
    localStorage.setItem(
      HEROES_KEY,
      JSON.stringify([
        partialHero({ id: 'a', name: 'Valid', sourceId: 'save-1' }),
        partialHero({ id: 'b', name: 'Invalid' }),
      ]),
    );

    const heroes = loadHeroes();
    expect(heroes).toHaveLength(1);
    expect(heroes[0]?.id).toBe('a');
    expect(heroes[0]?.sourceId).toBe('save-1');

    const persisted = JSON.parse(localStorage.getItem(HEROES_KEY) ?? '[]') as HeroRecord[];
    expect(persisted).toHaveLength(1);
    expect(persisted[0]?.id).toBe('a');
  });

  it('re-points active hero when the active id was dropped', () => {
    localStorage.setItem(
      HEROES_KEY,
      JSON.stringify([
        partialHero({ id: 'kept', name: 'Kept', sourceId: 'save-1' }),
        partialHero({ id: 'gone', name: 'Gone' }),
      ]),
    );
    setActiveHeroId('gone');

    loadHeroes();

    expect(getActiveHeroId()).toBe('kept');
  });

  it('clears active hero when every entry lacked sourceId', () => {
    localStorage.setItem(
      HEROES_KEY,
      JSON.stringify([partialHero({ id: 'gone', name: 'Gone' })]),
    );
    setActiveHeroId('gone');

    const heroes = loadHeroes();
    expect(heroes).toHaveLength(0);
    expect(getActiveHeroId()).toBeNull();
    expect(localStorage.getItem(ACTIVE_KEY)).toBeNull();
  });

  it('does not rewrite storage when every hero already has sourceId', () => {
    const raw = [partialHero({ id: 'a', name: 'A', sourceId: '1' })];
    localStorage.setItem(HEROES_KEY, JSON.stringify(raw));
    const setItem = vi.spyOn(localStorage, 'setItem');

    loadHeroes();

    expect(setItem).not.toHaveBeenCalledWith(HEROES_KEY, expect.any(String));
    setItem.mockRestore();
  });
});
