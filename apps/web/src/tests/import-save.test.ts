import { describe, expect, it } from 'vitest';
import { parseSaveFile } from '@bombfarm/domain/import-save';
import { abilityMods } from '@bombfarm/domain/model';
import { defaultNaked, emptySheetOther, type Loadout, type SheetOtherPct, type SheetStats } from '@bombfarm/domain/gear';
import { composeSheetFromBirth, nakedFromBirth, type BirthStats, type TreeSheetTotals } from '@bombfarm/domain/birth-sheet';
import { inferSpentPoints } from '@bombfarm/domain/point-inference';
import { birthFromSave, saveSheetUnits, treeTotalsFromSave } from '@bombfarm/domain/save-units';
import { ZERO_PTS, type SheetKey } from '@bombfarm/domain/planner-constants';
import type { HeroRecord } from '@/shared/lib/storage';
import { loadFixtureJson } from './helpers/sheet-math-fixtures';

/**
 * BSPW5-04 test helpers — derive the SAME production-function outputs `parseSaveFile`
 * is supposed to wire together, from a raw hero JSON object, so tests assert against
 * `nakedFromBirth`/`composeSheetFromBirth`/`inferSpentPoints` directly (definitional,
 * per AC-05/06/07's "SHALL equal ... exactly") rather than reimplementing the math or
 * hand-computing expected numbers.
 */
type HeroFixture = {
  level: number;
  stars?: number;
  birth_stats: Record<string, number>;
  stats?: Record<string, number>;
  stat_points_available?: number;
};

function asHeroFixture(rawHero: unknown): HeroFixture {
  return rawHero as HeroFixture;
}

function rawSheetOther(abilities: Record<string, number>): SheetOtherPct {
  const mods = abilityMods(abilities);
  return {
    ...emptySheetOther(),
    critChance: mods.sheetCritChancePctOfBase / 100,
    penetration: mods.sheetPenetrationRaw,
    critDmg: mods.sheetCritDmgPctOfBase,
  };
}

function rawBirth(rawHero: HeroFixture): BirthStats {
  return birthFromSave(rawHero.birth_stats);
}

function expectedNaked(rawHero: HeroFixture, abilities: Record<string, number>): SheetStats {
  return nakedFromBirth(rawBirth(rawHero), rawHero.level ?? 1, rawHero.stars ?? 0, rawSheetOther(abilities));
}

function expectedGearedOverride(
  rawHero: HeroFixture,
  abilities: Record<string, number>,
  loadout: Loadout,
  tree: TreeSheetTotals,
): SheetStats {
  return composeSheetFromBirth({
    birth: rawBirth(rawHero),
    level: rawHero.level ?? 1,
    stars: rawHero.stars ?? 0,
    sheetOther: rawSheetOther(abilities),
    loadout,
    pts: ZERO_PTS(),
    tree,
  });
}

function expectedPts(
  rawHero: HeroFixture,
  abilities: Record<string, number>,
  loadout: Loadout,
  tree: TreeSheetTotals,
): Record<SheetKey, number> {
  if (!rawHero.stats) return ZERO_PTS();
  return inferSpentPoints({
    birth: rawBirth(rawHero),
    level: rawHero.level ?? 1,
    stars: rawHero.stars ?? 0,
    sheetOther: rawSheetOther(abilities),
    loadout,
    tree,
    sheet: saveSheetUnits(rawHero.stats),
    statPointsAvailable: rawHero.stat_points_available ?? 0,
  }).pts;
}

/** The account tree, computed the same way `parseSaveFile` computes it, for test inputs. */
function saveTree(save: { skills?: { totals?: Record<string, unknown> } }): TreeSheetTotals {
  return treeTotalsFromSave(save.skills?.totals ?? {});
}

