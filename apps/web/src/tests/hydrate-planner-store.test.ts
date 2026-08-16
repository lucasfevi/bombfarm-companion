import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hydratePlannerStore } from '@/shared/stores/hydrate-planner-store';
import { resetPlannerStoreForTests, usePlannerStore } from '@/shared/stores';
import * as storage from '@/shared/lib/storage';
import * as i18n from '@/shared/i18n';
import * as phasesView from '@/shared/lib/phases-view-storage';

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

function heroJson(id: string, sourceId: string) {
  return {
    id,
    name: id,
    sourceId,
    updatedAt: 1,
    rarity: 'Raro' as const,
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
      attack: 10,
      energy: 10,
      speed: 10,
      critChance: 0,
      critDmg: 10,
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
  };
}

describe('hydratePlannerStore', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryLocalStorage());
    resetPlannerStoreForTests();
  });

  afterEach(() => {
    resetPlannerStoreForTests();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('reads in order: heroes → active → account → lang → phases; setBooted last', () => {
    localStorage.setItem('bf-hp-heroes-v1', JSON.stringify([heroJson('a', 's-a')]));
    localStorage.setItem('bf-hp-active-hero-v1', JSON.stringify('a'));
    localStorage.setItem(
      'bf-hp-account-v1',
      JSON.stringify({
        tree: storage.DEFAULT_TREE(),
        teamBuffs: {},
        context: storage.DEFAULT_CONTEXT(),
      }),
    );
    localStorage.setItem('bf_lang', 'en');
    localStorage.setItem('bf-hp-phases-view-v1', JSON.stringify({ phase: 12 }));

    const order: string[] = [];
    vi.spyOn(storage, 'loadHeroes').mockImplementation(() => {
      order.push('heroes');
      return [storage.normalizeHero(heroJson('a', 's-a'))];
    });
    vi.spyOn(storage, 'getActiveHeroId').mockImplementation(() => {
      order.push('active');
      return 'a';
    });
    vi.spyOn(storage, 'loadAccountShared').mockImplementation(() => {
      order.push('account');
      return storage.DEFAULT_ACCOUNT();
    });
    vi.spyOn(i18n, 'loadLang').mockImplementation(() => {
      order.push('lang');
      return 'en';
    });
    vi.spyOn(phasesView, 'loadPhasesView').mockImplementation(() => {
      order.push('phases');
      return { phase: 12 };
    });

    hydratePlannerStore();
    expect(order).toEqual(['heroes', 'active', 'account', 'lang', 'phases']);
    expect(usePlannerStore.getState().booted).toBe(true);
    expect(usePlannerStore.getState().lang).toBe('en');
    expect(usePlannerStore.getState().phasesViewPhase).toBe(12);
    expect(usePlannerStore.getState().activeHeroId).toBe('a');
  });

  it('second call is a no-op with no localStorage reads', () => {
    localStorage.setItem('bf-hp-heroes-v1', JSON.stringify([heroJson('a', 's-a')]));
    localStorage.setItem('bf-hp-active-hero-v1', JSON.stringify('a'));
    localStorage.setItem(
      'bf-hp-account-v1',
      JSON.stringify({
        tree: storage.DEFAULT_TREE(),
        teamBuffs: {},
        context: storage.DEFAULT_CONTEXT(),
      }),
    );
    hydratePlannerStore();
    const getItem = vi.spyOn(localStorage, 'getItem');
    const before = usePlannerStore.getState();
    hydratePlannerStore();
    expect(usePlannerStore.getState()).toBe(before);
    expect(getItem).not.toHaveBeenCalled();
  });

  it('clean load (sourceId + account present) performs zero setItem, aside from the one-shot critDmg-flat migration marker', () => {
    localStorage.setItem('bf-hp-heroes-v1', JSON.stringify([heroJson('a', 's-a')]));
    localStorage.setItem('bf-hp-active-hero-v1', JSON.stringify('a'));
    localStorage.setItem(
      'bf-hp-account-v1',
      JSON.stringify({
        tree: storage.DEFAULT_TREE(),
        teamBuffs: {},
        context: storage.DEFAULT_CONTEXT(),
      }),
    );
    localStorage.setItem('bf_lang', 'pt');
    localStorage.setItem('bf-hp-phases-view-v1', JSON.stringify({ phase: 1 }));

    const setItem = vi.spyOn(localStorage, 'setItem');
    hydratePlannerStore();
    // The flat-crit-damage fix's one-shot migration marker (`bf-hp-critdmg-flat-migrated-v1`)
    // is written unconditionally the first time it is absent — see `migrateCritDmgFlatBakeOnce`
    // in `storage.ts` for why that cannot be deferred until content actually needs converting.
    // No hero here has Golpe Brutal, so it is the ONLY setItem this otherwise-clean load makes.
    expect(setItem).toHaveBeenCalledTimes(1);
    expect(setItem).toHaveBeenCalledWith('bf-hp-critdmg-flat-migrated-v1', 'true');
  });
});
