/**
 * Flat-crit-chance / flat-CDR one-shot local-data migration proof — the crit CHANCE twin of
 * `storage-critdmg-flat-migration.test.ts`.
 *
 * Before the 2026-08-15 patch a hero's `naked.critChance` was written as
 * `rollTimesStar × (1 + 0.0075 × olho_clinico rank)` and its `gearedOverride.critChance` / `.cdr`
 * as `naked × (1 + Σ gear)`. Every reader now treats those same stored numbers as flat sums.
 * Without a migration an existing local record is silently misread on every future load.
 *
 * The case worth writing a test for is the SECOND trigger. "The Olho Clínico migration" invites a
 * gate on the ability alone, and that gate is not enough: gear changed shape for crit chance AND
 * for cooldown, and cooldown has no ability at all, so a rank-0 record wearing a cooldown roll
 * would keep a stale `gearedOverride.cdr` forever. Cooldown is the leading roll on pants after
 * the 2026-08-16 redistribution, so that is the common record, not the exotic one.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadHeroes } from '@/shared/lib/storage';
import { sumGearBonuses, type Loadout } from '@bombfarm/domain/gear';

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

const CRIT_CHANCE_FLAT_MIGRATED_KEY = 'bf-hp-critchance-flat-migrated-v1';

/** ★0, so `rollTimesStar` is just the roll. */
const ROLL_TIMES_STAR = 8;
const RANK_20_LEGACY_CRIT_CHANCE = ROLL_TIMES_STAR * (1 + 0.0075 * 20); // 9.2
const RANK_20_MIGRATED_CRIT_CHANCE = ROLL_TIMES_STAR + 0.04574 * 20; // 8.9148

/** `ember_calca` leads with a cooldown roll post-redistribution; `ember_anel` leads with crit. */
const PANTS_WITH_CDR = { defId: 'ember_calca', rarityIdx: 2, level: 10, upgrade: 0 };
const RING_WITH_CRIT = { defId: 'ember_anel', rarityIdx: 2, level: 10, upgrade: 0 };

function emptySlots(): Loadout {
  return {
    arma: null,
    elmo: null,
    anel: null,
    amuleto: null,
    peito: null,
    calca: null,
    luva: null,
    bota: null,
  };
}

function legacyHeroJson(overrides: {
  id: string;
  olhoRank: number;
  critChance: number;
  loadout?: Loadout;
}): Record<string, unknown> {
  const sheet = {
    attack: 150,
    energy: 270,
    speed: 51,
    critChance: overrides.critChance,
    critDmg: 65,
    penetration: 2.5,
    cdr: 2.5,
    luck: 6,
  };
  return {
    id: overrides.id,
    name: 'Legacy',
    updatedAt: 1700000000000,
    rarity: 'Raro',
    level: 40,
    stars: 0,
    naked: sheet,
    loadout: overrides.loadout ?? emptySlots(),
    altLoadout: null,
    // Deliberately equal to `naked` — the pre-patch pool factors on this fixture's gear are tiny,
    // and what the assertions below check is whether the record was rebuilt at all, not the exact
    // legacy arithmetic (which is unrecoverable by construction — the old catalog is gone).
    gearedOverride: { ...sheet, attack: 160 },
    abilities: overrides.olhoRank > 0 ? { olho_clinico: overrides.olhoRank } : {},
    pts: { attack: 0, energy: 0, speed: 0, critChance: 0, critDmg: 0, penetration: 0, cdr: 0, luck: 0 },
    sourceId: `save-${overrides.id}`,
    deployed: false,
    battleAllowed: true,
  };
}

