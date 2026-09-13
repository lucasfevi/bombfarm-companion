import catalog from '../data/catalog.json' with { type: 'json' };

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
  /** % — a fraction in the save (`stats.luck`), percent here (× 100). */
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
  critPct: number;
  penPct: number;
  cdrPct: number;
};

/**
 * Non-item bonuses already baked into the unequipped sheet. Today that is sheet abilities only
 * (e.g. Olho Clínico, Ponta de Diamante). Tree / Marcha / team buffs are combat-only — not in here.
 *
 * `speed` / `cdr` are **fractions of the rolled base** (wiki `final = base × (1 + Σ)`) — and
 * today nothing feeds either. `critChanceFlat`, `critDmgFlat` and `penetration` are flat addends
 * in the sheet's own units, ADDED after the star factor and held outside the pool that gear and
 * spent points scale, never multiplied against the roll. See `POINT_GAIN.critDmgFlat` and the
 * `critChanceFlat` / `penetrationPp` ability kinds for the three measurements.
 */
export type SheetOtherPct = {
  speed: number;
  /**
   * FLAT crit-chance percentage points (planner units) — an addend held OUTSIDE the shared
   * pool, unlike `speed`/`cdr`, which are pool fractions. Olho Clínico is the only source; see
   * the `critChanceFlat` ability kind for the measurement.
   */
  critChanceFlat: number;
  /** FLAT crit-damage percentage points (planner units) — an addend, not a pool fraction. */
  critDmgFlat: number;
  /**
   * FLAT penetration points — an addend outside the shared pool, the same placement as
   * `critChanceFlat`. Ponta de Diamante is the only source; it multiplied the roll until the
   * 2026-09-02 patch (see the `penetrationPp` ability kind's on-sheet note).
   */
  penetration: number;
  cdr: number;
};

export type PointAlloc = Record<keyof SheetStats, number>;

export type HeroSheetRescale = {
  naked: SheetStats;
  geared: SheetStats;
};
