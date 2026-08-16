/**
 * Flat-crit-damage fix (PR #90 review item 1) — a one-shot local-data migration proof.
 *
 * Before this PR, `rescaleNakedCritDmg` wrote a hero's `naked.critDmg` / `gearedOverride.critDmg`
 * as `rollTimesStar × (1 + 0.04 × golpe_brutal rank)` (the multiplicative bake). After this PR,
 * every reader (`birthFromNaked`, `rescaleNakedCritDmg`, `defaultNaked`, `tab-status-selectors`'s
 * default-sheet comparison) treats the SAME stored number as `rollTimesStar + 4 × rank` (the
 * flat-additive bake). Without a migration, an existing local record with Golpe Brutal spent
 * would be silently misread on every future load, and setting Golpe Brutal to 0 would rewrite the
 * misread value back to storage — a permanent corruption.
 *
 * `loadHeroes()` (`@/shared/lib/storage.ts`) now walks the WHOLE stored roster through this
 * conversion exactly once, gated by a `bf-hp-critdmg-flat-migrated-v1` marker key (the same
 * schema-version-bump idiom the module already uses for `bf-pa-heroes-v2`/`v1` →
 * `bf-hp-heroes-v1`).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadHeroes, saveHeroes } from '@/shared/lib/storage';
import { resolveDeriveSheets } from '@bombfarm/domain/advisor-pipeline-sheets';
import { emptyLoadout, emptySheetOther, type SheetStats } from '@bombfarm/domain/gear';

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

const CRIT_DMG_FLAT_MIGRATED_KEY = 'bf-hp-critdmg-flat-migrated-v1';

/** roll × star (★0, so this is just the roll) = 65; legacy bake at rank 20: 65 × 1.8 = 117. */
const ROLL_TIMES_STAR = 65;
const RANK_20_LEGACY_CRIT_DMG = ROLL_TIMES_STAR * (1 + 0.04 * 20); // 117
const RANK_20_MIGRATED_CRIT_DMG = ROLL_TIMES_STAR + 4 * 20; // 145

function legacyHeroJson(overrides: {
  id: string;
  golpeBrutalRank: number;
  critDmg: number;
}): Record<string, unknown> {
  return {
    id: overrides.id,
    name: 'Legacy',
    updatedAt: 1700000000000,
    rarity: 'Raro',
    level: 40,
    stars: 0,
    naked: {
      attack: 150,
      energy: 270,
      speed: 51,
      critChance: 7,
      critDmg: overrides.critDmg,
      penetration: 2.5,
      cdr: 2.5,
      luck: 6,
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
      attack: 160,
      energy: 270,
      speed: 51,
      critChance: 7,
      critDmg: overrides.critDmg,
      penetration: 2.5,
      cdr: 2.5,
      luck: 6,
    },
    abilities: overrides.golpeBrutalRank > 0 ? { golpe_brutal: overrides.golpeBrutalRank } : {},
    pts: { attack: 0, energy: 0, speed: 0, critChance: 0, critDmg: 0, penetration: 0, cdr: 0, luck: 0 },
    sourceId: `save-${overrides.id}`,
    deployed: false,
    battleAllowed: true,
  };
}

