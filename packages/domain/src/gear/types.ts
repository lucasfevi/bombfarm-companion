import catalog from '@/shared/domain/data/catalog.json';

export type Slot = (typeof catalog.slots)[number];
export type ItemStat = (typeof catalog.itemStats)[number];
export type ItemRarityIdx = number;

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
  energyPct: number;
  speedPct: number;
  luckPct: number;
  critPct: number;
  penPct: number;
  cdrPct: number;
};

/**
 * Non-item % bonuses already baked into the unequipped sheet, as fractions of the
 * rolled base (wiki `final = base × (1 + Σ)`). Today that is sheet abilities only
 * (e.g. Olho Clínico, Ponta de Diamante). Tree / Marcha / team buffs are combat-only — not in here.
 */
export type SheetOtherPct = {
  speed: number;
  critChance: number;
  critDmg: number;
  penetration: number;
  cdr: number;
};

export type PointAlloc = Record<keyof SheetStats, number>;

export type HeroSheetRescale = {
  naked: SheetStats;
  geared: SheetStats;
};
