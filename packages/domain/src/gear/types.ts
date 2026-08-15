import catalog from '../data/catalog.json';

export type Slot = (typeof catalog.slots)[number];
export type ItemStat = (typeof catalog.itemStats)[number];
export type ItemRarityIdx = number;

/**
 * One scaled stat roll. `unit` is 'flat' only for Dano below the catalog's
 * `dmgPctMinLevel`; every other roll (including Dano at or above it) is a
 * fraction of the attribute it modifies.
 */
export type ScaledValor = {
  stat: ItemStat;
  valor: number;
  unit: 'flat' | 'pct';
};

export type EquippedItem = {
  defId: string;
  rarityIdx: number; // 0..5
  level: number; // 10..90 step 10
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
   * Σ of the Dano rolls carried by items at or above `catalog.dmgPctMinLevel`,
   * as a fraction of the hero's Attack (catalog v4 — see {@link composeAttack}).
   * Items below that level contribute to `dmgFlat` instead; no item feeds both.
   */
  dmgPct: number;
  energyPct: number;
  speedPct: number;
  luckPct: number;
  critPct: number;
  penPct: number;
  cdrPct: number;
};

/**
 * Non-item bonuses already baked into the unequipped sheet. Today that is sheet abilities only
 * (e.g. Olho Clínico, Ponta de Diamante). Tree / Marcha / team buffs are combat-only — not in here.
 *
 * `speed` / `critChance` / `penetration` / `cdr` are **fractions of the rolled base**
 * (wiki `final = base × (1 + Σ)`). `critDmgFlat` is the one exception and is named for it:
 * crit damage is flat-additive in this game, so it carries raw planner percentage points
 * (`SheetStats.critDmg` units) that are ADDED to the sheet, never multiplied against the roll.
 * See `POINT_GAIN.critDmgFlat` for the measurement that settled it.
 */
export type SheetOtherPct = {
  speed: number;
  critChance: number;
  /** FLAT crit-damage percentage points (planner units) — an addend, not a pool fraction. */
  critDmgFlat: number;
  penetration: number;
  cdr: number;
};

export type PointAlloc = Record<keyof SheetStats, number>;

export type HeroSheetRescale = {
  naked: SheetStats;
  geared: SheetStats;
};