describe('critDmg flat-bake migration (PR #90 review item 1)', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryLocalStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('a legacy record with Golpe Brutal 20 migrates naked.critDmg AND gearedOverride.critDmg to roll + 80', () => {
    localStorage.setItem(
      'bf-hp-heroes-v1',
      JSON.stringify([legacyHeroJson({ id: 'h1', golpeBrutalRank: 20, critDmg: RANK_20_LEGACY_CRIT_DMG })]),
    );

    const heroes = loadHeroes();
    expect(heroes).toHaveLength(1);
    expect(heroes[0].naked.critDmg).toBeCloseTo(RANK_20_MIGRATED_CRIT_DMG, 9);
    expect(heroes[0].gearedOverride.critDmg).toBeCloseTo(RANK_20_MIGRATED_CRIT_DMG, 9);

    // And it is written back so a fresh load of the same key keeps reading it correctly.
    const raw = JSON.parse(localStorage.getItem('bf-hp-heroes-v1') as string) as { naked: { critDmg: number } }[];
    expect(raw[0].naked.critDmg).toBeCloseTo(RANK_20_MIGRATED_CRIT_DMG, 9);
  });

  it('a rank-0 (no Golpe Brutal) record is byte-for-byte untouched', () => {
    localStorage.setItem(
      'bf-hp-heroes-v1',
      JSON.stringify([legacyHeroJson({ id: 'h2', golpeBrutalRank: 0, critDmg: 65 })]),
    );

    const heroes = loadHeroes();
    expect(heroes).toHaveLength(1);
    expect(heroes[0].naked.critDmg).toBe(65);
    expect(heroes[0].gearedOverride.critDmg).toBe(65);
  });

  it('does not run a second time on an already-migrated store', () => {
    localStorage.setItem(
      'bf-hp-heroes-v1',
      JSON.stringify([legacyHeroJson({ id: 'h3', golpeBrutalRank: 20, critDmg: RANK_20_LEGACY_CRIT_DMG })]),
    );

    const firstLoad = loadHeroes();
    expect(firstLoad[0].naked.critDmg).toBeCloseTo(RANK_20_MIGRATED_CRIT_DMG, 9);
    expect(localStorage.getItem(CRIT_DMG_FLAT_MIGRATED_KEY)).toBe('true');

    // Re-load from the now-migrated, marker-set store: value must be stable, not re-converted.
    const secondLoad = loadHeroes();
    expect(secondLoad[0].naked.critDmg).toBeCloseTo(RANK_20_MIGRATED_CRIT_DMG, 9);

    // The sharpest proof of the gate: pre-set the marker, then hand it a record whose stored
    // value LOOKS legacy (rank 20, still baked at 117). If the gate were content-based instead
    // of marker-based, this would get "helpfully" converted anyway — it must not.
    localStorage.clear();
    localStorage.setItem(CRIT_DMG_FLAT_MIGRATED_KEY, JSON.stringify(true));
    localStorage.setItem(
      'bf-hp-heroes-v1',
      JSON.stringify([legacyHeroJson({ id: 'h4', golpeBrutalRank: 20, critDmg: RANK_20_LEGACY_CRIT_DMG })]),
    );
    const gatedLoad = loadHeroes();
    expect(gatedLoad[0].naked.critDmg).toBe(RANK_20_LEGACY_CRIT_DMG);
  });

  it('re-save persists the migrated value and never creates a new heroes key', () => {
    localStorage.setItem(
      'bf-hp-heroes-v1',
      JSON.stringify([legacyHeroJson({ id: 'h5', golpeBrutalRank: 20, critDmg: RANK_20_LEGACY_CRIT_DMG })]),
    );
    const heroes = loadHeroes();
    saveHeroes(heroes);

    const raw = localStorage.getItem('bf-hp-heroes-v1');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw as string) as { naked: { critDmg: number } }[];
    expect(parsed[0].naked.critDmg).toBeCloseTo(RANK_20_MIGRATED_CRIT_DMG, 9);
    expect(localStorage.getItem('bf-hp-heroes-v2')).toBeNull();
  });

  it('a birth-carrying record is unaffected in behaviour: resolveDeriveSheets ignores stored naked/gearedOverride entirely when birth is present', () => {
    // This is the domain-level guarantee the migration's docs rely on: whatever the stored
    // naked/gearedOverride say (pre- or post-migration), a birth-backed hero's derived sheet
    // comes from `birth` alone via `sheetsFromBirth` — the storage-level conversion is
    // irrelevant to what actually reaches the pipeline.
    const birth: SheetStats = {
      attack: 10,
      energy: 20,
      speed: 30,
      critChance: 5,
      critDmg: 65,
      penetration: 1,
      cdr: 1,
      luck: 2,
    };
    const staleNaked: SheetStats = { ...birth, critDmg: RANK_20_LEGACY_CRIT_DMG };
    const migratedNaked: SheetStats = { ...birth, critDmg: RANK_20_MIGRATED_CRIT_DMG };
    const loadout = emptyLoadout();
    const sheetOther = { ...emptySheetOther(), critDmgFlat: 80 };
    const shared = {
      geared: staleNaked,
      loadout,
      level: 40,
      stars: 0,
      sheetOther,
      treeDanoTotal: 1,
      treeCritChance: 0,
      treeCritDmg: 0,
      treeSpeed: 0,
      treeEnergy: 0,
      treeLuckFlatPct: 0,
      birth,
    };

    const withStaleNaked = resolveDeriveSheets({ ...shared, naked: staleNaked });
    const withMigratedNaked = resolveDeriveSheets({ ...shared, naked: migratedNaked });

    expect(withMigratedNaked.nakedForDerive).toEqual(withStaleNaked.nakedForDerive);
    expect(withMigratedNaked.gearedForDerive).toEqual(withStaleNaked.gearedForDerive);
  });
});