function baseSave() {
  return {
    heroes: [
      {
        id: '1001',
        name: 'Cora',
        level: 47,
        rank: 'S',
        rarity: 1,
        stars: 2,
        in_field: true,
        battle_allowed: true,
        abilities: [
          { code: 'detonacao_dupla', level: 10, max: 10, slot: 11 },
          { code: 'passagem_bastao', level: 10, max: 10, slot: 13 },
        ],
        // BSPW5-04: birth_stats + stats below are self-consistent — Cora spent exactly
        // { attack: 2, critChance: 1 } (budget 3, stat_points_available 44 -> 47-44=3),
        // computed by feeding composeSheetFromBirth this exact birth/level/stars/loadout/
        // tree and converting back to save units (AD-BSP-19a). A clean, issue-free hero.
        stat_points_available: 44,
        birth_stats: {
          dmg: 60,
          energia: 150,
          speed: 45,
          crit_chance: 0.05,
          crit_dmg: 1.5,
          penetration: 0.5,
          cooldown_reduction: 0.01,
          luck: 0.02,
        },
        stats: {
          dmg: 1089.5036219123594,
          energia: 456.7372881,
          speed: 46.223410365,
          crit_chance: 0.15348165135,
          crit_dmg: 2.196153846,
          penetration: 1.7200000000000002,
          cooldown_reduction: 0.02,
          power: 13133.6,
          luck: 0.0858007275,
        },
      },
      {
        id: '1002',
        name: 'Lorne',
        level: 11,
        rank: 'C',
        rarity: 1,
        abilities: [
          { code: 'marcha_acelerada', level: 0, max: 10, slot: 3 },
          { code: 'olho_clinico', level: 10, max: 10, slot: 10 },
        ],
        // BSPW5-04: birth_stats + stats are self-consistent at zero spent points
        // (stat_points_available 11 == level -> budget 0), same derivation as Cora above.
        stat_points_available: 11,
        birth_stats: {
          dmg: 50,
          energia: 100,
          speed: 44,
          crit_chance: 0.04,
          crit_dmg: 1.5,
          penetration: 0.5,
          cooldown_reduction: 0.01,
          luck: 0.02,
        },
        stats: {
          dmg: 137.8121675711333,
          energia: 152.2457627,
          speed: 45.196223468,
          crit_chance: 0.06359266054,
          crit_dmg: 1.598076923,
          penetration: 0.5,
          cooldown_reduction: 0.01,
          power: 996.2,
          luck: 0.0594647275,
        },
      },
      {
        id: '1003',
        name: 'Weird',
        level: 5,
        rank: 'B',
        rarity: 2,
        abilities: [{ code: 'unknown_ability_xyz', level: 5, max: 10, slot: 1 }],
        birth_stats: {
          dmg: 40,
          energia: 90,
          speed: 43,
          crit_chance: 0.04,
          crit_dmg: 1.5,
          penetration: 0.4,
          cooldown_reduction: 0.01,
          luck: 0.02,
        },
        stats: {
          dmg: 100,
          energia: 200,
          speed: 48,
          crit_chance: 0.05,
          crit_dmg: 1.5,
          penetration: 1,
          cooldown_reduction: 0.01,
          power: 500,
        },
      },
      {
        id: '1004',
        name: 'Brenna',
        level: 30,
        rank: 'A',
        rarity: 2,
        stars: 0,
        abilities: [{ code: 'ponta_diamante', level: 10, max: 10, slot: 5 }],
        // BSPW5-04: birth_stats + stats are self-consistent at zero spent points
        // (stat_points_available 30 == level -> budget 0), same derivation as Cora above.
        stat_points_available: 30,
        birth_stats: {
          dmg: 70,
          energia: 120,
          speed: 44,
          crit_chance: 0.045,
          crit_dmg: 1.5,
          penetration: 0.6,
          cooldown_reduction: 0.015,
          luck: 0.02,
        },
        stats: {
          dmg: 449.2676662818946,
          energia: 182.69491524,
          speed: 45.196223468,
          crit_chance: 0.0792547431075,
          crit_dmg: 1.598076923,
          penetration: 6.935999999999999,
          cooldown_reduction: 0.015,
          power: 2500,
          luck: 0.0594647275,
        },
      },
    ],
    items: [
      {
        def_id: 'steel_amuleto',
        equip_slot: 7,
        equipped_on: '1001',
        id: '27133',
        level: 20,
        rarity: 2,
        upgrade: 10,
      },
      {
        def_id: 'steel_anel',
        equip_slot: 2,
        equipped_on: '1004',
        id: '27134',
        level: 20,
        rarity: 2,
        upgrade: 5,
      },
      {
        def_id: 'mystery_item_zzz',
        equip_slot: 1,
        equipped_on: '1003',
        id: '99999',
        level: 10,
        rarity: 0,
        upgrade: 0,
      },
    ],
    casa: {
      active_casa: 3,
      cycle_secs: 748.421052631579,
      levels: [20, 20, 6, 0, 0],
      slots: 9,
    },
    skills: {
      totals: {
        abisso_base: 0,
        crit_chance_add: 0.5148165135,
        crit_dmg_add: 0.196153846,
        crit_dmg_mult: 1,
        dmg_static: 1.96874525101619,
        energia_add: 0.522457627,
        geo_mult: 1.1912403335401,
        keystones: [],
        luck_add: 0.0394647275,
        speed_add: 0.027186897,
        team_dmg_add: 0.652685185,
      },
    },
  };
}

