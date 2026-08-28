export type RarityKey =
  | 'Comum'
  | 'Incomum'
  | 'Raro'
  | 'Épico'
  | 'Lendária'
  | 'Mítico';

export interface BaseRoll {
  attack: number;
  energy: number;
  speed: number;
  luck: number; // %
  critChance: number; // %
  critDmg: number; // +% over normal hit
  penetration: number; // %
  cdr: number; // %
}

/**
 * Midpoints of the wiki roll ranges per rarity (`herois.roll_stats[].faixas`).
 *
 * ATTACK and ENERGY resynced at the 2026-08-23 patch. The patch note raises Attack for the top
 * three tiers only ("Épico 300–400, Lendário 500–600 e Mítico 1000–1200"), but the wiki's table
 * also disagreed with the values this file had carried since the repo's first commit for Raro
 * attack and for five of the six energy tiers — drift from some earlier patch that was never
 * picked up here. A live save settles it independently of the wiki: an account's exported
 * `heroes[].stat_ranges` publishes each hero's own tier bounds, and on the 2026-08-23 capture
 * they read `dmg 150–200` / `energia 140–240` for a Raro, `dmg 65–110` / `energia 120–160` for
 * an Incomum and `dmg 40–70` / `energia 80–120` for a Comum — the wiki's numbers, not this
 * table's former ones. Every other stat below already matched and is unchanged.
 *
 * These are rarity AVERAGES, used only where a hero's own roll is unavailable: `defaultNaked`
 * (hand-built heroes with no `birth`) and `critMilestones`' fallback. Every birth-backed path
 * reads the hero's actual roll and never touches this table.
 */
export const BASE_ROLLS: Record<RarityKey, BaseRoll> = {
  Comum: { attack: 55, energy: 100, speed: 48, luck: 2.5, critChance: 5, critDmg: 50, penetration: 0.75, cdr: 1 },
  Incomum: { attack: 87.5, energy: 140, speed: 49.25, luck: 4, critChance: 6, critDmg: 57.5, penetration: 1.5, cdr: 1.75 },
  Raro: { attack: 175, energy: 190, speed: 51, luck: 6, critChance: 7, critDmg: 65, penetration: 2.5, cdr: 2.5 },
  Épico: { attack: 350, energy: 285, speed: 53.25, luck: 8.5, critChance: 8.5, critDmg: 75, penetration: 4, cdr: 4 },
  Lendária: { attack: 550, energy: 475, speed: 54.5, luck: 10.5, critChance: 9.25, critDmg: 81.5, penetration: 5, cdr: 5 },
  Mítico: { attack: 1100, energy: 750, speed: 55.75, luck: 12.5, critChance: 10, critDmg: 90, penetration: 6, cdr: 6 },
};

