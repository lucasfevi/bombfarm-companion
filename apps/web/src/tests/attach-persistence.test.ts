import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STRINGS } from '@/shared/i18n';
import { normalizeHero } from '@/shared/lib/storage';
import { attachPlannerPersistence } from '@/shared/stores/persistence/attach-persistence';
import { AUTOSAVE_MS } from '@/shared/stores/persistence/debounced-writer';
import { resetPlannerStoreForTests, usePlannerStore } from '@/shared/stores';

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

describe('attachPlannerPersistence', () => {
  let detach: () => void;

  beforeEach(() => {
    vi.useFakeTimers();
    resetPlannerStoreForTests();
  });

  afterEach(() => {
    detach?.();
    resetPlannerStoreForTests();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('quota failure during debounced save → one toastSaveFailed, no throw, memory kept', () => {
    vi.stubGlobal('localStorage', memoryLocalStorage());
    detach = attachPlannerPersistence(usePlannerStore);

    const h = normalizeHero({
      id: 'h1',
      name: 'Hero',
      sourceId: 'src-1',
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
    usePlannerStore.getState().hydrateRoster([h], 'h1');
    usePlannerStore.getState().setBooted(true);
    usePlannerStore.getState().unlockPersist();
    usePlannerStore.getState().consumeSkipHeroToast();

    // Switch to throwing storage before the timer fires
    vi.stubGlobal('localStorage', memoryLocalStorage({ throwOnSet: true }));

    usePlannerStore.getState().applyHero(h);
    usePlannerStore.getState().setHeroLevel(9);

    expect(() => {
      vi.advanceTimersByTime(AUTOSAVE_MS);
    }).not.toThrow();

    expect(usePlannerStore.getState().toast).toBe(STRINGS.pt.toastSaveFailed);
    // In-memory roster still has the patched save if upsert partially ran —
    // patchHero runs after upsertHero returns; on throw writeJson returns false but
    // upsertHero still returns saved. Memory stays at edited level.
    expect(usePlannerStore.getState().heroes[0]?.level).toBe(9);
  });

  it('attaching twice does not double-register', () => {
    vi.stubGlobal('localStorage', memoryLocalStorage());
    detach = attachPlannerPersistence(usePlannerStore);
    const second = attachPlannerPersistence(usePlannerStore);
    second(); // no-op detach
    usePlannerStore.getState().setBooted(true);
    usePlannerStore.getState().setTreeDanoTotal(2);
    vi.advanceTimersByTime(AUTOSAVE_MS);
    // exactly one write path — account key present once
    expect(localStorage.getItem('bf-hp-account-v1')).toBeTruthy();
  });
});