describe('parseSaveFile — birth_stats reject gate (BSPW5-01)', () => {
  it('AC-04: every hero has birth_stats -> rejected is null and parsing proceeds', () => {
    const { rejected, candidates } = parseSaveFile(baseSave(), []);
    expect(rejected).toBeNull();
    expect(candidates.length).toBeGreaterThan(0);
  });

  it('AC-04 (real fixture): a birth-capable save is not rejected', () => {
    const raw = loadFixtureJson('vera-01-points-reset.json');
    const { rejected, candidates } = parseSaveFile(raw, []);
    expect(rejected).toBeNull();
    expect(candidates).toHaveLength(11);
  });

  it('AC-01/AC-03: a real pre-birth_stats export (gale-01, 16 heroes, 0 with birth) rejects', () => {
    const raw = loadFixtureJson('gale-01-points-reset.json');
    const { candidates, account, rejected, warnings } = parseSaveFile(raw, []);
    expect(candidates).toHaveLength(0);
    expect(account).toEqual({ tree: null, houseIdx: null, houseLevel: null });
    expect(rejected).not.toBeNull();
    expect(rejected!.reason).toBe('missingBirthStats');
    expect(warnings.some((w) => /re-export/i.test(w))).toBe(true);
  });

  it('AC-02: rejected.heroNames lists every hero lacking birth_stats, not just the first', () => {
    const raw = loadFixtureJson('gale-01-points-reset.json');
    const { rejected } = parseSaveFile(raw, []);
    expect(rejected!.heroNames.length).toBe(16);
  });

  it('mixed save (one of several heroes missing birth_stats) rejects the whole file (kills a some/every slip)', () => {
    const save = baseSave();
    delete (save.heroes[2] as { birth_stats?: unknown }).birth_stats;
    const { candidates, rejected } = parseSaveFile(save, []);
    expect(candidates).toHaveLength(0);
    expect(rejected).not.toBeNull();
    expect(rejected!.reason).toBe('missingBirthStats');
    expect(rejected!.heroNames).toEqual(['Weird']);
  });

  it('a partial birth_stats block (missing key) counts as missing and rejects', () => {
    const save = baseSave();
    const birth = (save.heroes[0] as { birth_stats: Record<string, number> }).birth_stats;
    delete birth.luck;
    const { rejected } = parseSaveFile(save, []);
    expect(rejected).not.toBeNull();
    expect(rejected!.heroNames).toEqual(['Cora']);
  });

  it('a non-finite birth_stats value (NaN) counts as missing and rejects', () => {
    const save = baseSave();
    (save.heroes[0] as { birth_stats: Record<string, number> }).birth_stats.dmg = NaN;
    const { rejected } = parseSaveFile(save, []);
    expect(rejected).not.toBeNull();
    expect(rejected!.heroNames).toEqual(['Cora']);
  });
});

