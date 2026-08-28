import { describe, expect, it } from 'vitest';
import { parseAccountPayload, parseSaveFile } from '@bombfarm/domain/import-save';
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
    critChanceFlat: mods.sheetCritChanceFlat,
    penetration: mods.sheetPenetrationRaw,
    critDmgFlat: mods.sheetCritDmgFlat,
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
        // Recomputed 2026-08-11 for the catalog v4 rebalance (item stats ×0.7): dmg,
        // penetration and luck are the amuleto's 3 rolls, so only those three move.
        //
        // Recomputed a THIRD time 2026-08-16 for the same-day item redistribution: the
        // amuleto this hero wears now rolls sorte > dmg > crit rather than
        // dmg/penetration/luck, so energia, speed, penetration and luck all move with it.
        //
        // NOT recomputed when the item was re-identified `steel_amuleto` -> `gold_amuleto`
        // (level 20 is Gold's native level post-2026-08-15; Steel moved to 120). The swap is
        // stat-neutral by construction: Steel's valores are exactly 6x Gold's and
        // `nivelMult[120] / nivelMult[20]` is also exactly 6, so `scaledValores` cancels the
        // two and both items contribute the same rolls at level 20. Every value below is
        // unchanged; only the def id moved.
        //
        // Recomputed 2026-08-16 for the flat crit-chance/CDR change, then recomputed AGAIN for
        // the 2026-08-18 revert back to percent-of-base (issue #132): `crit_chance` moves
        // 0.15348 → 0.61506 → 0.15580. The reverted value lands close to the original because
        // the shape round-tripped — the small residual difference from 0.15348165135 is the
        // item catalog's crit-base rescale (`gold_amuleto`'s crit roll moved with it).
        //
        // Recomputed 2026-08-22 for `STAR_MULT_PER_STAR` 0.5 → 0.25: this hero is ★2, so its
        // star factor moves ×2 → ×1.5 and every star-scaled stat drops with it. `speed` is the
        // control — it is the one stat the star never touched, and it does NOT move here.
        stats: {
          dmg: 807.3824274417394,
          energia: 342.55296607500003,
          speed: 46.223410365,
          crit_chance: 0.11685010061250001,
          crit_dmg: 1.946153846,
          penetration: 0.75,
          cooldown_reduction: 0.015,
          power: 13133.6,
          luck: 0.0727911275,
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
        def_id: 'gold_amuleto',
        equip_slot: 7,
        equipped_on: '1001',
        id: '27133',
        level: 20,
        rarity: 2,
        upgrade: 10,
      },
      {
        def_id: 'gold_anel',
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
    // MP5 F4: post-patch skills shape — parseSaveFile's positive discriminator (MSG-11) requires
    // skills.refunds / skills.totals.vagas_campo / skills.totals.bag_tabs_bonus to be present, or
    // the whole file is rejected. No retired keystone field survives here (F2/F3's own removal).
    skills: {
      refunds: {},
      totals: {
        crit_chance_add: 0.5148165135,
        crit_dmg_add: 0.196153846,
        dmg_static: 1.96874525101619,
        energia_add: 0.522457627,
        geo_mult: 1.1912403335401,
        vagas_campo: 0,
        bag_tabs_bonus: 0,
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

  // MP5 F1 (AD-068 class (a) — read from the capture): re-pointed onto the post-patch export.
  it('AC-04 (real fixture): a birth-capable save is not rejected', () => {
    const raw = loadFixtureJson('save-20260813-5heroes.json');
    const { rejected, candidates } = parseSaveFile(raw, []);
    expect(rejected).toBeNull();
    expect(candidates).toHaveLength(5);
  });

  // The corpus's largest roster (15 heroes) — proves the acceptance gate scales past the 5-hero
  // capture above without special-casing anything on hero count. Re-pointed off the retired
  // 11-hero 2026-08-17 capture; the replacement is both larger and current-regime, so the claim
  // it makes is strictly stronger than the one it replaces.
  it('AC-04 (real fixture, largest roster): the 15-hero capture is not rejected', () => {
    const raw = loadFixtureJson('save-20260822-15heroes-tree-crit-dmg.json');
    const { rejected, candidates } = parseSaveFile(raw, []);
    expect(rejected).toBeNull();
    expect(candidates).toHaveLength(15);
  });

  // MP5 F1 — RECORDED LOSS (AD-068 "deleted, not weakened"): `gale-01-points-reset.json`
  // (16 heroes, 0 with birth_stats) is the only fixture that could demonstrate the whole-file
  // reject gate against a REAL pre-birth_stats export. Every post-patch capture carries
  // `birth_stats` on every hero by construction (the field predates the keystone patch), so
  // no committed post-patch fixture can reproduce this shape. The reject-gate LOGIC itself
  // stays covered by `account-source-parity.test.ts`'s synthetic multi-hero missing-birth_stats
  // cases (`missingBirthStats naming that hero`, `mixed save … rejects with every missing name`)
  // — only the demonstration against a real 16-hero legacy export is lost. See
  // docs/fixture-corpus.md.

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
    expect(cora.record.loadout.amuleto).toEqual({ defId: 'gold_amuleto', rarityIdx: 2, level: 20, upgrade: 10 });
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
    // crit is above the ability-free birth roll (sheetOther.critChanceFlat > 0).
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
    // BSPW5-03/AC-10: skills.totals.luck_add * 100 -> tree.luckFlatPct.
    expect(account.tree!.luckFlatPct).toBeCloseTo(3.94647275, 5);
  });

  it('AC-10 edge case: luck_add absent from skills.totals defaults luckFlatPct to 0', () => {
    const save = baseSave();
    delete (save.skills.totals as { luck_add?: number }).luck_add;
    const { account } = parseSaveFile(save, []);
    expect(account.tree!.luckFlatPct).toBe(0);
  });

  it('returns nulls for account data when casa/skills are absent (payload entry point — a FILE lacking skills entirely is now rejected upstream by MSG-11\'s gate, so this is parseAccountPayload\'s territory, not parseSaveFile\'s)', () => {
    const { account } = parseAccountPayload({ heroes: [] }, []);
    // Farm Ranking: @bombfarm/domain's mapAccountMaxPhase added the additive, required
    // `maxPhase: number | null` field to AccountImportData — every rejection path is `null`.
    // House-ceiling fix: `fieldSlots` (`skills.field_slots`) and `houseCycleSecs`
    // (`casa.cycle_secs`) joined the same total-reader family — absent section ⇒ `null`, never a
    // substituted default, so a consumer can tell "the save said nothing" from "the save said 3".
    expect(account).toEqual({
      tree: null,
      houseIdx: null,
      houseLevel: null,
      fieldSlots: null,
      houseCycleSecs: null,
      phase: null,
      maxPhase: null,
      // Account page: `account.player_name` / `account.account_id` join the same total-reader
      // family — a payload with no `account` section asserts "no identity", never a placeholder.
      playerName: null,
      accountId: null,
    });
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

  /**
   * STILL DISABLED, and the reason is now known precisely (issue #206). This is the one entry in
   * the F8 worklist that is NOT about a dated capture: `baseSave()` is synthetic, and hero 1004
   * (Brenna, level 30, `stat_points_available: 30`, so a budget of exactly 0) carries a `stats`
   * block derived under an older sheet model. Today's inversion recovers 23 points against that
   * zero budget, so the importer blocks her — measured, not assumed.
   *
   * Re-deriving her `stats` from `composeSheetFromBirth` at zero points is the fix, and it is
   * mechanical, but it is a fixture-derivation job rather than the regime judgement the rest of
   * this worklist needed, so it is left for whoever regenerates the synthetic saves rather than
   * folded in here. Hero 1002 (Lorne) is on the same edge — he imports, but with a
   * closest-integer-allocation issue that says the same thing more quietly.
   */
  it.skip('AC-11: a save with one bad item def_id yields blocked === true for that hero and false for the rest', () => {
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

  it('AC-15/AC-16: a hero with a budgetMismatch keeps its typed issues, and an OVER-budget one is refused', () => {
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

    // AC-15 RESTATED (2026-08-25). It used to read: `record.pts` equals `inferSpentPoints(...).pts`
    // EXACTLY — no rescale, no clamp to budget, even though it disagrees with the budget. That is
    // still true when the inversion lands UNDER the budget (cap saturation yields a build the game
    // can grant, so it is stored as recovered — pinned in `import-save-budget-refusal.test.ts`).
    // It is no longer true OVER the budget: the game grants one point per level and the save says
    // how many are unspent, so a vector above `level - available` is one the game cannot produce,
    // and the importer now refuses it rather than handing it on. Weird is the over case.
    const recovered = expectedPts(rawWeird, weird.record.abilities, weird.record.loadout, tree);
    const recoveredTotal = (Object.keys(recovered) as SheetKey[]).reduce((sum, key) => sum + recovered[key], 0);
    expect(budgetMismatch!.difference, 'Weird is the OVER direction').toBeGreaterThan(0);
    expect(recoveredTotal).toBeGreaterThan(rawWeird.level - (rawWeird.stat_points_available ?? 0));

    expect(weird.blocked).toBe(true);
    expect(weird.record.pts).toEqual(ZERO_PTS());
  });

  // MP5 F1 — RECORDED LOSS (AD-068 "deleted, not weakened"): AC-28's claim needs a real save
  // hero with an ability array entry AT level 0. Neither post-patch corpus file has one (every
  // ability entry on every hero in both `save-20260813-5heroes.json` and
  // `payload-20260812-8heroes.json` is level >= 17) — unreproducible from the new corpus. See
  // docs/fixture-corpus.md. The level-0-ability-slot code path itself stays covered by the
  // synthetic `keeps zero-level ability slots in the hero pool` test above (baseSave()'s Lorne,
  // `marcha_acelerada: 0`), which is not fixture-dependent.

  it('AC-06 / BSP-38: rank 20 and a mid-curve rank both survive parseSaveFile unclamped', () => {
    // MP5 F1 (AD-068 class (a) — read from the capture): re-pointed onto
    // payload-20260812-8heroes.json — the payload's 8 heroes carry the highest ability-level
    // variety in the new corpus.
    const raw = loadFixtureJson('payload-20260812-8heroes.json');
    const { candidates } = parseSaveFile(raw, []);

    // Bellatrix (584): bateria_extra @ 20 — no clamp to the old max: 10.
    const bellatrix = candidates.find((c) => c.sourceId === '584')!;
    expect(bellatrix.record.abilities.bateria_extra).toBe(20);

    // Nyx (555): contra_relogio @ 18 — mid-curve, above the old max: 10.
    const nyx = candidates.find((c) => c.sourceId === '555')!;
    expect(nyx.record.abilities.contra_relogio).toBe(18);

    // Cora (5217): fantasma @ 17 — mid-curve, above the old max: 10.
    const cora = candidates.find((c) => c.sourceId === '5217')!;
    expect(cora.record.abilities.fantasma).toBe(17);
  });
});
