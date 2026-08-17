import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildTeamPlanInputFromStore,
  countOptimizeScopeHeroes,
} from '@/features/team-plan/model/build-team-plan-input';
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

function hero(id: string, battleAllowed = true) {
  return {
    id,
    name: id,
    updatedAt: 1,
    rarity: 'Raro' as const,
    level: 20,
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
    sourceId: `src-${id}`,
    battleAllowed,
  };
}

describe('buildTeamPlanInputFromStore scope defaults', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryLocalStorage());
    resetPlannerStoreForTests();
  });

  afterEach(() => {
    resetPlannerStoreForTests();
    vi.unstubAllGlobals();
  });

  // Regression: the scope board defaulted missing keys via battleAllowed (Donate), but the
  // solver input used `?? 'optimize'` — Donate-looking heroes were still scored.
  it('maps missing scope for battle-disabled heroes to donate, not optimize', () => {
    usePlannerStore.getState().hydrateRoster([hero('opt'), hero('bench', false)], 'opt');
    usePlannerStore.setState({
      scopeByHeroId: {},
      inventory: { version: 1, importedAt: 0, items: [] },
      forgeFloor: 10,
    });

    const input = buildTeamPlanInputFromStore(usePlannerStore.getState());
    expect(input.scopeByHeroId).toEqual({
      'src-opt': 'optimize',
      'src-bench': 'donate',
    });
    expect(countOptimizeScopeHeroes(usePlannerStore.getState())).toBe(1);
  });

  it('keeps an explicit store choice over the battleAllowed default', () => {
    usePlannerStore.getState().hydrateRoster([hero('bench', false)], 'bench');
    usePlannerStore.setState({
      scopeByHeroId: { bench: 'optimize' },
      inventory: { version: 1, importedAt: 0, items: [] },
      forgeFloor: 10,
    });

    const input = buildTeamPlanInputFromStore(usePlannerStore.getState());
    expect(input.scopeByHeroId).toEqual({ 'src-bench': 'optimize' });
  });
});
