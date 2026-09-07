import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STRINGS } from '@/shared/i18n';
import { loadHeroes, normalizeHero } from '@/shared/lib/storage';
import {
  attachHeroDraftPersistence,
  selectHeroDraftTuple,
} from '@/shared/stores/persistence/persist-hero-draft';
import { AUTOSAVE_MS } from '@/shared/stores/persistence/debounced-writer';
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


describe('hero draft persistence subscription', () => {
  let detach: () => void;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('localStorage', memoryLocalStorage());
    resetPlannerStoreForTests();
    detach = attachHeroDraftPersistence(usePlannerStore);
  });

  afterEach(() => {
    detach();
    resetPlannerStoreForTests();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('full sequence: suppressed → unlock silent save → edit toasted save → detach', () => {
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
    usePlannerStore.getState().applyHero(h);
    usePlannerStore.getState().setBooted(true);
    // gates start suppressed + skip toast
    usePlannerStore.getState().setHeroLevel(2);
    vi.advanceTimersByTime(AUTOSAVE_MS);
    // suppressed at fire → no write
    expect(localStorage.getItem('bf-hp-heroes-v1')).toBeNull();

    usePlannerStore.getState().unlockPersist();
    vi.advanceTimersByTime(AUTOSAVE_MS);
    expect(localStorage.getItem('bf-hp-heroes-v1')).toBeTruthy();
    expect(usePlannerStore.getState().toast).toBeNull(); // skip toast consumed

    usePlannerStore.getState().setHeroLevel(3);
    usePlannerStore.getState().setHeroName('Edited');
    vi.advanceTimersByTime(AUTOSAVE_MS);
    expect(usePlannerStore.getState().toast).toBe(STRINGS.pt.toastHeroSaved);

    detach();
    usePlannerStore.getState().setHeroLevel(4);
    vi.advanceTimersByTime(AUTOSAVE_MS);
    const afterDetach = JSON.parse(localStorage.getItem('bf-hp-heroes-v1')!) as {
      level: number;
    }[];
    expect(afterDetach[0]?.level).toBe(3);
  });

  it('equal draft write does not re-arm', () => {
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
    usePlannerStore.getState().applyHero(h);
    usePlannerStore.getState().setBooted(true);
    usePlannerStore.getState().unlockPersist();
    usePlannerStore.getState().consumeSkipHeroToast();

    usePlannerStore.getState().setHeroLevel(2);
    vi.advanceTimersByTime(AUTOSAVE_MS);
    const setItem = vi.spyOn(localStorage, 'setItem');
    usePlannerStore.getState().setHeroLevel(2);
    vi.advanceTimersByTime(AUTOSAVE_MS);
    expect(setItem).not.toHaveBeenCalled();
  });

  it('selectHeroDraftTuple has 21 members (includes birth, statRanges, marketable and statPointsAvailable; obsHit/obsCrit gone)', () => {
    const tuple = selectHeroDraftTuple(usePlannerStore.getState());
    expect(tuple).toHaveLength(21);
  });

  it('an edit to a hero carrying roll bounds saves them back — reload from storage still has them', () => {
    const statRanges = {
      attack: { min: 120, max: 190 },
      energy: { min: 140, max: 220 },
    };
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
      statRanges,
    });
    usePlannerStore.getState().hydrateRoster([h], 'h1');
    usePlannerStore.getState().applyHero(h);
    usePlannerStore.getState().setBooted(true);
    usePlannerStore.getState().unlockPersist();

    usePlannerStore.getState().setHeroLevel(2);
    vi.advanceTimersByTime(AUTOSAVE_MS);

    const reloaded = loadHeroes();
    expect(reloaded[0]?.level).toBe(2);
    expect(reloaded[0]?.statRanges).toEqual(statRanges);
  });

  it('changing only the bounds is enough to schedule a save on its own', () => {
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
    usePlannerStore.getState().applyHero(h);
    usePlannerStore.getState().setBooted(true);
    usePlannerStore.getState().unlockPersist();
    vi.advanceTimersByTime(AUTOSAVE_MS);
    usePlannerStore.getState().consumeSkipHeroToast();

    const statRanges = { speed: { min: 8, max: 14 } };
    usePlannerStore.setState({ statRanges });
    vi.advanceTimersByTime(AUTOSAVE_MS);

    expect(loadHeroes()[0]?.statRanges).toEqual(statRanges);
  });
});
