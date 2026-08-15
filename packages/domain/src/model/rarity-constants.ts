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

// Per-point increments (2026-07-25 rebalance — wiki `herois.ponto_inc`):
// Ataque +10 native × levelPowerMult(level) · Energia +8 native · Velocidade / Sorte /
// Crit chance / Pen / CDR add a bonus that is a percentage OF THE BASE ROLL
// (+2% / +3% / +2% / +2% / +10%).
// Sorte (Luck): BSP-46 — measured against the Wave 0 fixtures at ≤8e-16 residual,
// ★0 gear-free (vera-02-pts-luck-1.json) and confirmed exactly at ★1 with gear
// (bellatrix-02-pts-each-1.json). +3% of the hero's birth roll, × starsMult.
//
// Crit dmg is the ONE exception: it is **flat**, not a percentage of the roll
// (`critDmgFlat`, below).
export const POINT_GAIN = {
  attackNative: 10,
  energyNative: 8,
  speedPctOfBase: 0.02,
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
   */
  critDmgFlat: 5,
  penetrationPctOfBase: 0.02,
  cdrPctOfBase: 0.1,
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
