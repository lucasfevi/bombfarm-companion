import catalog from '../data/catalog.json';

export type Slot = (typeof catalog.slots)[number];
export type ItemStat = (typeof catalog.itemStats)[number];
export type ItemRarityIdx = number;

/**
 * One scaled stat roll. `unit` is 'flat' for Dano at every item level (the 2026-08-15 patch
 * removed catalog v4's percentage-of-Attack regime); every other roll is a fraction of the
 * attribute it modifies.
 */
export type ScaledValor = {
  stat: ItemStat;
  valor: number;
  unit: 'flat' | 'pct';
};

export type EquippedItem = {
  defId: string;
  rarityIdx: number; // 0..5
  level: number; // 10..300 step 10
  upgrade: number; // +0…+15 forja
};

export type Loadout = Partial<Record<Slot, EquippedItem | null>>;

export type SheetStats = {
  attack: number;
  energy: number;
  speed: number;
  critChance: number;
  critDmg: number;
  penetration: number;
  cdr: number;
  /** % — AD-BSP-19a: a fraction in the save (`stats.luck`), percent here (× 100). */
  luck: number;
};

export type GearBonuses = {
  dmgFlat: number;
  /**
   * Σ of any Dano rolls expressed as a fraction of the hero's Attack. Structurally 0 since the
   * 2026-08-15 patch removed catalog v4's nv50+ regime — every Dano roll now lands in
   * `dmgFlat`. Kept as `composeAttack`/`decomposeAttack`'s multiplicative term.
   */
  dmgPct: number;
  energyPct: number;
  speedPct: number;
  luckPct: number;
  /**
   * Σ of the crit-chance rolls as **planner percentage points** (`SheetStats.critChance` units),
   * ADDED to the sheet — not a pool fraction like `speedPct`/`penPct`/`luckPct`. The catalog
   * stores these as save-side fractions, so `sumGearBonuses` converts (× 100) on the way in.
   * See `POINT_GAIN.critChanceFlat` for the measurement.
   */
  critFlatPct: number;
  penPct: number;
  /** Σ of the cooldown rolls as planner percentage points, ADDED to the sheet. See `critFlatPct`. */
  cdrFlatPct: number;
};

/**
 * Non-item bonuses already baked into the unequipped sheet. Today that is sheet abilities only
 * (e.g. Olho Clínico, Ponta de Diamante). Tree / Marcha / team buffs are combat-only — not in here.
 *
 * `speed` and `penetration` are **fractions of the rolled base** (wiki `final = base × (1 + Σ)`).
 * The three `*Flat` keys are raw planner percentage points ADDED to the sheet, never multiplied
 * against the roll — the game moved crit damage to that shape at the 2026-08-13 patch, and crit
 * chance and CDR at the 2026-08-15 one. See `POINT_GAIN.critDmgFlat` / `.critChanceFlat` /
 * `.cdrFlat` for the measurements.
 */
export type SheetOtherPct = {
  speed: number;
  /** FLAT crit-chance percentage points (planner units) — an addend, not a pool fraction. */
  critChanceFlat: number;
  /** FLAT crit-damage percentage points (planner units) — an addend, not a pool fraction. */
  critDmgFlat: number;
  penetration: number;
  /**
   * FLAT cooldown percentage points (planner units) — an addend, not a pool fraction.
   * Structurally 0 today: the game has no cooldown ability. Kept for symmetry with the other
   * two flat keys and as the forward-safe slot if one is ever added.
   */
  cdrFlat: number;
};

export type PointAlloc = Record<keyof SheetStats, number>;

export type HeroSheetRescale = {
  naked: SheetStats;
  geared: SheetStats;
};
