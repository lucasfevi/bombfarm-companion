/**
 * BSPW3-13 (AC-25/-25a/-25b) — stored ability levels survive the rank-20 catalog migration.
 *
 * `local-data-compat.md` rule 7 ("Prove it") over a real stored payload. This is
 * deliberately NOT `storage-roundtrip.test.ts` / `storage-roundtrip-20260729.json` — that
 * fixture is the frozen byte-identity tripwire (output ≡ input under the current
 * schema) and L-03 forbids one file serving both that role and this wave's compat proof
 * (output ≠ input under the OLD, pre-rank-20 `abilityMods` interpretation).
 *
 * Levels above the old `max: 10` (explosao_ampla @ 20) are already reaching storage today
 * (`import-save.ts` never clamped on write) — `normalizeHero` copies `abilities` verbatim
 * and `RankControl` renders `value` independently of `max`, so this is additive, not a
 * migration (`local-data-compat.md` rule 6).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { abilityMods } from '@bombfarm/domain/model';
import { loadHeroes, saveHeroes, type HeroRecord } from '@/shared/lib/storage';

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

// A real stored HeroRecord shape (current bf-hp-heroes-v1 schema, 8-key sheets) carrying
// ability levels above the pre-W3 max: 10 (explosao_ampla @ 20) and a mid-curve on-sheet
// level (ponta_diamante @ 10) — both legitimately reachable via import today.
const STORED_HERO_JSON =
  '{"id":"hero-ability-w3","name":"Ranked","updatedAt":1700000000003,"rarity":"Épico","level":40,"stars":1,' +
  '"naked":{"attack":300,"energy":400,"speed":50,"critChance":10,"critDmg":80,"penetration":3,"cdr":5,"luck":10},' +
  '"loadout":{"arma":null,"elmo":null,"anel":null,"amuleto":null,"peito":null,"calca":null,"luva":null,"bota":null},' +
  '"altLoadout":null,' +
  '"gearedOverride":{"attack":310,"energy":400,"speed":50,"critChance":10,"critDmg":80,"penetration":3,"cdr":5,"luck":10},' +
  '"abilities":{"explosao_ampla":20,"ponta_diamante":10},' +
  '"pts":{"attack":0,"energy":0,"speed":0,"critChance":0,"critDmg":0,"penetration":0,"cdr":0,"luck":0},' +
  '"sourceId":"save-w3-1","deployed":false,"battleAllowed":true,"skin":0}';

const STORED_HERO = JSON.parse(STORED_HERO_JSON) as Record<string, unknown>;

describe('stored ability levels survive the rank-20 catalog migration (BSPW3-13)', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryLocalStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('AC-25: both levels survive verbatim through loadHeroes() over a stubbed localStorage', () => {
    localStorage.setItem('bf-hp-heroes-v1', JSON.stringify([STORED_HERO]));

    let heroes: HeroRecord[] = [];
    expect(() => {
      heroes = loadHeroes();
    }).not.toThrow();

    expect(heroes).toHaveLength(1);
    const hero = heroes[0];
    // Not clamped to 10, not raised to 20 — copied exactly as stored.
    expect(hero.abilities.explosao_ampla).toBe(20);
    expect(hero.abilities.ponta_diamante).toBe(10);
    expect(hero.abilities).toEqual(STORED_HERO.abilities);
  });

  it('AC-25a: abilityMods on the loaded record reflects the corrected (not double-counted) W3 curve', () => {
    localStorage.setItem('bf-hp-heroes-v1', JSON.stringify([STORED_HERO]));
    const hero = loadHeroes()[0];

    const mods = abilityMods(hero.abilities);
    // explosao_ampla @ 20, perLevel 0.1 (W3) -> rangeCells = 2.0, not the old
    // perLevel 0.2 double-counted value (4.0) that a stale catalog would have produced
    // for a rank the old max: 10 catalog was never meant to accept.
    expect(mods.rangeCells).toBeCloseTo(2.0, 10);
    // ponta_diamante @ 10, perLevel 1.0 (W3) -> sheetPenetrationRaw = 10, not the old
    // perLevel 2.0 value (20).
    expect(mods.sheetPenetrationRaw).toBeCloseTo(10, 10);
  });

  it('AC-25: the storage key stays bf-hp-heroes-v1 (additive change, no -v2 bump)', () => {
    localStorage.setItem('bf-hp-heroes-v1', JSON.stringify([STORED_HERO]));
    loadHeroes();
    expect(localStorage.getItem('bf-hp-heroes-v1')).not.toBeNull();
    expect(localStorage.getItem('bf-hp-heroes-v2')).toBeNull();
  });

  it('re-save round-trips the same ability levels (no clamp on write either)', () => {
    localStorage.setItem('bf-hp-heroes-v1', JSON.stringify([STORED_HERO]));
    const heroes = loadHeroes();
    saveHeroes(heroes);

    const reloaded = loadHeroes();
    expect(reloaded[0].abilities.explosao_ampla).toBe(20);
    expect(reloaded[0].abilities.ponta_diamante).toBe(10);
  });
});
