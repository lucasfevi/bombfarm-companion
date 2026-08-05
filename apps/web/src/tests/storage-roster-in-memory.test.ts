import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  normalizeHero,
  updateHeroBattleAllowed,
  upsertHero,
  type HeroRecord,
} from '@/shared/lib/storage';
import * as gear from '@bombfarm/domain/gear';
import { emptyLoadout, emptySheet } from '@bombfarm/domain/gear';

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
  };
}

function makeHero(id: string, sourceId: string): HeroRecord {
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

describe('roster-in / roster-out mutators (MOD-44)', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryLocalStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('one upsert does zero heroes-key getItem/parse and one heroes setItem (plus active pointer)', () => {
    const roster = [makeHero('a', 's-a'), makeHero('b', 's-b'), makeHero('c', 's-c')];
    localStorage.setItem(HEROES_KEY, JSON.stringify(roster));
    localStorage.setItem(ACTIVE_KEY, JSON.stringify('a'));

    const getItem = vi.spyOn(localStorage, 'getItem');
    const setItem = vi.spyOn(localStorage, 'setItem');
    const parse = vi.spyOn(JSON, 'parse');

    const { saved } = upsertHero(roster, {
      ...roster[0],
      level: 2,
      name: 'Edited',
    });

    expect(saved.level).toBe(2);
    expect(saved.name).toBe('Edited');

    const heroesGets = getItem.mock.calls.filter(([key]) => key === HEROES_KEY);
    expect(heroesGets).toHaveLength(0);

    const heroesParses = parse.mock.calls.filter((call) => {
      const arg = call[0];
      return typeof arg === 'string' && arg.includes('"id":"a"') && arg.includes('"id":"b"');
    });
    expect(heroesParses).toHaveLength(0);

    const heroesSets = setItem.mock.calls.filter(([key]) => key === HEROES_KEY);
    expect(heroesSets).toHaveLength(1);

    const activeSets = setItem.mock.calls.filter(([key]) => key === ACTIVE_KEY);
    expect(activeSets).toHaveLength(1);
  });

  it('does not normalize/migrate other roster heroes on save (applyGear proxy)', () => {
    // Heroes b/c have gearedOverride.attack === 0, so normalizeHero → migrateGearedOverride
    // would call applyGear if those records were re-normalized. Saved hero has valid geared.
    const needsMigrate = (id: string, sourceId: string): HeroRecord => ({
      ...makeHero(id, sourceId),
      naked: emptySheet(),
      loadout: emptyLoadout(),
      gearedOverride: {
        attack: 0,
        energy: 0,
        speed: 0,
        critChance: 0,
        critDmg: 0,
        penetration: 0,
        cdr: 0,
        luck: 0,
      },
    });
    const roster = [makeHero('a', 's-a'), needsMigrate('b', 's-b'), needsMigrate('c', 's-c')];
    const applyGearSpy = vi.spyOn(gear, 'applyGear');

    upsertHero(roster, {
      ...roster[0],
      level: 3,
      gearedOverride: roster[0].gearedOverride,
    });

    // Saved hero short-circuits migrate; b/c must not be normalized (would call applyGear).
    expect(applyGearSpy).toHaveBeenCalledTimes(0);
  });
});

describe('normalizeHero — per-key sheet defaults (docs/local-data-compat.md rule 7)', () => {
  it('a stored naked missing a key normalizes that key to 0, not undefined', () => {
    // A JSON string, not a TS literal — a `naked` missing `cdr` is not assignable to
    // `SheetStats` at the type level, but it is exactly what a hand-edited or older
    // localStorage record can hold.
    const raw = JSON.parse(
      '{"id":"partial","name":"Partial","naked":' +
        '{"attack":10,"energy":11,"speed":12,"critChance":13,"critDmg":14,"penetration":15}}',
    ) as Partial<HeroRecord> & Pick<HeroRecord, 'id' | 'name'>;

    const hero = normalizeHero(raw);

    expect(hero.naked.cdr).toBe(0);
    expect(Number.isFinite(hero.naked.cdr)).toBe(true);
    // Every present key survives untouched — this is per-key normalization, not a wipe.
    expect(hero.naked.attack).toBe(10);
    expect(hero.naked.energy).toBe(11);
    expect(hero.naked.speed).toBe(12);
    expect(hero.naked.critChance).toBe(13);
    expect(hero.naked.critDmg).toBe(14);
    expect(hero.naked.penetration).toBe(15);
  });

  it('a stored naked with a non-finite key value (null) normalizes that key to 0', () => {
    const raw = JSON.parse(
      '{"id":"partial2","name":"Partial2","naked":' +
        '{"attack":10,"energy":11,"speed":12,"critChance":13,"critDmg":14,"penetration":15,"cdr":null}}',
    ) as Partial<HeroRecord> & Pick<HeroRecord, 'id' | 'name'>;

    const hero = normalizeHero(raw);

    expect(hero.naked.cdr).toBe(0);
    expect(Number.isFinite(hero.naked.cdr)).toBe(true);
  });

  it('a stored pts missing a key normalizes that key to 0, not undefined', () => {
    const raw = JSON.parse(
      '{"id":"partial3","name":"Partial3","pts":{"attack":2,"energy":1,"speed":0,"critChance":0}}',
    ) as Partial<HeroRecord> & Pick<HeroRecord, 'id' | 'name'>;

    const hero = normalizeHero(raw);

    expect(hero.pts.critDmg).toBe(0);
    expect(hero.pts.penetration).toBe(0);
    expect(hero.pts.cdr).toBe(0);
    expect(Number.isFinite(hero.pts.critDmg)).toBe(true);
    expect(hero.pts.attack).toBe(2);
    expect(hero.pts.energy).toBe(1);
  });
});

describe('updateHeroBattleAllowed', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryLocalStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('persists a toggle and treats a missing flag as enabled', () => {
    const roster = [makeHero('a', 's-a')];
    expect(roster[0]?.battleAllowed).toBe(true);

    const next = updateHeroBattleAllowed(roster, 'a', false);
    expect(next).not.toBe(roster);
    expect(next[0]?.battleAllowed).toBe(false);
    const stored = JSON.parse(localStorage.getItem(HEROES_KEY)!) as HeroRecord[];
    expect(stored[0]?.battleAllowed).toBe(false);
  });

  it('returns the same array when the hero is missing or the value is unchanged', () => {
    const roster = [makeHero('a', 's-a')];
    localStorage.setItem(HEROES_KEY, JSON.stringify(roster));
    const setItem = vi.spyOn(localStorage, 'setItem');

    expect(updateHeroBattleAllowed(roster, 'missing', false)).toBe(roster);
    expect(updateHeroBattleAllowed(roster, 'a', true)).toBe(roster);
    expect(setItem).not.toHaveBeenCalled();
  });
});

/*
 * Pre/post cost delta (PRD AC 6b / W8 perf report note):
 * Pre: each autosave tick → loadHeroes() → 1× getItem+JSON.parse of bf-hp-heroes-v1
 *      + N× normalizeHero (and migrateGearedOverride/applyGear when needed) across the roster.
 * Post: 0× parse of bf-hp-heroes-v1 + 1× normalizeHero for the record being saved
 *      + 1× setItem heroes + 1× setItem active pointer (unchanged, ASM-07).
 */
