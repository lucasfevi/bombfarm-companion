/**
 * `baseSave()` — the inline save export the import suites parse. Four heroes, deliberately
 * different: Cora (geared, star-scaled, two abilities, a non-zero spent-point vector), Lorne
 * (naked, one on-sheet ability, zero points), Brenna (one item, one on-sheet ability, zero
 * points) and Weird (unknown ability, unrecognized item, stats that do NOT invert — the
 * red-state hero AC-15/AC-16 need).
 *
 * The first three carry a self-consistency claim: their `stats` block is what
 * `composeSheetFromBirth` produces from their own birth/level/stars/items/tree at the stated
 * point vector. `import-save-fixture-consistency.test.ts` asserts that claim forward, against
 * the authored numbers — it lived unasserted long enough for two of the three to drift.
 * Recompute rather than hand-edit when the model moves, and let that suite confirm it.
 */
export function baseSave() {
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
        // (stat_points_available 11 == level -> budget 0), same derivation as Cora above,
        // and now asserted forward by `the fixture reproduces its own authored stats` below.
        //
        // Recomputed 2026-08-28: this block had drifted through two patches while nothing
        // asserted it. `crit_chance` moves 0.06359266054 -> 0.26059266054 for the 2026-08-23
        // change that made Olho Clinico flat crit POINTS instead of a share of the roll (Lorne
        // owns it at 10/10), and `crit_dmg` 1.598076923 -> 1.696153846 because the block still
        // carried HALF the account tree's `crit_dmg_add` (0.196153846). The drift imported as
        // four PointInferenceIssues on a hero the comment calls clean.
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
          crit_chance: 0.26059266053999997,
          crit_dmg: 1.696153846,
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
        // (stat_points_available 30 == level -> budget 0), same derivation as Cora above,
        // and now asserted forward by `the fixture reproduces its own authored stats` below.
        //
        // Recomputed 2026-08-28: the worst-drifted of the three. `dmg` was 449.2676662818946
        // against a composed 297.67428195364795 — 51% high, from a `dmg_static` tree rescale
        // this block never picked up — and `crit_chance`, `crit_dmg`, `penetration` and
        // `cooldown_reduction` had each drifted with the `gold_anel` catalog rescale and the
        // same half-`crit_dmg_add` error as Lorne. The inversion recovered 23 points against a
        // budget of 0, so the importer BLOCKED her, which is why `AC-11` below had been
        // skipped: it asserts Brenna is not blocked.
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
          dmg: 297.67428195364795,
          energia: 182.69491524,
          speed: 45.196223468,
          crit_chance: 0.0689782120875,
          crit_dmg: 1.696153846,
          penetration: 6.8351999999999995,
          cooldown_reduction: 0.015393443820000002,
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
