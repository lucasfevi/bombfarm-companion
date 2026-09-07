import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadHeroes, saveHeroes, normalizeHero } from '@/shared/lib/storage';

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

const SHEET = {
  attack: 150,
  energy: 180,
  speed: 40,
  critChance: 8,
  critDmg: 80,
  penetration: 0,
  cdr: 5,
  luck: 0,
};

function heroWith(extra: Record<string, unknown>) {
  return {
    id: 'hero-1',
    name: 'Brick',
    updatedAt: 1700000000002,
    rarity: 'Épico' as const,
    level: 30,
    stars: 2,
    naked: SHEET,
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
    gearedOverride: SHEET,
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
    sourceId: 'save-1',
    deployed: false,
    battleAllowed: true,
    skin: 1,
    statPointsAvailable: 0,
    ...extra,
  };
}

const RANGES = {
  attack: { min: 120, max: 190 },
  energy: { min: 140, max: 220 },
  critDmg: { min: 60, max: 95 },
};

describe('roll bounds survive record normalization', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryLocalStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('a saved record carrying bounds still carries them after a reload from storage', () => {
    saveHeroes([normalizeHero(heroWith({ statRanges: RANGES }))]);

    const reloaded = loadHeroes();

    expect(reloaded).toHaveLength(1);
    expect(reloaded[0].statRanges).toEqual(RANGES);
  });

  it('bounds survive a second load — the normalizer does not erase them on the round after the write', () => {
    saveHeroes([normalizeHero(heroWith({ statRanges: RANGES }))]);

    saveHeroes(loadHeroes());
    const reloaded = loadHeroes();

    expect(reloaded[0].statRanges).toEqual(RANGES);
  });

  it('a record without bounds loads with the field absent — no empty map invented', () => {
    localStorage.setItem('bf-hp-heroes-v1', JSON.stringify([heroWith({})]));

    const reloaded = loadHeroes();

    expect(reloaded).toHaveLength(1);
    expect(reloaded[0].statRanges).toBeUndefined();

    saveHeroes(reloaded);
    expect(localStorage.getItem('bf-hp-heroes-v1')).not.toContain('statRanges');
  });
});
