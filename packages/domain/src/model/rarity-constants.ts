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

// Midpoints of the wiki roll ranges per rarity.
export const BASE_ROLLS: Record<RarityKey, BaseRoll> = {
  Comum: { attack: 55, energy: 100, speed: 48, luck: 2.5, critChance: 5, critDmg: 50, penetration: 0.75, cdr: 1 },
  Incomum: { attack: 87.5, energy: 170, speed: 49.25, luck: 4, critChance: 6, critDmg: 57.5, penetration: 1.5, cdr: 1.75 },
  Raro: { attack: 125, energy: 270, speed: 51, luck: 6, critChance: 7, critDmg: 65, penetration: 2.5, cdr: 2.5 },
  Épico: { attack: 165, energy: 425, speed: 53.25, luck: 8.5, critChance: 8.5, critDmg: 75, penetration: 4, cdr: 4 },
  Lendária: { attack: 202.5, energy: 665, speed: 54.5, luck: 10.5, critChance: 9.25, critDmg: 81.5, penetration: 5, cdr: 5 },
  Mítico: { attack: 240, energy: 1025, speed: 55.75, luck: 12.5, critChance: 10, critDmg: 90, penetration: 6, cdr: 6 },
};

// Per-point increments (wiki `herois.ponto_inc`):
// Ataque +10 native × levelPowerMult(level) · Energia +8 native · Velocidade / Sorte / Pen add
// a bonus that is a percentage OF THE BASE ROLL (+2% / +3% / +2%).
// Sorte (Luck): BSP-46 — measured against the Wave 0 fixtures at ≤8e-16 residual,
// ★0 gear-free (vera-02-pts-luck-1.json) and confirmed exactly at ★1 with gear
// (bellatrix-02-pts-each-1.json). +3% of the hero's birth roll, × starsMult.
//
// Crit chance, crit dmg and CDR are the exceptions: all three are **flat**, not percentages of
// the roll (`critChanceFlat` / `critDmgFlat` / `cdrFlat`, below). Crit damage went flat at the
// 2026-08-13 patch; crit chance and CDR followed at the 2026-08-15 one.
export const POINT_GAIN = {
  attackNative: 10,
  energyNative: 8,
  speedPctOfBase: 0.02,
  /**
   * FLAT +0.024394 crit-chance percentage points per point — planner units, i.e. the same units
   * as `SheetStats.critChance` (`save crit_chance × 100`), so one point moves the save's
   * `crit_chance` fraction by exactly the wiki's `herois.ponto_inc` entry, `0.00024394`.
   *
   * Measured on a deliberate respec (`respec-cdr-cc.json`, account 486, 2026-08-16): Torin L4,
   * ★0, Comum, **no items at all**, moved from `crit_chance` 0.0565165826278963 to
   * 0.0570044626278963 on exactly 2 points — Δ 0.00048788, i.e. `2 × 0.00024394`, residual
   * **3.0e-18**. The same delta read as a percentage of his 0.0527272881 roll would have been
   * 0.0000257; it is not. The account's tree total is byte-identical across the pair and he
   * carries no crit ability, so nothing else could account for the move.
   *
   * NO base-roll scaling and NO level scaling — the raw `ponto_inc` value, converted to planner
   * units. Star behaviour is UNOBSERVED (every hero on the capture account is ★0); the flat term
   * is not star-scaled here, the same conservative reading `critDmgFlat` documents.
   */
  critChanceFlat: 0.024394,
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
   * `reoptBudget` — deliberately un-clamped to `level`, see `points-reopt-core.ts` — would
   * amplify that bad vector rather than contain it. `tests/points-within-level-budget.test.ts`
   * is the guard that would go red first if a future ★>0 capture proves this wrong.
   */
  critDmgFlat: 5,
  penetrationPctOfBase: 0.02,
  /**
   * FLAT +0.03513 cooldown-reduction percentage points per point — planner units
   * (`save cooldown_reduction × 100`), i.e. the wiki's `herois.ponto_inc` entry `0.0003513`.
   *
   * Measured on the same respec pair as {@link POINT_GAIN.critChanceFlat}: Torin L4, no items,
   * `cooldown_reduction` 0.00209084545389146 → 0.00279344545389146 on exactly 2 points —
   * Δ 0.0007026, i.e. `2 × 0.0003513`, residual **−1.1e-19**. Read as 10% of his roll it would
   * have been 0.000418; it is not.
   *
   * CDR is the thinnest-evidenced of the three flat stats: the game has **no cooldown ability
   * and no cooldown tree node**, so gear and points are its only non-birth sources, and the item
   * term rests on a single observation (Minato's `gold_elmo`, one roll, exact).
   */
  cdrFlat: 0.03513,
  luckPctOfBase: 0.03,
} as const;

/** Hard caps on effective combat stats (2026-07-25 balance). */
export const STAT_CAPS = {
  critChance: 100,
  /**
   * BSPW4-09 (BSP-60): `penetration` is a **mitigation threshold**, not a sheet clamp — the
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
