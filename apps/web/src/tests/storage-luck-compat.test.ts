/**
 * BSPW2-05 — the rule-3/rule-4 backward-compat proof for `luck`.
 *
 * This is deliberately NOT the tripwire fixture (Wave 1 L-03): a byte-identity
 * fixture asserts output ≡ input under the current (eight-key) schema; this suite asserts
 * the opposite property — that a genuine STALE seven-key payload loads with `luck` filled
 * to 0, and that no derived value ever becomes NaN.
 *
 * Input bytes are the real pre-BSPW2 `hero-2` record — the same hero
 * `storage-legacy-obs-fields.test.ts` uses, captured before this wave inserted `luck`
 * into `storage-roundtrip-20260729.json` (see that fixture's `_meta.comment`).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadHeroes, normalizeHero, saveHeroes, type HeroRecord } from '@/shared/lib/storage';
import { resetPlannerStoreForTests, usePlannerStore } from '@/shared/stores';
import { selectAdvisorPipeline } from '@/shared/stores/selectors/advisor-selectors';

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

// Real pre-BSPW2 bytes for `hero-2` — seven-key naked / gearedOverride / pts, no `luck`.
// Rarity corrected to the valid RarityKey "Épico" (the shared W1 fixture literal stores the
// unaccented "Epico", which is not a BASE_ROLLS key and is unrelated to this wave's scope —
// AC-15 exercises rankNextPoint via BASE_ROLLS[hero.rarity] and would throw on that typo).
const LEGACY_HERO_2_JSON =
  '{"id":"hero-2","name":"Brick","updatedAt":1700000000002,"rarity":"Épico","level":30,"stars":2,' +
  '"naked":{"attack":150,"energy":180,"speed":40,"critChance":8,"critDmg":80,"penetration":0,"cdr":5},' +
  '"loadout":{"arma":null,"elmo":null,"anel":null,"amuleto":null,"peito":null,"calca":null,"luva":null,"bota":null},' +
  '"altLoadout":null,' +
  '"gearedOverride":{"attack":160,"energy":180,"speed":40,"critChance":8,"critDmg":80,"penetration":0,"cdr":5},' +
  '"abilities":{},' +
  '"pts":{"attack":0,"energy":0,"speed":0,"critChance":0,"critDmg":0,"penetration":0,"cdr":0},' +
  '"sourceId":"save-2","deployed":false,"battleAllowed":true,"skin":1}';

const LEGACY_HERO_2 = JSON.parse(LEGACY_HERO_2_JSON) as Record<string, unknown>;

describe('legacy luck compat (BSPW2-05)', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryLocalStorage());
    resetPlannerStoreForTests();
  });

  afterEach(() => {
    resetPlannerStoreForTests();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('loads a pre-luck save with luck === 0 on naked/gearedOverride/pts, every other field intact (BSPW2-AC-14)', () => {
    localStorage.setItem('bf-hp-heroes-v1', JSON.stringify([LEGACY_HERO_2]));

    let heroes: ReturnType<typeof loadHeroes> = [];
    expect(() => {
      heroes = loadHeroes();
    }).not.toThrow();

    expect(heroes).toHaveLength(1);
    const hero = heroes[0];
    expect(hero.naked.luck).toBe(0);
    expect(hero.gearedOverride.luck).toBe(0);
    expect(hero.pts.luck).toBe(0);
    expect(hero.naked).toEqual({ ...(LEGACY_HERO_2.naked as Record<string, unknown>), luck: 0 });
    expect(hero.gearedOverride).toEqual({
      ...(LEGACY_HERO_2.gearedOverride as Record<string, unknown>),
      luck: 0,
    });
    expect(hero.pts).toEqual({ ...(LEGACY_HERO_2.pts as Record<string, unknown>), luck: 0 });
    expect(hero.id).toBe(LEGACY_HERO_2.id);
    expect(hero.name).toBe(LEGACY_HERO_2.name);
    expect(hero.rarity).toBe(LEGACY_HERO_2.rarity);
    expect(hero.level).toBe(LEGACY_HERO_2.level);
    expect(hero.stars).toBe(LEGACY_HERO_2.stars);
    expect(hero.loadout).toEqual(LEGACY_HERO_2.loadout);
    expect(hero.abilities).toEqual(LEGACY_HERO_2.abilities);
    expect(hero.sourceId).toBe(LEGACY_HERO_2.sourceId);
  });

  it('no derived pipeline value is NaN after hydrating a legacy record (BSPW2-AC-15) — fails without the normalizer', () => {
    localStorage.setItem('bf-hp-heroes-v1', JSON.stringify([LEGACY_HERO_2]));
    const heroes = loadHeroes();
    const hero = heroes[0];

    usePlannerStore.getState().hydrateRoster(heroes, hero.id);
    usePlannerStore.getState().applyHero(hero);

    const pipeline = selectAdvisorPipeline(usePlannerStore.getState());

    for (const key of Object.keys(pipeline.adjusted) as (keyof typeof pipeline.adjusted)[]) {
      expect(Number.isFinite(pipeline.adjusted[key]), `adjusted.${key}`).toBe(true);
    }
    for (const key of Object.keys(pipeline.A.delta) as (keyof typeof pipeline.A.delta)[]) {
      expect(Number.isFinite(pipeline.A.delta[key]), `delta.${key}`).toBe(true);
    }
    for (const key of Object.keys(pipeline.A.effectiveDelta) as (keyof typeof pipeline.A.effectiveDelta)[]) {
      expect(Number.isFinite(pipeline.A.effectiveDelta[key]), `effectiveDelta.${key}`).toBe(true);
    }
    expect(Number.isFinite(pipeline.spentDelta)).toBe(true);
  });

  it('coerces a non-finite or non-numeric stored luck (null, "3", NaN) to 0 (BSPW2-AC-16)', () => {
    const variants: unknown[] = [null, '3', NaN];
    for (const badLuck of variants) {
      const raw = JSON.parse(LEGACY_HERO_2_JSON) as Record<string, unknown>;
      (raw.naked as Record<string, unknown>).luck = badLuck;
      const hero = normalizeHero(raw as Partial<HeroRecord> & Pick<HeroRecord, 'id' | 'name'>);
      expect(hero.naked.luck, `luck=${JSON.stringify(badLuck)}`).toBe(0);
    }
  });

  it('re-save emits "luck":0 on all three sub-objects and never creates a -v2 key (BSPW2-AC-17)', () => {
    localStorage.setItem('bf-hp-heroes-v1', JSON.stringify([LEGACY_HERO_2]));
    const heroes = loadHeroes();

    saveHeroes(heroes);

    const raw = localStorage.getItem('bf-hp-heroes-v1');
    expect(raw).not.toBeNull();
    const matches = raw?.match(/"luck":0/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(3);
    expect(localStorage.getItem('bf-hp-heroes-v2')).toBeNull();
  });

  it('fills luck silently — no console warning or error (BSPW2-AC-18)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    localStorage.setItem('bf-hp-heroes-v1', JSON.stringify([LEGACY_HERO_2]));
    loadHeroes();

    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
