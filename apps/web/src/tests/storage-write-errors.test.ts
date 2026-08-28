import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearStorageWriteErrorListenersForTests,
  onStorageWriteError,
  saveHeroes,
  type HeroRecord,
} from '@/shared/lib/storage';

function memoryLocalStorage(opts?: { throwOnSet?: boolean }) {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (opts?.throwOnSet) {
        const err = new Error('QuotaExceededError');
        err.name = 'QuotaExceededError';
        throw err;
      }
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => store.clear(),
  };
}

const sampleHero = (): HeroRecord => ({
  id: 'h1',
  name: 'Hero',
  updatedAt: 1,
  rarity: 'Raro',
  level: 1,
  stars: 0,
  naked: {
    attack: 1,
    energy: 1,
    speed: 1,
    critChance: 0,
    critDmg: 1,
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
  sourceId: 'src-1',
});

describe('storage write failures', () => {
  beforeEach(() => {
    clearStorageWriteErrorListenersForTests();
  });

  afterEach(() => {
    clearStorageWriteErrorListenersForTests();
    vi.unstubAllGlobals();
  });

  it('notifies listeners and does not throw when setItem throws QuotaExceededError', () => {
    vi.stubGlobal('localStorage', memoryLocalStorage({ throwOnSet: true }));
    const listener = vi.fn();
    onStorageWriteError(listener);

    expect(() => saveHeroes([sampleHero()])).not.toThrow();
    expect(listener).toHaveBeenCalledTimes(1);
    const [info] = listener.mock.calls[0] as [{ key: string; error: Error }];
    expect(info.key).toBe('bf-hp-heroes-v1');
    expect(info.error.name).toBe('QuotaExceededError');
  });

  it('successful write notifies no listener', () => {
    vi.stubGlobal('localStorage', memoryLocalStorage());
    const listener = vi.fn();
    onStorageWriteError(listener);

    saveHeroes([sampleHero()]);
    expect(listener).not.toHaveBeenCalled();
    expect(localStorage.getItem('bf-hp-heroes-v1')).toBeTruthy();
  });

  it('contains a throwing listener so other listeners still run', () => {
    vi.stubGlobal('localStorage', memoryLocalStorage({ throwOnSet: true }));
    const bad = vi.fn(() => {
      throw new Error('listener boom');
    });
    const good = vi.fn();
    onStorageWriteError(bad);
    onStorageWriteError(good);

    expect(() => saveHeroes([sampleHero()])).not.toThrow();
    expect(bad).toHaveBeenCalledTimes(1);
    expect(good).toHaveBeenCalledTimes(1);
  });

  it('unsubscribe stops further notifications', () => {
    vi.stubGlobal('localStorage', memoryLocalStorage({ throwOnSet: true }));
    const listener = vi.fn();
    const unsub = onStorageWriteError(listener);
    unsub();

    saveHeroes([sampleHero()]);
    expect(listener).not.toHaveBeenCalled();
  });
});
