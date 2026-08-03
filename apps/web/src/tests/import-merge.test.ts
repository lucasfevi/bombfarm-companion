import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyGear,
  applyPoints,
  emptyLoadout,
  emptySheetOther,
  type Loadout,
  type SheetStats,
} from '@bombfarm/domain/gear';
import { abilityMods } from '@bombfarm/domain/model';
import { mergeImportedHero, recomputeGearedSheet } from '@bombfarm/domain/import-merge';
import { parseSaveFile } from '@bombfarm/domain/import-save';
import { applySkillTree } from '@bombfarm/domain/birth-sheet';
import { saveSheetUnits, treeTotalsFromSave } from '@bombfarm/domain/save-units';
import { SHEET_KEYS, ZERO_PTS_TEMPLATE } from '@bombfarm/domain/planner-constants';
import { importHeroes, loadHeroes, normalizeHero, type HeroRecord } from '@/shared/lib/storage';
import { loadFixtureJson } from './helpers/sheet-math-fixtures';

const sheet = (patch: Partial<SheetStats> = {}): SheetStats => ({
  attack: 100,
  energy: 200,
  speed: 50,
  critChance: 10,
  critDmg: 80,
  penetration: 5,
  cdr: 4,
  luck: 20,
  ...patch,
});

function sheetOtherFor(abilities: Record<string, number>) {
  const mods = abilityMods(abilities);
  return {
    ...emptySheetOther(),
    critChance: mods.sheetCritChancePctOfBase / 100,
    penetration: mods.sheetPenetrationRaw,
    critDmg: mods.sheetCritDmgPctOfBase,
  };
}

function weaponLoadout(): Loadout {
  const loadout = emptyLoadout();
  loadout.arma = { defId: 'clay_arma', rarityIdx: 2, level: 40, upgrade: 10 };
  loadout.elmo = { defId: 'clay_elmo', rarityIdx: 2, level: 40, upgrade: 5 };
  return loadout;
}

function hero(partial: Partial<HeroRecord> & Pick<HeroRecord, 'id' | 'name'>): HeroRecord {
  return normalizeHero({
    rarity: 'Raro',
    level: 55,
    stars: 1,
    naked: sheet({ attack: 500, energy: 800, critChance: 12, critDmg: 90 }),
    loadout: emptyLoadout(),
    altLoadout: null,
    gearedOverride: sheet({ attack: 600 }),
    abilities: {},
    pts: { ...ZERO_PTS_TEMPLATE, attack: 3, critChance: 2, energy: 1 },
    sourceId: 'game-1',
    battleAllowed: true,
    ...partial,
  });
}

