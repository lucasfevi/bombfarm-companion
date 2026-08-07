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

  it('importHeroRecords overwrites a local battleAllowed toggle from the save and syncs the open draft', () => {
    const a = hero('local-1', 'game-1');
    usePlannerStore.getState().hydrateRoster([{ ...a, battleAllowed: false }], 'local-1');
    usePlannerStore.getState().applyHero({ ...a, battleAllowed: false });
    expect(usePlannerStore.getState().heroBattleAllowed).toBe(false);

    const incoming = {
      ...hero('new', 'game-1'),
      id: undefined as unknown as string,
      battleAllowed: true,
    };
    usePlannerStore.getState().importHeroRecords([{ ...incoming, sourceId: 'game-1' }]);

    expect(usePlannerStore.getState().heroes[0]?.battleAllowed).toBe(true);
    expect(usePlannerStore.getState().heroBattleAllowed).toBe(true);
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

  it('setAltLoadouts updates only altLoadout on affected heroes', () => {
    const emptyLoadout = {
      arma: null,
      elmo: null,
      anel: null,
      amuleto: null,
      peito: null,
      calca: null,
      luva: null,
      bota: null,
    };
    const alt = {
      ...emptyLoadout,
      arma: { defId: 'clay_arma', rarityIdx: 1, level: 10, upgrade: 5 },
    };
    const a = hero('a', 's-a');
    const b = hero('b', 's-b');
    usePlannerStore.getState().hydrateRoster([a, b], 'a');
    const beforeA = usePlannerStore.getState().heroes[0];
    const beforeB = usePlannerStore.getState().heroes[1];
    if (!beforeA || !beforeB) throw new Error('fixture heroes missing');

    usePlannerStore.getState().setAltLoadouts({ a: alt });

    const afterA = usePlannerStore.getState().heroes.find((hero) => hero.id === 'a');
    const afterB = usePlannerStore.getState().heroes.find((hero) => hero.id === 'b');
    if (!afterA || !afterB) throw new Error('patched heroes missing');
    expect(afterA.altLoadout).toEqual(alt);
    expect(afterB).toEqual(beforeB);
    expect(afterA.name).toBe(beforeA.name);
    expect(afterA.level).toBe(beforeA.level);
    expect(afterA.loadout).toEqual(beforeA.loadout);
    expect(afterA.pts).toEqual(beforeA.pts);
  });

  it('setAltLoadouts skips heroes without proposed changes', () => {
    const a = hero('a', 's-a');
    usePlannerStore.getState().hydrateRoster([a], 'a');
    const before = usePlannerStore.getState().heroes;
    usePlannerStore.getState().setAltLoadouts({});
    expect(usePlannerStore.getState().heroes).toBe(before);
  });

  it('setAltLoadouts persists heroes to storage', () => {
    const alt = {
      arma: { defId: 'x', rarityIdx: 0, level: 1, upgrade: 0 },
      elmo: null,
      anel: null,
      amuleto: null,
      peito: null,
      calca: null,
      luva: null,
      bota: null,
    };
    const a = hero('a', 's-a');
    usePlannerStore.getState().hydrateRoster([a], 'a');
    usePlannerStore.getState().setAltLoadouts({ a: alt });
    const stored = JSON.parse(localStorage.getItem('bf-hp-heroes-v1')!) as HeroRecord[];
    expect(stored[0]?.altLoadout).toEqual(alt);
  });

  it('setAltLoadouts syncs active hero alt draft when active hero is updated', () => {
    const alt = {
      arma: { defId: 'x', rarityIdx: 0, level: 1, upgrade: 0 },
      elmo: null,
      anel: null,
      amuleto: null,
      peito: null,
      calca: null,
      luva: null,
      bota: null,
    };
    const a = hero('a', 's-a');
    usePlannerStore.getState().hydrateRoster([a], 'a');
    usePlannerStore.getState().applyHero(a);
    usePlannerStore.getState().setAltLoadouts({ a: alt });
    expect(usePlannerStore.getState().altLoadout).toEqual(alt);
  });
});
