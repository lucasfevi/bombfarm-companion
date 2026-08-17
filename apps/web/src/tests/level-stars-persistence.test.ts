import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyGear,
  emptyLoadout,
  emptySheetOther,
  rescaleHeroForLevel,
  rescaleHeroForStars,
  type EquippedItem,
  type Loadout,
  type SheetStats,
} from '@bombfarm/domain/gear';
import { SHEET_KEYS } from '@bombfarm/domain/planner-constants';
import {
  loadHeroes,
  normalizeHero,
  upsertHero,
  type HeroRecord,
} from '@/shared/lib/storage';

const naked = (): SheetStats => ({
  attack: 200,
  energy: 300,
  speed: 50,
  critChance: 10,
  critDmg: 70,
  penetration: 5,
  cdr: 5,
  luck: 20,
});

function weaponLoadout(): Loadout {
  const loadout = emptyLoadout();
  loadout.arma = {
    defId: 'clay_arma',
    rarityIdx: 2,
    level: 40,
    upgrade: 10,
  } satisfies EquippedItem;
  return loadout;
}

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

describe('persistence: level/stars geared upgrades (PERS-01/02)', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryLocalStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('PERS-01/02: upsert + reload keeps upgraded level, naked, and gearedOverride', () => {
    const loadout = weaponLoadout();
    const other = { ...emptySheetOther(), penetration: 20 };
    const n0 = naked();
    const catalog = applyGear(n0, loadout, other);
    const geared: SheetStats = { ...catalog, attack: catalog.attack + 4.2 };
    const fromLevel = 10;
    const toLevel = 11;
    const upgraded = rescaleHeroForLevel(n0, geared, loadout, other, fromLevel, toLevel);

    const { saved } = upsertHero(loadHeroes(), {
      name: 'Level what-if',
      rarity: 'Raro',
      level: toLevel,
      stars: 0,
      naked: upgraded.naked,
      loadout,
      altLoadout: null,
      gearedOverride: upgraded.geared,
      abilities: { ponta_diamante: 10 },
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
      sourceId: 'test-save-hero',
    });

    expect(saved.level).toBe(toLevel);
    expect(saved.naked).toEqual(upgraded.naked);
    expect(saved.gearedOverride).toEqual(upgraded.geared);

    const reloaded = loadHeroes().find((h) => h.id === saved.id);
    expect(reloaded).toBeTruthy();
    expect(reloaded!.level).toBe(toLevel);
    expect(reloaded!.stars).toBe(0);
    for (const k of SHEET_KEYS) {
      expect(reloaded!.naked[k]).toBeCloseTo(upgraded.naked[k], 8);
      expect(reloaded!.gearedOverride[k]).toBeCloseTo(upgraded.geared[k], 8);
    }
    // No silent revert to pre-upgrade geared
    expect(reloaded!.gearedOverride.attack).not.toBeCloseTo(geared.attack, 4);
  });

  it('PERS-01/02: stars upgrade round-trips through normalizeHero JSON reload', () => {
    const loadout = weaponLoadout();
    const other = emptySheetOther();
    const n0 = naked();
    const geared = applyGear(n0, loadout, other);
    const up = rescaleHeroForStars(n0, geared, loadout, other, 0, 1);

    const record: HeroRecord = normalizeHero({
      id: 'star-what-if',
      name: 'Star what-if',
      level: 20,
      stars: 1,
      naked: up.naked,
      loadout,
      gearedOverride: up.geared,
    });

    const reloaded = normalizeHero(JSON.parse(JSON.stringify(record)) as HeroRecord);
    expect(reloaded.stars).toBe(1);
    expect(reloaded.level).toBe(20);
    for (const k of SHEET_KEYS) {
      expect(reloaded.naked[k]).toBeCloseTo(up.naked[k], 8);
      expect(reloaded.gearedOverride[k]).toBeCloseTo(up.geared[k], 8);
    }
  });
});