/** Strips id/updatedAt from a full HeroRecord to match mergeImportedHero's `incoming` shape. */
function asIncoming(record: HeroRecord): Omit<HeroRecord, 'id' | 'updatedAt'> {
  const { id: _id, updatedAt: _updatedAt, ...rest } = record;
  return rest;
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

describe('recomputeGearedSheet', () => {
  it('equals applyGear — never applyPoints (pre-points geared column)', () => {
    const h = hero({ id: 'a', name: 'A' });
    h.loadout = weaponLoadout();
    const other = sheetOtherFor(h.abilities);
    const gearedOnly = applyGear(h.naked, h.loadout, other);
    const withPoints = applyPoints(h.naked, h.loadout, h.pts, other, h.level, h.stars);

    expect(recomputeGearedSheet(h)).toEqual(gearedOnly);
    expect(withPoints.attack).toBeGreaterThan(gearedOnly.attack + 50);
    expect(recomputeGearedSheet(h).attack).not.toBeCloseTo(withPoints.attack, 0);
  });

  it('ignores spent pts on attack, energy, and shared-pool stats', () => {
    const h = hero({
      id: 'b',
      name: 'B',
      pts: {
        ...ZERO_PTS_TEMPLATE,
        attack: 5,
        energy: 4,
        critChance: 3,
        speed: 2,
        critDmg: 6,
      },
    });
    h.loadout = weaponLoadout();
    const other = sheetOtherFor(h.abilities);
    const geared = recomputeGearedSheet(h);
    const expectedGear = applyGear(h.naked, h.loadout, other);

    for (const k of SHEET_KEYS) {
      expect(geared[k]).toBeCloseTo(expectedGear[k], 6);
    }
    expect(applyPoints(h.naked, h.loadout, h.pts, other, h.level, h.stars).critDmg).toBeGreaterThan(
      geared.critDmg + 20,
    );
  });

  it('does not need level or stars — gear layer only', () => {
    const h = hero({ id: 'c', name: 'C', level: 72, stars: 2 });
    h.loadout = weaponLoadout();
    const recomputed = recomputeGearedSheet(h);
    expect(recomputed.attack).toBeGreaterThan(h.naked.attack);
    expect(recomputed.attack).toBeLessThan(
      applyPoints(h.naked, h.loadout, h.pts, sheetOtherFor(h.abilities), h.level, h.stars).attack,
    );
  });
});

/**
 * BSPW5-07 (BSP-05, AD-BSP-13): mergeImportedHero is a full OVERWRITE, not a gear-refresh
 * merge. `existing` supplies only id/sourceId/altLoadout; everything else comes from
 * `incoming` — including fields the old body used to preserve (naked/pts/level/stars/
 * rarity/abilities).
 */
describe('mergeImportedHero', () => {
  function existingWithStaleData(): HeroRecord {
    return hero({
      id: 'local-1',
      name: 'Old Name',
      sourceId: 'game-1',
      naked: sheet({ attack: 1 }),
      gearedOverride: sheet({ attack: 2 }),
      pts: { ...ZERO_PTS_TEMPLATE, attack: 99 },
      level: 1,
      stars: 0,
      rarity: 'Comum',
      abilities: { stale_ability: 5 },
      loadout: emptyLoadout(),
      rank: 'E',
      power: 1,
      deployed: false,
      battleAllowed: false,
      skin: 1,
      // The single field that must survive the overwrite (AC-18) — distinctive so a bug
      // that drops or overwrites it is easy to spot.
      altLoadout: weaponLoadout(),
    });
  }

  function incomingFresh(): Omit<HeroRecord, 'id' | 'updatedAt'> {
    return asIncoming(
      hero({
        id: 'ignored',
        name: 'New Name',
        sourceId: 'game-1',
        naked: sheet({ attack: 999 }),
        gearedOverride: sheet({ attack: 888 }),
        pts: { ...ZERO_PTS_TEMPLATE, attack: 7, critChance: 3 },
        level: 55,
        stars: 3,
        rarity: 'Mítico',
        abilities: { new_ability: 10 },
        loadout: weaponLoadout(),
        rank: 'S',
        power: 999999,
        deployed: true,
        battleAllowed: true,
        skin: 4,
        altLoadout: null,
      }),
    );
  }

  it('AC-17: overwrites naked, gearedOverride, pts, level, stars, abilities, rarity, loadout, name, skin, rank, power, deployed, battleAllowed from incoming', () => {
    const existing = existingWithStaleData();
    const incoming = incomingFresh();
    const merged = mergeImportedHero(existing, incoming);

    expect(merged.naked).toEqual(incoming.naked);
    expect(merged.gearedOverride).toEqual(incoming.gearedOverride);
    expect(merged.pts).toEqual(incoming.pts);
    expect(merged.level).toBe(incoming.level);
    expect(merged.stars).toBe(incoming.stars);
    expect(merged.abilities).toEqual(incoming.abilities);
    expect(merged.rarity).toBe(incoming.rarity);
    expect(merged.loadout).toEqual(incoming.loadout);
    expect(merged.name).toBe(incoming.name);
    expect(merged.skin).toBe(incoming.skin);
    expect(merged.rank).toBe(incoming.rank);
    expect(merged.power).toBe(incoming.power);
    expect(merged.deployed).toBe(incoming.deployed);
    expect(merged.battleAllowed).toBe(incoming.battleAllowed);
  });

  it('AC-18: id, sourceId and altLoadout are preserved from existing — altLoadout is the only planner-only field kept', () => {
    const existing = existingWithStaleData();
    const incoming = incomingFresh();
    const merged = mergeImportedHero(existing, incoming);

    expect(merged.id).toBe(existing.id);
    expect(merged.sourceId).toBe(existing.sourceId);
    expect(merged.altLoadout).toEqual(existing.altLoadout);
    expect(merged.altLoadout).not.toEqual(incoming.altLoadout);
  });

  it('refreshes updatedAt', () => {
    const existing = { ...existingWithStaleData(), updatedAt: 1 };
    const before = Date.now();
    const merged = mergeImportedHero(existing, incomingFresh());
    expect(merged.updatedAt).toBeGreaterThanOrEqual(before);
  });

  it('AC-19: name/skin A -> B survives the overwrite (BSP-39 / AD-BSP-17 regression guard)', () => {
    const existing = hero({ id: 'local-1', name: 'A', sourceId: 'game-1', skin: 1 });
    const incoming = asIncoming(hero({ id: 'x', name: 'B', sourceId: 'game-1', skin: 5 }));
    const merged = mergeImportedHero(existing, incoming);
    expect(merged.name).toBe('B');
    expect(merged.skin).toBe(5);
  });

  it('M3 discrimination: unlike the old gear-refresh body, this one does not keep stale naked/pts/level/rarity', () => {
    const existing = existingWithStaleData();
    const incoming = incomingFresh();
    const merged = mergeImportedHero(existing, incoming);
    expect(merged.naked).not.toEqual(existing.naked);
    expect(merged.pts).not.toEqual(existing.pts);
    expect(merged.level).not.toBe(existing.level);
    expect(merged.rarity).not.toBe(existing.rarity);
  });

  it('AC-21: does not call recomputeGearedSheet — gearedOverride is incoming\'s value verbatim, not applyGear(naked, loadout)', () => {
    const existing = existingWithStaleData();
    const incoming = incomingFresh();
    const merged = mergeImportedHero(existing, incoming);
    const wouldHaveRecomputed = recomputeGearedSheet(merged);
    expect(merged.gearedOverride).toEqual(incoming.gearedOverride);
    expect(merged.gearedOverride).not.toEqual(wouldHaveRecomputed);
  });

  it('AC-22: merge does not reintroduce any field W1 deleted; its key set matches the canonical HeroRecord shape', () => {
    const existing = existingWithStaleData();
    const incoming = incomingFresh();
    const merged = mergeImportedHero(existing, incoming);
    const canonical = hero({ id: 'canonical', name: 'Canonical' });
    expect(Object.keys(merged).sort()).toEqual(Object.keys(canonical).sort());
    expect(merged).not.toHaveProperty('obsHit');
    expect(merged).not.toHaveProperty('obsCrit');
  });

  it('AC-20/BSP-27: re-import vera-01 -> vera-03 (points changed) — merged naked+pts reconstruct the new save (no stale decimals)', () => {
    const raw1 = loadFixtureJson('vera-01-points-reset.json');
    const raw3 = loadFixtureJson('vera-03-pts-each-1.json');
    const { candidates: c1 } = parseSaveFile(raw1, []);
    const v1 = c1.find((c) => c.name === 'Vera')!;
    const existing = normalizeHero({ ...v1.record, id: 'local-vera', updatedAt: 1 });

    const { candidates: c3 } = parseSaveFile(raw3, []);
    const v3 = c3.find((c) => c.sourceId === v1.sourceId)!;
    const merged = mergeImportedHero(existing, v3.record);

    // Proves the merge is not stale from vera-01 (0 points) — vera-03 spent 1 pt/stat.
    expect(merged.pts).not.toEqual(existing.pts);
    expect(merged.pts).toEqual({ ...ZERO_PTS_TEMPLATE, attack: 1, energy: 1, speed: 1, critChance: 1, critDmg: 1, penetration: 1, cdr: 1, luck: 1 });

    // ASM-02: gearedOverride is deliberately the ZERO-points sheet, so comparing it
    // directly to the save's own points-inclusive `stats` would be wrong by construction.
    // Reconstruct the full sheet the same way computeAdvisorPipeline's expectedSheet does
    // (naked -> applyPoints -> applySkillTree) to prove merge's stored naked/pts/loadout
    // faithfully reproduce the NEW save, not a stale vera-01 residue.
    const mods = abilityMods(merged.abilities);
    const sheetOther = {
      ...emptySheetOther(),
      critChance: mods.sheetCritChancePctOfBase / 100,
      penetration: mods.sheetPenetrationRaw,
      critDmg: mods.sheetCritDmgPctOfBase,
    };
    const totals = (raw3 as { skills: { totals: Record<string, unknown> } }).skills.totals;
    const tree = treeTotalsFromSave(totals);
    const reconstructed = applySkillTree(
      applyPoints(merged.naked, merged.loadout, merged.pts, sheetOther, merged.level, merged.stars),
      merged.naked,
      sheetOther,
      tree,
    );
    const rawHeroes = (raw3 as { heroes: Record<string, unknown>[] }).heroes;
    const rawV3 = rawHeroes.find((h) => h.id === v3.sourceId)!;
    const expected = saveSheetUnits(rawV3.stats as Record<string, unknown>);
    for (const key of SHEET_KEYS) {
      expect(Math.abs(reconstructed[key] - expected[key]), key).toBeLessThanOrEqual(0.01);
    }
  });
});

describe('importHeroes re-import overwrite (BSPW5-07 through storage)', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryLocalStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('re-importing an existing hero overwrites naked/gearedOverride/pts/level, preserving altLoadout', () => {
    const existing = hero({ id: 'local-1', name: 'Gale', altLoadout: weaponLoadout() });
    localStorage.setItem('bf-hp-heroes-v1', JSON.stringify([existing]));

    const incoming = asIncoming(
      hero({
        id: 'new',
        name: 'Gale',
        sourceId: 'game-1',
        naked: sheet({ attack: 12345 }),
        gearedOverride: sheet({ attack: 54321 }),
        pts: { ...ZERO_PTS_TEMPLATE, energy: 9 },
        level: 99,
      }),
    );

    const { updated, heroes } = importHeroes(loadHeroes(), [{ ...incoming, sourceId: 'game-1' }]);
    expect(updated).toBe(1);

    const saved = heroes[0];
    expect(saved).toBeDefined();
    if (!saved) return;
    expect(saved.id).toBe('local-1');
    expect(saved.naked.attack).toBe(12345);
    expect(saved.gearedOverride.attack).toBe(54321);
    expect(saved.pts.energy).toBe(9);
    expect(saved.level).toBe(99);
    expect(saved.altLoadout).toEqual(weaponLoadout());
  });

  it('persisted hero: the overwrite survives a reload from localStorage byte-for-byte', () => {
    const existing = hero({ id: 'local-1', name: 'Gale', altLoadout: weaponLoadout() });
    localStorage.setItem('bf-hp-heroes-v1', JSON.stringify([existing]));

    const incoming = asIncoming(
      hero({
        id: 'new',
        name: 'Gale',
        sourceId: 'game-1',
        naked: sheet({ attack: 777 }),
        pts: { ...ZERO_PTS_TEMPLATE, critDmg: 6 },
      }),
    );
    importHeroes(loadHeroes(), [{ ...incoming, sourceId: 'game-1' }]);

    const reloaded = loadHeroes()[0];
    expect(reloaded).toBeDefined();
    if (!reloaded) return;
    expect(reloaded.naked.attack).toBe(777);
    expect(reloaded.pts.critDmg).toBe(6);
    expect(reloaded.altLoadout).toEqual(weaponLoadout());
  });
});