describe('parseSaveFile', () => {
  it('rejects files without a heroes array', () => {
    const result = parseSaveFile({ foo: 'bar' }, []);
    expect(result.candidates).toHaveLength(0);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.rejected).toEqual({ reason: 'notASaveFile', heroNames: [] });
  });

  it('maps a clean hero with gear and abilities', () => {
    const save = baseSave();
    const { candidates } = parseSaveFile(save, []);
    const cora = candidates.find((c) => c.sourceId === '1001')!;
    const rawCora = asHeroFixture(save.heroes.find((h) => h.id === '1001'));
    const tree = saveTree(save);
    expect(cora.name).toBe('Cora');
    expect(cora.record.skin).toBe(0);
    expect(cora.level).toBe(47);
    expect(cora.rarity).toBe('Incomum');
    expect(cora.rank).toBe('S');
    // BSPW5-04: birth_stats/stats were derived to be self-consistent (see baseSave()'s
    // comment) — a well-formed hero imports with zero issues.
    expect(cora.issues).toHaveLength(0);
    expect(cora.pointIssues).toHaveLength(0);
    expect(cora.gearCount).toBe(1);
    expect(cora.abilityCount).toBe(2);
    expect(cora.record.abilities).toEqual({ detonacao_dupla: 10, passagem_bastao: 10 });
    expect(cora.record.loadout.amuleto).toEqual({ defId: 'steel_amuleto', rarityIdx: 2, level: 20, upgrade: 10 });
    expect(cora.record.stars).toBe(2);

    // AC-06 (ASM-02): gearedOverride is the tree-inclusive, ZERO-points sheet — composed
    // from birth, not copied from the save's `stats` (which is post-points).
    const expectedGeared = expectedGearedOverride(rawCora, cora.record.abilities, cora.record.loadout, tree);
    expect(cora.record.gearedOverride).toEqual(expectedGeared);

    // AC-05: naked equals nakedFromBirth(...) exactly.
    const expectedCoraNaked = expectedNaked(rawCora, cora.record.abilities);
    expect(cora.record.naked).toEqual(expectedCoraNaked);
    expect(cora.record.naked.energy).not.toBe(defaultNaked('Incomum', 47, undefined, 2).energy);

    // AC-07: pts is the inferred integer vector, unmodified, and non-zero — Cora spent
    // exactly 2 attack + 1 crit chance point (level 47 > stat_points_available 44).
    const expectedPtsVector = expectedPts(rawCora, cora.record.abilities, cora.record.loadout, tree);
    expect(cora.record.pts).toEqual(expectedPtsVector);
    expect(cora.record.pts).toEqual({ ...ZERO_PTS(), attack: 2, critChance: 1 });

    expect(cora.record.deployed).toBe(true);
    expect(cora.record.battleAllowed).toBe(true);
    expect(Object.keys(cora.record)).not.toContain('obsHit');
    expect(Object.keys(cora.record)).not.toContain('obsCrit');
  });

  it('defaults battleAllowed to true when battle_allowed is absent', () => {
    const { candidates } = parseSaveFile(baseSave(), []);
    const lorne = candidates.find((c) => c.sourceId === '1002')!;
    expect(lorne.record.battleAllowed).toBe(true);
  });

  it('reads battle_allowed false from save export', () => {
    const save = baseSave();
    const lorne = save.heroes.find((h) => h.id === '1002')!;
    (lorne as { battle_allowed?: boolean }).battle_allowed = false;
    const { candidates } = parseSaveFile(save, []);
    const parsed = candidates.find((c) => c.sourceId === '1002')!;
    expect(parsed.record.battleAllowed).toBe(false);
  });

  it('defaults deployed to false when in_field is absent', () => {
    const { candidates } = parseSaveFile(baseSave(), []);
    const lorne = candidates.find((c) => c.sourceId === '1002')!;
    expect(lorne.record.deployed).toBe(false);
  });

  it('keeps zero-level ability slots in the hero pool', () => {
    const { candidates } = parseSaveFile(baseSave(), []);
    const lorne = candidates.find((c) => c.sourceId === '1002')!;
    expect(lorne.record.abilities).toEqual({ marcha_acelerada: 0, olho_clinico: 10 });
    expect(lorne.gearCount).toBe(0);
  });

  it('bakes Olho Clínico\'s crit % into naked via birth composition', () => {
    const save = baseSave();
    const { candidates } = parseSaveFile(save, []);
    const lorne = candidates.find((c) => c.sourceId === '1002')!;
    const rawLorne = asHeroFixture(save.heroes.find((h) => h.id === '1002'));
    const expected = expectedNaked(rawLorne, lorne.record.abilities);
    expect(lorne.record.naked).toEqual(expected);
    // AC-03 (birth-sheet.ts): Olho's on-sheet crit % multiplies the birth roll — naked
    // crit is above the ability-free birth roll (poolFactor(sheetOther.critChance) > 1).
    const withoutOlho = nakedFromBirth(rawBirth(rawLorne), rawLorne.level, rawLorne.stars ?? 0, emptySheetOther());
    expect(lorne.record.naked.critChance).toBeGreaterThan(withoutOlho.critChance);
  });

  it('bakes Ponta Diamante\'s penetration % into naked via birth composition', () => {
    const save = baseSave();
    const { candidates } = parseSaveFile(save, []);
    const brenna = candidates.find((c) => c.sourceId === '1004')!;
    const rawBrenna = asHeroFixture(save.heroes.find((h) => h.id === '1004'));
    expect(brenna.record.abilities).toEqual({ ponta_diamante: 10 });
    expect(brenna.gearCount).toBe(1);
    const expected = expectedNaked(rawBrenna, brenna.record.abilities);
    expect(brenna.record.naked).toEqual(expected);
    // Without Ponta in sheetOther, naked penetration would be a different (lower) value —
    // the ability's on-sheet contribution is genuinely baked into naked, not dropped.
    const withoutPonta = nakedFromBirth(rawBirth(rawBrenna), rawBrenna.level, rawBrenna.stars ?? 0, emptySheetOther());
    expect(brenna.record.naked.penetration).not.toBeCloseTo(withoutPonta.penetration, 1);
    expect(brenna.record.naked.penetration).toBeGreaterThan(withoutPonta.penetration);
  });

  it('degrades gracefully for unknown ability codes and unrecognized items', () => {
    const { candidates } = parseSaveFile(baseSave(), []);
    const weird = candidates.find((c) => c.sourceId === '1003')!;
    expect(weird.record.abilities).toEqual({});
    expect(weird.gearCount).toBe(0);
    expect(weird.issues.some((i) => i.includes('unknown_ability_xyz'))).toBe(true);
    expect(weird.issues.some((i) => i.includes('mystery_item_zzz'))).toBe(true);
    // AC-26: the message names the save slot too, not just the code.
    expect(weird.issues.some((i) => i.includes('unknown_ability_xyz') && i.includes('slot 1'))).toBe(
      true,
    );
    // BSPW5-05/AC-11: the unrecognized item blocks the hero (the unknown ability alone
    // would not — see the dedicated asymmetry test below).
    expect(weird.blocked).toBe(true);
  });

  it('skips hero entries with no id and warns', () => {
    const save = baseSave();
    // BSPW5-01: the whole-file birth scan runs before the no-id skip (design.md step 2 vs
    // step 4), so a hero object entered here needs its own usable birth_stats or the whole
    // save rejects instead of exercising the no-id skip this test targets.
    save.heroes.push({
      id: '',
      name: 'Ghost',
      birth_stats: {
        dmg: 40,
        energia: 90,
        speed: 43,
        crit_chance: 0.04,
        crit_dmg: 1.5,
        penetration: 0.4,
        cooldown_reduction: 0.01,
        luck: 0.02,
      },
    } as never);
    const { candidates, warnings, rejected } = parseSaveFile(save, []);
    expect(rejected).toBeNull();
    expect(candidates).toHaveLength(4);
    expect(warnings.some((w) => w.includes('Ghost'))).toBe(true);
  });

  it('flags an unrecognized rarity index but still imports with a fallback', () => {
    const save = baseSave();
    (save.heroes[0] as { rarity: number }).rarity = 99;
    const { candidates } = parseSaveFile(save, []);
    const cora = candidates.find((c) => c.sourceId === '1001')!;
    expect(cora.rarity).toBe('Raro');
    expect(cora.issues.some((i) => i.includes('rarity'))).toBe(true);
  });

  it('matches existing heroes by sourceId for update-in-place', () => {
    const existing = [{ id: 'local-abc', name: 'Old Cora', sourceId: '1001' } as HeroRecord];
    const { candidates } = parseSaveFile(baseSave(), existing);
    const cora = candidates.find((c) => c.sourceId === '1001')!;
    expect(cora.matchedExistingId).toBe('local-abc');
    expect(cora.matchedExistingName).toBe('Old Cora');
    const lorne = candidates.find((c) => c.sourceId === '1002')!;
    expect(lorne.matchedExistingId).toBeNull();
  });

  it('maps casa (house) to a 0-indexed houseIdx/houseLevel', () => {
    const { account } = parseSaveFile(baseSave(), []);
    // active_casa: 3 (1-indexed) -> houseIdx 2, level = casa.levels[2] = 6
    expect(account.houseIdx).toBe(2);
    expect(account.houseLevel).toBe(6);
  });

  it('scales skills.totals into TreeState percentages', () => {
    const { account } = parseSaveFile(baseSave(), []);
    expect(account.tree).not.toBeNull();
    expect(account.tree!.danoTotal).toBeCloseTo(1.96874525101619, 6);
    expect(account.tree!.critChance).toBeCloseTo(51.48165135, 5);
    expect(account.tree!.critDmg).toBeCloseTo(19.6153846, 5);
    expect(account.tree!.speed).toBeCloseTo(2.7186897, 5);
    expect(account.tree!.energy).toBeCloseTo(52.2457627, 5);
    expect(account.tree!.glassCannon).toBe(false);
    expect(account.tree!.tempoDobrado).toBe(false);
    // BSPW5-03/AC-10: skills.totals.luck_add * 100 -> tree.luckFlatPct.
    expect(account.tree!.luckFlatPct).toBeCloseTo(3.94647275, 5);
  });

  it('AC-10 edge case: luck_add absent from skills.totals defaults luckFlatPct to 0', () => {
    const save = baseSave();
    delete (save.skills.totals as { luck_add?: number }).luck_add;
    const { account } = parseSaveFile(save, []);
    expect(account.tree!.luckFlatPct).toBe(0);
  });

  it('detects Glass Cannon from crit_dmg_mult', () => {
    const save = baseSave();
    save.skills.totals.crit_dmg_mult = 2;
    const { account } = parseSaveFile(save, []);
    expect(account.tree!.glassCannon).toBe(true);
  });

  it('AC-13/BSP-61: a non-empty skills.totals.keystones surfaces the unmodelled-tree finding in warnings[]', () => {
    const save = baseSave();
    (save.skills.totals.keystones as unknown[]) = ['deadly_eye'];
    const { warnings } = parseSaveFile(save, []);
    expect(warnings.some((w) => w.includes('BSP-61'))).toBe(true);
  });

  it('AC-13/DEC-08: a crit_dmg_mult other than 1 surfaces the unmodelled-tree finding in warnings[]', () => {
    const save = baseSave();
    save.skills.totals.crit_dmg_mult = 2;
    const { warnings } = parseSaveFile(save, []);
    expect(warnings.some((w) => w.includes('DEC-08'))).toBe(true);
  });

  it('empty keystones and crit_dmg_mult 1 (the every-fixture-today case) surface no unmodelled-tree finding', () => {
    const { warnings } = parseSaveFile(baseSave(), []);
    expect(warnings.some((w) => w.includes('BSP-61') || w.includes('DEC-08'))).toBe(false);
  });

  it('returns nulls for account data when casa/skills are absent', () => {
    const { account } = parseSaveFile({ heroes: [] }, []);
    expect(account).toEqual({ tree: null, houseIdx: null, houseLevel: null });
  });

  it('missing stats block still composes naked/gearedOverride from birth, but cannot infer pts', () => {
    const save = baseSave();
    const hero = save.heroes[1] as { stats?: unknown; issues?: string[] };
    delete hero.stats;
    const { candidates } = parseSaveFile(save, []);
    const lorne = candidates.find((c) => c.sourceId === '1002')!;
    const rawLorne = asHeroFixture(save.heroes.find((h) => h.id === '1002'));
    const tree = saveTree(save);
    expect(lorne.issues.some((i) => i.includes('Missing stats'))).toBe(true);
    // naked/gearedOverride are pure functions of birth_stats — no `stats` needed (ASM-02).
    expect(lorne.record.gearedOverride).toEqual(
      expectedGearedOverride(rawLorne, lorne.record.abilities, lorne.record.loadout, tree),
    );
    expect(lorne.record.naked).toEqual(expectedNaked(rawLorne, lorne.record.abilities));
    // pts cannot be inferred without an observed sheet — defaults to zero, not invented.
    expect(lorne.record.pts).toEqual(ZERO_PTS());
    expect(lorne.pointIssues).toEqual([]);
    // BSPW5-05/AC-11: missing stats blocks the hero — never a base-rolls placeholder guess.
    expect(lorne.blocked).toBe(true);
  });

  it('imports hero cosmetic skin from save', () => {
    const save = baseSave();
    (save.heroes[0] as { skin?: number }).skin = 3;
    const { candidates } = parseSaveFile(save, []);
    expect(candidates.find((c) => c.sourceId === '1001')!.record.skin).toBe(3);
  });

  it('AC-12/BSP-53: skin 5 (in range) still resolves to skin 5, no issue raised', () => {
    const save = baseSave();
    (save.heroes[0] as { skin?: number }).skin = 5;
    const { candidates } = parseSaveFile(save, []);
    const cora = candidates.find((c) => c.sourceId === '1001')!;
    expect(cora.record.skin).toBe(5);
    expect(cora.issues.some((i) => i.toLowerCase().includes('skin'))).toBe(false);
  });

  it('AC-12/DEC-05: an out-of-range skin (99) defaults to the neutral placeholder (0), not a nearest-index clamp', () => {
    const save = baseSave();
    (save.heroes[0] as { skin?: number }).skin = 99;
    const { candidates } = parseSaveFile(save, []);
    const cora = candidates.find((c) => c.sourceId === '1001')!;
    expect(cora.record.skin).toBe(0);
    expect(cora.issues.some((i) => i.includes('99'))).toBe(true);
  });

  it('a hero with no skin field at all defaults to 0 silently (no issue)', () => {
    const { candidates } = parseSaveFile(baseSave(), []);
    const cora = candidates.find((c) => c.sourceId === '1001')!;
    expect(cora.record.skin).toBe(0);
    expect(cora.issues.some((i) => i.toLowerCase().includes('skin'))).toBe(false);
  });

  it('AC-26 / BSP-33: an unknown ability at level 0 still pushes an issue naming code and slot', () => {
    const save = baseSave();
    (save.heroes[2] as { abilities?: unknown }).abilities = [
      { code: 'unknown_ability_xyz', level: 0, max: 10, slot: 1 },
    ];
    const { candidates } = parseSaveFile(save, []);
    const weird = candidates.find((c) => c.sourceId === '1003')!;
    // Previously silent — G1 in the spec's DEC-04 gap list, how slot 17/18 stayed invisible.
    expect(weird.issues.some((i) => i.includes('unknown_ability_xyz') && i.includes('slot 1'))).toBe(
      true,
    );
  });

  it('AC-26 edge case: a missing/non-numeric slot degrades gracefully — no throw', () => {
    const save = baseSave();
    (save.heroes[2] as { abilities?: unknown }).abilities = [
      { code: 'unknown_ability_xyz', level: 3 },
    ];
    expect(() => parseSaveFile(save, [])).not.toThrow();
    const { candidates } = parseSaveFile(save, []);
    const weird = candidates.find((c) => c.sourceId === '1003')!;
    const abilityIssue = weird.issues.find((i) => i.includes('unknown_ability_xyz'));
    expect(abilityIssue).toBe('Unknown ability "unknown_ability_xyz" skipped.');
    expect(abilityIssue).not.toContain('slot');
  });

  it('AC-27: the hero is still imported and the unknown ability contributes nothing', () => {
    const { candidates } = parseSaveFile(baseSave(), []);
    const weird = candidates.find((c) => c.sourceId === '1003')!;
    // "Imported" here means parseSaveFile still produces a candidate for the hero (never
    // silently dropped) — Weird happens to also be `blocked` (AC-11) via her separate
    // unrecognized-item issue, unrelated to the unknown ability this AC is about.
    expect(weird).toBeDefined();
    expect(weird.record.abilities).not.toHaveProperty('unknown_ability_xyz');
    expect(Object.keys(weird.record.abilities)).toHaveLength(0);
  });

  it('AC-11: a save with one bad item def_id yields blocked === true for that hero and false for the rest', () => {
    const { candidates } = parseSaveFile(baseSave(), []);
    const weird = candidates.find((c) => c.sourceId === '1003')!;
    expect(weird.blocked).toBe(true);
    for (const sourceId of ['1001', '1002', '1004']) {
      const other = candidates.find((c) => c.sourceId === sourceId)!;
      expect(other.blocked, `${sourceId} should not be blocked`).toBe(false);
    }
  });

  it('AC-11/AC-14: unresolvable gear blocks the hero; an unknown ability code alone does not', () => {
    const save = baseSave();
    // Cora is otherwise clean (T4's self-consistent fixture) — add ONLY an unknown
    // ability, no bad gear, to isolate the non-blocking side of the asymmetry.
    (save.heroes[0].abilities as unknown[]).push({ code: 'made_up_ability', level: 3, slot: 99 });
    const { candidates } = parseSaveFile(save, []);
    const cora = candidates.find((c) => c.sourceId === '1001')!;
    expect(cora.issues.some((i) => i.includes('made_up_ability'))).toBe(true);
    expect(cora.blocked).toBe(false);

    // Weird's unrecognized item ("mystery_item_zzz") is the blocking side.
    const weird = candidates.find((c) => c.sourceId === '1003')!;
    expect(weird.issues.some((i) => i.includes('mystery_item_zzz'))).toBe(true);
    expect(weird.blocked).toBe(true);
  });

  it('AC-09: naked.luck and gearedOverride.luck are non-zero for a hero with non-zero birth_stats.luck', () => {
    const { candidates } = parseSaveFile(baseSave(), []);
    const cora = candidates.find((c) => c.sourceId === '1001')!;
    // baseSave()'s Cora carries birth_stats.luck: 0.02 (non-zero).
    expect(cora.record.naked.luck).toBeGreaterThan(0);
    expect(cora.record.gearedOverride.luck).toBeGreaterThan(0);
  });

  it('AC-15/AC-16: a hero with a budgetMismatch is still present, pts is unmodified, and pointIssues/issues are populated', () => {
    // Weird's birth_stats/stats are deliberately inconsistent (unlike Cora/Lorne/Brenna) —
    // inferSpentPoints cannot cleanly recover an integer vector matching the budget.
    const save = baseSave();
    const { candidates } = parseSaveFile(save, []);
    const weird = candidates.find((c) => c.sourceId === '1003')!;
    const rawWeird = asHeroFixture(save.heroes.find((h) => h.id === '1003'));
    const tree = saveTree(save);

    // DEC-04: still imported, present in candidates.
    expect(weird).toBeDefined();

    // AC-16: the typed PointInferenceIssue[] reaches pointIssues structurally unflattened —
    // including a budgetMismatch entry with a saturatedStats array.
    const budgetMismatch = weird.pointIssues.find(
      (issue): issue is Extract<(typeof weird.pointIssues)[number], { kind: 'budgetMismatch' }> =>
        issue.kind === 'budgetMismatch',
    );
    expect(budgetMismatch).toBeDefined();
    expect(Array.isArray(budgetMismatch?.saturatedStats)).toBe(true);

    // DEC-04: one neutral English string also lands on issues[].
    expect(
      weird.issues.some((i) => i.includes('could not be exactly matched')),
    ).toBe(true);

    // AC-15: record.pts equals inferSpentPoints(...).pts EXACTLY — no rescale, no clamp
    // to budget, even though it disagrees with the budget.
    expect(weird.record.pts).toEqual(expectedPts(rawWeird, weird.record.abilities, weird.record.loadout, tree));
  });

  it('AC-28: a known code at level 0 pushes no issue (caca_hero @ 0, real fixture, Vera 39625)', () => {
    const raw = loadFixtureJson('bellatrix-02-pts-each-1.json');
    const { candidates } = parseSaveFile(raw, []);
    const vera = candidates.find((c) => c.sourceId === '39625')!;
    expect(vera.record.abilities.caca_hero).toBe(0);
    expect(vera.issues.some((i) => i.includes('caca_hero'))).toBe(false);
  });

  it('AC-06 / BSP-38: rank 20 and a mid-curve rank both survive parseSaveFile unclamped', () => {
    const raw = loadFixtureJson('bellatrix-02-pts-each-1.json');
    const { candidates } = parseSaveFile(raw, []);

    // Bram (18606): explosao_ampla @ 20 — no clamp to the old max: 10.
    const bram = candidates.find((c) => c.sourceId === '18606')!;
    expect(bram.record.abilities.explosao_ampla).toBe(20);

    // Vera (39625): marcha_acelerada @ 17 — mid-curve, above the old max: 10.
    const vera = candidates.find((c) => c.sourceId === '39625')!;
    expect(vera.record.abilities.marcha_acelerada).toBe(17);

    // Zane (37455): pressagio_mortal @ 19 — mid-curve, above the old max: 10.
    const zane = candidates.find((c) => c.sourceId === '37455')!;
    expect(zane.record.abilities.pressagio_mortal).toBe(19);
  });
});
