/**
 * `statPointsAvailable` backward-compat proof — follows the same additive-optional-field
 * pattern as `luckFlatPct` (`AccountShared.tree`, MP5 F3) and `luck` before it
 * (`storage-luck-compat.test.ts`): a genuine pre-`statPointsAvailable` `bf-hp-heroes-v1` blob
 * (no `statPointsAvailable` key on the hero) must still load cleanly through `loadHeroes` /
 * `normalizeHero` (the "user's existing localStorage from a previous version" path), default
 * `statPointsAvailable` to `0` (identity — no banked points the reopt budget doesn't already
 * know about), and never silently change an existing user's respec recommendations on upgrade.
 *
 * This field lives on `HeroRecord` itself — a single top-level default rather than a nested one.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { findGateCandidate } from '@bombfarm/domain/points-reopt';
import { derive } from '@bombfarm/domain/derive';
import { computeCombatMults } from '@bombfarm/domain/derive';
import { abilityMods } from '@bombfarm/domain/model';
import { zeroTeamBuffs } from '@bombfarm/domain/team-buffs';
import { ZERO_PTS } from '@bombfarm/domain/planner-constants';
import { loadHeroes, saveHeroes } from '@/shared/lib/storage';

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

// Real pre-statPointsAvailable shape — the post-luck (BSPW2) eight-key schema, with `pts` all
// zero on purpose (not the trivial "already had some spent" case): this is exactly the "0 spent"
// half of the "0 spent, N unspent" case the budget<=0 fast path used to get wrong. A legacy
// record predating this field has no way to express "N unspent" at all — the identity default
// (0) is the only sound reading of that absence.
const LEGACY_HERO_2_JSON =
  '{"id":"hero-2","name":"Brick","updatedAt":1700000000002,"rarity":"Épico","level":30,"stars":2,' +
  '"naked":{"attack":150,"energy":180,"speed":40,"critChance":8,"critDmg":80,"penetration":0,"cdr":5,"luck":0},' +
  '"loadout":{"arma":null,"elmo":null,"anel":null,"amuleto":null,"peito":null,"calca":null,"luva":null,"bota":null},' +
  '"altLoadout":null,' +
  '"gearedOverride":{"attack":160,"energy":180,"speed":40,"critChance":8,"critDmg":80,"penetration":0,"cdr":5,"luck":0},' +
  '"abilities":{},' +
  '"pts":{"attack":0,"energy":0,"speed":0,"critChance":0,"critDmg":0,"penetration":0,"cdr":0,"luck":0},' +
  '"sourceId":"save-2","deployed":false,"battleAllowed":true,"skin":1}';

const LEGACY_HERO_2 = JSON.parse(LEGACY_HERO_2_JSON) as Record<string, unknown>;

describe('legacy statPointsAvailable compat (unspent-points wave)', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryLocalStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads a pre-statPointsAvailable save without throwing; statPointsAvailable defaults to 0, every other field intact', () => {
    localStorage.setItem('bf-hp-heroes-v1', JSON.stringify([LEGACY_HERO_2]));

    let heroes: ReturnType<typeof loadHeroes> = [];
    expect(() => {
      heroes = loadHeroes();
    }).not.toThrow();

    expect(heroes).toHaveLength(1);
    const hero = heroes[0];
    expect(hero.statPointsAvailable).toBe(0);
    expect(hero.id).toBe(LEGACY_HERO_2.id);
    expect(hero.name).toBe(LEGACY_HERO_2.name);
    expect(hero.pts).toEqual(LEGACY_HERO_2.pts);
    expect(hero.naked).toEqual(LEGACY_HERO_2.naked);
    expect(hero.sourceId).toBe(LEGACY_HERO_2.sourceId);
  });

  it("the resulting reopt budget is exactly the same as an explicit statPointsAvailable: 0 — an existing user's recommendations cannot silently change on upgrade", () => {
    localStorage.setItem('bf-hp-heroes-v1', JSON.stringify([LEGACY_HERO_2]));
    const hero = loadHeroes()[0];

    const mods = abilityMods(hero.abilities);
    const mults = computeCombatMults({
      mods,
      teamBuffs: zeroTeamBuffs(),
      extraDmgPct: 0,
    });
    const context = { restSeconds: 19 * 60, mitigation: 0.067, blastRange: 1, cycleModel: 'serial' as const, walkDelay: 0.15, drainMult: 1 };
    const derived = derive({
      geared: hero.gearedOverride,
      naked: hero.naked,
      sheetOther: { speed: 0, critChance: 0, critDmg: 0, penetration: 0, cdr: 0 },
      pts: ZERO_PTS(),
      rarity: hero.rarity,
      level: hero.level,
      stars: hero.stars,
      attackMult: mults.attackMult,
      energyMult: mults.energyMult,
      speedMult: mults.speedMult,
      critDmgMult: mults.critDmgMult,
      teamCritPctOfBase: 0,
      treeSheet: { danoStatic: 1, energyPct: 0, speedPct: 0, critChancePct: 0, critDmgPct: 0, luckFlatPct: 0 },
      combatCritChancePctOfBase: mods.combatCritChancePctOfBase,
      penetrationPp: mods.penetrationPp,
      context,
      dmgMult: mults.dmgMult,
      mitigationPct: 6.7,
    });

    const withDefault = findGateCandidate({
      pts: hero.pts,
      effective: derived.effective,
      effectiveDelta: derived.effectiveDelta,
      context,
      statPointsAvailable: hero.statPointsAvailable,
    });
    const withoutField = findGateCandidate({
      pts: hero.pts,
      effective: derived.effective,
      effectiveDelta: derived.effectiveDelta,
      context,
    });
    const withExplicitZero = findGateCandidate({
      pts: hero.pts,
      effective: derived.effective,
      effectiveDelta: derived.effectiveDelta,
      context,
      statPointsAvailable: 0,
    });

    expect(withDefault).toEqual(withoutField);
    expect(withDefault).toEqual(withExplicitZero);
  });

  it('re-save emits "statPointsAvailable":0 and never creates a -v2 key', () => {
    localStorage.setItem('bf-hp-heroes-v1', JSON.stringify([LEGACY_HERO_2]));
    const heroes = loadHeroes();

    saveHeroes(heroes);

    const raw = localStorage.getItem('bf-hp-heroes-v1');
    expect(raw).not.toBeNull();
    expect(raw).toContain('"statPointsAvailable":0');
    expect(localStorage.getItem('bf-hp-heroes-v2')).toBeNull();
  });

  it('fills statPointsAvailable silently — no console warning or error', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    localStorage.setItem('bf-hp-heroes-v1', JSON.stringify([LEGACY_HERO_2]));
    loadHeroes();

    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });
});