// Per-point increments (wiki `herois.ponto_inc`):
// Ataque +10 native × levelPowerMult(level) · Energia +8 native · Velocidade / Sorte /
// Crit chance / Pen / CDR add a bonus that is a percentage OF THE BASE ROLL
// (+2% / +3% / +2% / +2% / +2%).
// Sorte (Luck): measured against the Wave 0 fixtures at ≤8e-16 residual,
// ★0 gear-free (vera-02-pts-luck-1.json) and confirmed exactly at ★1 with gear
// (bellatrix-02-pts-each-1.json). +3% of the hero's birth roll, × starsMult.
//
// Crit dmg is the ONE exception: it is **flat**, not a percentage of the roll
// (`critDmgFlat`, below).
//
// REVERTED at the 2026-08-18 patch: crit chance and CDR went flat for exactly three days
// (2026-08-15 → 2026-08-18, commit 0418a82 / PR #102) and the 2026-08-18 patch put both back
// to percent-of-base. The 2026-08-23 patch did NOT move them again — it restated the two
// crit-chance ABILITIES in flat points (see the `critChanceFlat` ability kind) and left
// `herois.ponto_inc`'s crit-chance and cooldown entries at 0.02 apiece, so the two POINTS below
// are unchanged. Measured on account 486 across a 12-hero export (2026-08-18 23:20) and a
// deliberate respec (2026-08-19 01:10): Sora (L10, ★0, no items, no crit/cooldown ability)
// moved her crit multiplier 1.0309330166 → 1.1309330166 and her cooldown multiplier
// 1.0000000000 → 1.1000000000 on a 5/5 respec — +0.1 on each for 5 points, no base-roll and no
// level scaling. See the two constants below for how that single respec pins BOTH rates
// separately, and why they land on different sides of their pre-2026-08-15 values.
export const POINT_GAIN = {
  attackNative: 10,
  energyNative: 8,
  speedPctOfBase: 0.02,
  /**
   * 0.02 per point, ROUND-TRIPPED: this is the same value the repo carried before the
   * 2026-08-15 patch. Two independent sources agree: measured on Sora's 2026-08-19 respec (see
   * below), and separately, the wiki mirror's (held out of band, not in this repo) `ponto_inc`
   * table publishes Chance de Crítico's per-point entry at exactly 0.02.
   *
   * The respec measurement, spelled out: on Sora's 2026-08-19 respec every OTHER stat (attack,
   * energy, speed, luck, penetration, crit damage) solves to exactly zero spent points, so her
   * 10 moved points are provably all crit chance + cooldown, and both observed deltas are
   * exactly `birth × 0.1`. Her before-state is zero points in BOTH stats, so the before equation
   * alone permits any integer split from (1,9) to (9,1) of `n_crit × r_crit = 0.1`,
   * `n_cdr × r_cdr = 0.1`, `n_crit + n_cdr = 10` — the respec by itself cannot exclude any of
   * them. Fixing `r_crit = 0.02` from the wiki table forces `n_crit = 5`, hence `n_cdr = 5` and,
   * from the same respec, `r_cdr = 0.02` — see {@link POINT_GAIN.cdrPctOfBase}. The wiki table
   * independently lists `r_cdr = 0.02` too, so this is not a one-way anchor: both rates are
   * confirmed by both sources.
   *
   * What would settle either rate from a capture alone, with no external table needed: a single
   * future respec or level-up that puts a point into ONLY crit chance or ONLY cooldown gives
   * `Δ = birth × rate` directly.
   */
  critChancePctOfBase: 0.02,
  /**
   * FLAT +5 crit-damage percentage points per point — planner units, i.e. the same units as
   * `SheetStats.critDmg` (`(save crit_dmg − 1) × 100`), so one point moves the save's
   * `crit_dmg` multiplier by exactly `+0.05`.
   *
   * NOT a percentage of the hero's roll (it was modelled as `critDmgPctOfBase: 0.08` until
   * this was measured, which is why Bellatrix L42 carried a standing `nonIntegerPoints`
   * ambiguity). Two heroes with DIFFERENT crit-damage rolls, each holding exactly 2 crit-damage
   * points (pinned by their point budgets — every other stat solves to an exact integer, and
   * `level − stat_points_available` leaves exactly 2), move their sheets by the SAME amount:
   *
   * | Hero | roll (planner) | observed sheet Δ | Δ if 8% of roll |
   * | --- | --- | --- | --- |
   * | Bellatrix L42 (`sheet-math/save-20260813-5heroes.json`) | 66.252971472748 | **10.0** | 10.6005 |
   * | Fenn L49 (account 11882 capture, 2026-08-15) | 67.127583786901 | **10.0** | 10.7404 |
   *
   * Same Δ off different rolls ⇒ flat, and `10 / 2 = 5`. A percentage of the roll would have
   * had to produce two different deltas; it does not.
   *
   * Applied with NO star factor anywhere in this pipeline — unlike the flat *ability* addend
   * (`sheetOther.critDmgFlat`, see `nakedFromBirth` / `rescaleNakedForStars` in
   * `birth-sheet.ts` / `gear/naked-rescale.ts`), whose "unobserved, not star-scaled is the
   * conservative reading" note does NOT cover this constant. The only committed corpus hero
   * holding crit-damage points (Bellatrix L42, `tests/fixtures/sheet-math/save-20260813-5heroes.json`)
   * is ★0, so this point's own star behaviour is equally UNOBSERVED. Under the old
   * `critDmgPctOfBase: 0.08` model the per-point gain was `0.08 × naked.critDmg`, which
   * star-scaled implicitly because it read the (already star-scaled) roll; the flat constant
   * here does not. If the game does star-scale this point and this model does not,
   * `inferSpentPoints` would over-recover points on a ★>0 hero holding crit-damage points, and
   * `reoptBudget` (`points-reopt-core.ts`) is now clamped to `level` no matter what, but that
   * clamp is a backstop, not a fix — the bad vector would still be silently truncated rather
   * than surfaced. `tests/points-within-level-budget.test.ts`
   * is the guard that would go red first if a future ★>0 capture proves this wrong.
   */
  critDmgFlat: 5,
  penetrationPctOfBase: 0.02,
  /**
   * 0.02 per point. This is the stat where the SHAPE reverted at the 2026-08-18 patch but the
   * MAGNITUDE did not: pre-2026-08-15 this repo carried `cdrPctOfBase: 0.1`, and the value that
   * came back is HALF that, not a full round-trip — worth flagging plainly, because the crit
   * chance rate above DID round-trip to its old value and the asymmetry reads like a typo if
   * you are not looking for it.
   *
   * Confirmed by the same two independent sources as crit chance: measured on Sora's 2026-08-19
   * respec (10 points split provably between crit chance and cooldown only, `n_crit × r_crit =
   * 0.1`, `n_cdr × r_cdr = 0.1`, `n_crit + n_cdr = 10` — see
   * {@link POINT_GAIN.critChancePctOfBase} for the full derivation), and separately, the wiki
   * mirror's (held out of band, not in this repo) `ponto_inc` table publishes Red. de Cooldown's
   * per-point entry at exactly 0.02 too. 0.1 is arithmetically impossible on the respec capture
   * regardless of the table: at `r_cdr = 0.1` the observed +0.1 cooldown delta would need only 1
   * point, leaving 4 of Sora's 10 respec points unexplained. Do not restore 0.1.
   *
   * CDR is still the thinnest-evidenced of the pooled stats otherwise: the game has **no
   * cooldown ability and no cooldown tree node**, so gear and points are its only non-birth
   * sources.
   */
  cdrPctOfBase: 0.02,
  luckPctOfBase: 0.03,
} as const;

/** Hard caps on effective combat stats (2026-07-25 balance). */
export const STAT_CAPS = {
  critChance: 100,
  /**
   * BSPW4-09: `penetration` is a **mitigation threshold**, not a sheet clamp — the
   * game does NOT cap sheet penetration at 100. Bellatrix's real sheet pen is
   * `141.22613536827` (`save-20260801-crit-dmg-tree.json`) and the export reports it raw; every
   * stage of the pipeline (`composeSheetFromBirth`, `peelSheetSources`, `applyGear`,
   * `applyPoints`, `reverseSheet`, `derive`'s `adjusted`/`effective`) carries it unclamped.
   * `clampPenPct` (`model/combat.ts`) is the ONLY place this value legitimately clamps
   * penetration, because mitigation genuinely bypasses fully at 100% — a damage-path concern,
   * not a sheet concern. `points-rank.ts`'s `statCap` is this constant's only **non-damage**
   * consumer: it scores further pen points at 0 once mitigation is already fully bypassed
   * (spending more is real, it just buys no additional mitigation-bypass), which is a ranking
   * decision, not a second sheet clamp.
   */
  penetration: 100,
  cdr: 80,
} as const;
