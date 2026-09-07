import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { normalizeHero } from '@/shared/lib/storage';
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

const RANGES = {
  attack: { min: 120, max: 190 },
  energy: { min: 140, max: 220 },
  critDmg: { min: 60, max: 95 },
};

function heroWith(id: string, extra: Record<string, unknown>) {
  return normalizeHero({
    id,
    name: 'Brick',
    updatedAt: 1700000000002,
    rarity: 'Épico',
    level: 30,
    stars: 2,
    naked: SHEET,
    gearedOverride: SHEET,
    sourceId: `save-${id}`,
    ...extra,
  });
}

describe('hero draft store carries roll bounds', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryLocalStorage());
    resetPlannerStoreForTests();
  });

  afterEach(() => {
    resetPlannerStoreForTests();
    vi.unstubAllGlobals();
  });

  it('a hero loaded with bounds rebuilds a record that still carries them', () => {
    usePlannerStore.getState().applyHero(heroWith('h1', { statRanges: RANGES }));

    const rebuilt = usePlannerStore.getState().buildHeroRecord('h1');

    expect(rebuilt.statRanges).toEqual(RANGES);
  });

  it('an edit made after loading does not cost the rebuilt record its bounds', () => {
    usePlannerStore.getState().applyHero(heroWith('h1', { statRanges: RANGES }));
    usePlannerStore.getState().setHeroLevel(31);

    const rebuilt = usePlannerStore.getState().buildHeroRecord('h1');

    expect(rebuilt.level).toBe(31);
    expect(rebuilt.statRanges).toEqual(RANGES);
  });

  it('a hero loaded without bounds rebuilds without them, and does not inherit the previous one', () => {
    usePlannerStore.getState().applyHero(heroWith('h1', { statRanges: RANGES }));
    usePlannerStore.getState().applyHero(heroWith('h2', {}));

    expect(usePlannerStore.getState().buildHeroRecord('h2').statRanges).toBeUndefined();
  });

  it('a reset draft carries no bounds', () => {
    usePlannerStore.getState().applyHero(heroWith('h1', { statRanges: RANGES }));
    usePlannerStore.getState().resetDraftToDefaults();

    expect(usePlannerStore.getState().buildHeroRecord(null).statRanges).toBeUndefined();
  });
});
