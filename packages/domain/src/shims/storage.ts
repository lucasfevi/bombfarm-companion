/** Domain-facing storage shapes (formerly `@/shared/lib/storage` types). */
import type { Loadout, SheetStats } from '../gear/types.js';
import type { RankMode, RarityKey } from '../model/index.js';

export type { RankMode };

export type TreeState = {
  danoTotal: number;
  critChance: number;
  critDmg: number;
  speed: number;
  energy: number;
  teamCoinPct: number;
  glassCannon: boolean;
  tempoDobrado: boolean;
  /** Abisso (D15) — cancels tree Crit/GEO sheet adds and Glass Cannon crit ×2; energy ×0.5 still applies. */
  abisso?: boolean;
  luckFlatPct?: number;
};

export type HeroContext = {
  houseIdx: number;
  houseLevel: number;
  phase: number | null;
  mitigationPct: number;
  rankMode: RankMode;
  targetProp: string | null;
  cycleModel?: 'serial' | 'wiki';
  walkDelay?: number;
  extraDmgPct?: number;
};

export type AccountShared = {
  tree: TreeState;
  teamBuffs: Record<string, number>;
  context: HeroContext;
  slots?: number;
  forgeFloor?: number;
};

export type HeroRecord = {
  id: string;
  name: string;
  updatedAt: number;
  rarity: RarityKey;
  level: number;
  stars: number;
  naked: SheetStats;
  loadout: Loadout;
  altLoadout: Loadout | null;
  gearedOverride: SheetStats;
  abilities: Record<string, number>;
  pts: Record<keyof SheetStats, number>;
  sourceId?: string;
  rank?: string;
  power?: number;
  deployed?: boolean;
  battleAllowed?: boolean;
  skin?: number;
  birth?: SheetStats;
  tree?: TreeState;
  teamBuffs?: Record<string, number>;
  context?: HeroContext;
};
