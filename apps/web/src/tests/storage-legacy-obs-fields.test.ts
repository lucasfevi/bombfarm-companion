/**
 * obsHit/obsCrit were removed from HeroRecord.
 * Proves a save captured BEFORE that removal still loads: no throw, the fields are
 * discarded on normalize, the discard is silent, and the re-save drops the keys
 * without bumping the storage key. Input is the real pre-edit `hero-2` bytes that
 * `storage-roundtrip-20260729.json` lost in the same commit.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadHeroes, normalizeHero, saveHeroes, type HeroRecord } from '@/shared/lib/storage';

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

// Real pre-edit bytes for `hero-2`, captured from storage-roundtrip-20260729.json
// before obsHit/obsCrit were dropped from the fixture.
const LEGACY_HERO_2_JSON =
  '{"id":"hero-2","name":"Brick","updatedAt":1700000000002,"rarity":"Epico","level":30,"stars":2,' +
  '"naked":{"attack":150,"energy":180,"speed":40,"critChance":8,"critDmg":80,"penetration":0,"cdr":5},' +
  '"loadout":{"arma":null,"elmo":null,"anel":null,"amuleto":null,"peito":null,"calca":null,"luva":null,"bota":null},' +
  '"altLoadout":null,' +
  '"gearedOverride":{"attack":160,"energy":180,"speed":40,"critChance":8,"critDmg":80,"penetration":0,"cdr":5},' +
  '"abilities":{},' +
  '"pts":{"attack":0,"energy":0,"speed":0,"critChance":0,"critDmg":0,"penetration":0,"cdr":0},' +
  '"obsHit":1,"obsCrit":2,' +
  '"sourceId":"save-2","deployed":false,"battleAllowed":true,"skin":1}';

const LEGACY_HERO_2 = JSON.parse(LEGACY_HERO_2_JSON) as Record<string, unknown>;

describe('legacy obsHit/obsCrit discard', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryLocalStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('loads a pre-removal save without throwing and discards the fields', () => {
    localStorage.setItem('bf-hp-heroes-v1', JSON.stringify([LEGACY_HERO_2]));

    let heroes: ReturnType<typeof loadHeroes> = [];
    expect(() => {
      heroes = loadHeroes();
    }).not.toThrow();

    expect(heroes).toHaveLength(1);
    const hero = heroes[0];
    expect('obsHit' in hero).toBe(false);
    expect('obsCrit' in hero).toBe(false);
    expect(hero.id).toBe(LEGACY_HERO_2.id);
    expect(hero.name).toBe(LEGACY_HERO_2.name);
    expect(hero.rarity).toBe(LEGACY_HERO_2.rarity);
    expect(hero.level).toBe(LEGACY_HERO_2.level);
    expect(hero.stars).toBe(LEGACY_HERO_2.stars);
    // BSPW2: naked/gearedOverride/pts are seven-key legacy sub-objects — normalizeSheetStats /
    // normalizePointAlloc fill the additive `luck` key to 0 on load, same as every
    // other new field.
    expect(hero.naked).toEqual({ ...(LEGACY_HERO_2.naked as Record<string, unknown>), luck: 0 });
    expect(hero.loadout).toEqual(LEGACY_HERO_2.loadout);
    expect(hero.gearedOverride).toEqual({
      ...(LEGACY_HERO_2.gearedOverride as Record<string, unknown>),
      luck: 0,
    });
    expect(hero.abilities).toEqual(LEGACY_HERO_2.abilities);
    expect(hero.pts).toEqual({ ...(LEGACY_HERO_2.pts as Record<string, unknown>), luck: 0 });
    expect(hero.sourceId).toBe(LEGACY_HERO_2.sourceId);
  });

  it('discards context.obsHit/obsCrit from the pre-HeroRecord legacy shape', () => {
    // A JSON string, not a TS literal — it is what localStorage actually holds,
    // and it sidesteps the excess-property check a typed literal would now hit.
    const legacyWithContextJson =
      '{"id":"x","name":"Legacy","context":{"houseIdx":0,"houseLevel":0,"phase":null,' +
      '"mitigationPct":1,"rankMode":"dps","targetProp":null,"obsHit":1234,"obsCrit":2000}}';

    let hero!: ReturnType<typeof normalizeHero>;
    expect(() => {
      hero = normalizeHero(
        JSON.parse(legacyWithContextJson) as Partial<HeroRecord> & Pick<HeroRecord, 'id' | 'name'>,
      );
    }).not.toThrow();

    expect('obsHit' in hero).toBe(false);
    expect('obsCrit' in hero).toBe(false);
  });

  it('drops the keys on re-save and never creates a -v2 key', () => {
    localStorage.setItem('bf-hp-heroes-v1', JSON.stringify([LEGACY_HERO_2]));
    const heroes = loadHeroes();

    saveHeroes(heroes);

    const raw = localStorage.getItem('bf-hp-heroes-v1');
    expect(raw).not.toBeNull();
    expect(raw).not.toContain('obsHit');
    expect(raw).not.toContain('obsCrit');
    expect(localStorage.getItem('bf-hp-heroes-v2')).toBeNull();
  });

  it('discards the fields silently — no console warning or error', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    localStorage.setItem('bf-hp-heroes-v1', JSON.stringify([LEGACY_HERO_2]));
    loadHeroes();

    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
