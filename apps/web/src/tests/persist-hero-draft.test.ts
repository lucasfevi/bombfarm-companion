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
  function heroNamed(id: string, sourceId: string, name: string) {
    return normalizeHero({
      id,
      name,
      sourceId,
      updatedAt: 1,
      rarity: 'Raro',
      level: 1,
      stars: 0,
      naked: { attack: 10, energy: 10, speed: 10, critChance: 0, critDmg: 10, penetration: 0, cdr: 0, luck: 0 },
      gearedOverride: { attack: 10, energy: 10, speed: 10, critChance: 0, critDmg: 10, penetration: 0, cdr: 0, luck: 0 },
    });
  }

  /**
   * The autosave is debounced by 700ms, so a roster replacement can land while a write staged
   * against the OLD roster is still pending. `setHeroes` is what the shell's import handler calls
   * to swap the roster in, and it does not touch `activeHeroId` — the shell re-points that
   * separately, and only when its pick is truthy. A writer that fires in between therefore stages
   * an id the roster no longer holds, and `upsertHero` APPENDS an id it cannot find: a hero from
   * the account the player just replaced reappears in the new roster.
   *
   * Observed in the browser before this guard: importing a 13-hero save and then a 4-hero save
   * left the roster with FIVE heroes, the fifth carrying the previous account's id prefix.
   */
  it('a write staged before a roster swap does not resurrect its hero', () => {
    const old = heroNamed('old-1', 'src-old', 'FromOldAccount');
    usePlannerStore.getState().hydrateRoster([old], 'old-1');
    usePlannerStore.getState().applyHero(old);
    usePlannerStore.getState().setBooted(true);
    usePlannerStore.getState().unlockPersist();
    vi.advanceTimersByTime(AUTOSAVE_MS);
    usePlannerStore.getState().consumeSkipHeroToast();

    // An edit arms the writer against the roster as it stands...
    usePlannerStore.getState().setHeroLevel(9);
    // ...and the import swaps the roster under it, leaving `activeHeroId` pointing at a hero the
    // new roster does not contain.
    usePlannerStore.getState().setHeroes([heroNamed('new-1', 'src-new', 'FromNewAccount')]);
    expect(usePlannerStore.getState().activeHeroId).toBe('old-1');

    vi.advanceTimersByTime(AUTOSAVE_MS * 2);

    expect(usePlannerStore.getState().heroes.map((entry) => entry.id)).toEqual(['new-1']);
    // `setHeroes` swaps state only — the import path persists separately — so a DROPPED write
    // leaves storage exactly as the last real save left it. The bug's signature is storage
    // GROWING to two entries as `upsertHero` appends the id it could not find.
    expect(loadHeroes().map((entry) => entry.id)).toEqual(['old-1']);
  });

  /**
   * `heroes` is member 0 of `readFarmDepTuple`, compared with `Object.is`, so the appended hero
   * also invalidated any farm respec proposal solved against the array — the panel a player had
   * just opened closed itself.
   */
  it('a dropped stale write leaves the roster array identity alone', () => {
    const old = heroNamed('old-1', 'src-old', 'FromOldAccount');
    usePlannerStore.getState().hydrateRoster([old], 'old-1');
    usePlannerStore.getState().applyHero(old);
    usePlannerStore.getState().setBooted(true);
    usePlannerStore.getState().unlockPersist();
    vi.advanceTimersByTime(AUTOSAVE_MS);
    usePlannerStore.getState().consumeSkipHeroToast();

    usePlannerStore.getState().setHeroLevel(9);
    usePlannerStore.getState().setHeroes([heroNamed('new-1', 'src-new', 'FromNewAccount')]);

    const beforeFire = usePlannerStore.getState().heroes;
    vi.advanceTimersByTime(AUTOSAVE_MS * 2);
    expect(usePlannerStore.getState().heroes).toBe(beforeFire);
  });
});