describe('critChance / CDR flat-bake migration', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryLocalStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('a legacy record with Olho Clínico 20 migrates naked.critChance to roll + 20 × 0.04574', () => {
    localStorage.setItem(
      'bf-hp-heroes-v1',
      JSON.stringify([
        legacyHeroJson({ id: 'h1', olhoRank: 20, critChance: RANK_20_LEGACY_CRIT_CHANCE }),
      ]),
    );

    const heroes = loadHeroes();
    expect(heroes).toHaveLength(1);
    expect(heroes[0].naked.critChance).toBeCloseTo(RANK_20_MIGRATED_CRIT_CHANCE, 9);

    // And it is written back, so a fresh load of the same key keeps reading it correctly.
    const raw = JSON.parse(localStorage.getItem('bf-hp-heroes-v1') as string) as {
      naked: { critChance: number };
    }[];
    expect(raw[0].naked.critChance).toBeCloseTo(RANK_20_MIGRATED_CRIT_CHANCE, 9);
  });

  it('a rank-0 record with NO crit/cooldown gear is left untouched', () => {
    localStorage.setItem(
      'bf-hp-heroes-v1',
      JSON.stringify([legacyHeroJson({ id: 'h2', olhoRank: 0, critChance: 8 })]),
    );

    const heroes = loadHeroes();
    expect(heroes[0].naked.critChance).toBe(8);
    // `gearedOverride` survives as stored — nothing invalidated it.
    expect(heroes[0].gearedOverride.critChance).toBe(8);
    expect(heroes[0].gearedOverride.attack).toBe(160);
  });

  // The second trigger. Without it this record keeps a `gearedOverride.cdr` built on the
  // pre-patch multiplicative pool, and no later load ever revisits it.
  it('a rank-0 record wearing a COOLDOWN roll still has its gearedOverride rebuilt', () => {
    const loadout = { ...emptySlots(), calca: PANTS_WITH_CDR };
    const gear = sumGearBonuses(loadout);
    expect(gear.cdrFlatPct, 'fixture premise: these pants really do roll cooldown').toBeGreaterThan(0);

    localStorage.setItem(
      'bf-hp-heroes-v1',
      JSON.stringify([legacyHeroJson({ id: 'h3', olhoRank: 0, critChance: 8, loadout })]),
    );

    const heroes = loadHeroes();
    // Rebuilt as `applyGear(naked, loadout, sheetOther)`: naked.cdr + the flat gear term.
    expect(heroes[0].gearedOverride.cdr).toBeCloseTo(2.5 + gear.cdrFlatPct, 9);
    expect(heroes[0].gearedOverride.cdr).not.toBe(2.5);
    // naked is untouched — there is no cooldown ability to un-bake.
    expect(heroes[0].naked.cdr).toBe(2.5);
    expect(heroes[0].naked.critChance).toBe(8);
  });

  it('a rank-0 record wearing a CRIT roll also has its gearedOverride rebuilt', () => {
    const loadout = { ...emptySlots(), anel: RING_WITH_CRIT };
    const gear = sumGearBonuses(loadout);
    expect(gear.critFlatPct, 'fixture premise: this ring really does roll crit').toBeGreaterThan(0);

    localStorage.setItem(
      'bf-hp-heroes-v1',
      JSON.stringify([legacyHeroJson({ id: 'h4', olhoRank: 0, critChance: 8, loadout })]),
    );

    const heroes = loadHeroes();
    expect(heroes[0].gearedOverride.critChance).toBeCloseTo(8 + gear.critFlatPct, 9);
    expect(heroes[0].gearedOverride.critChance).not.toBe(8);
  });

  it('does not run a second time on an already-migrated store', () => {
    localStorage.setItem(
      'bf-hp-heroes-v1',
      JSON.stringify([
        legacyHeroJson({ id: 'h5', olhoRank: 20, critChance: RANK_20_LEGACY_CRIT_CHANCE }),
      ]),
    );

    const firstLoad = loadHeroes();
    expect(firstLoad[0].naked.critChance).toBeCloseTo(RANK_20_MIGRATED_CRIT_CHANCE, 9);
    expect(localStorage.getItem(CRIT_CHANCE_FLAT_MIGRATED_KEY)).toBe('true');

    // A second load must be the identity — re-dividing would corrupt the value a second time.
    const secondLoad = loadHeroes();
    expect(secondLoad[0].naked.critChance).toBeCloseTo(RANK_20_MIGRATED_CRIT_CHANCE, 9);
  });

  it('writes the marker even when no record in the roster needed converting', () => {
    localStorage.setItem(
      'bf-hp-heroes-v1',
      JSON.stringify([legacyHeroJson({ id: 'h6', olhoRank: 0, critChance: 8 })]),
    );
    loadHeroes();
    expect(localStorage.getItem(CRIT_CHANCE_FLAT_MIGRATED_KEY)).toBe('true');
  });
});
