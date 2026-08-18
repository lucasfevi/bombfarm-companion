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
  luckFlatPct?: number;
  /**
   * `skills.totals.xp_mult` verbatim (not a percentage) — scales XP per prop the same way
   * `teamCoinPct` scales gold per prop. Optional, same precedent as `luckFlatPct`: every read
   * site defaults absence/non-finite to `1` (NOT `0` — a `?? 0` here would silently zero every
   * XP figure).
   */
  xpMult?: number;
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
  /**
   * HOUSE RECOVERY slots (`casa.slots`) — how many heroes the House refills at a time. NOT the
   * field concurrency cap; see {@link fieldSlots}. The name predates the distinction.
   */
  slots?: number;
  /**
   * FIELD slots (`skills.field_slots`) — how many heroes may be deployed at once. Absent on
   * accounts stored before the split; consumers fall back to {@link slots}, which is what they
   * used to read here (wrongly, but it is the only value an old record carries).
   */
  fieldSlots?: number | null;
  /**
   * `casa.cycle_secs` — full 0 → 100% House fill, seconds. Absent/`null` falls back to the
   * `HOUSES` table (`resolveHouseRestSeconds`). Feeds `Context.restSeconds` for the farm board,
   * the advisor and the team-plan scorer alike.
   */
  houseCycleSecs?: number | null;
  /**
   * The (house, level) `houseCycleSecs` above was captured at — `casa.active_casa - 1` /
   * `casa.levels[active_casa - 1]` at import time. Absent, `houseCycleSecs` is trusted
   * unconditionally regardless of `context.houseIdx`/`houseLevel` (`resolveHouseRestSeconds`'s
   * pre-existing behaviour for every caller with no picker able to diverge from the import).
   */
  houseCycleSecsHouseIdx?: number | null;
  houseCycleSecsLevel?: number | null;
  forgeFloor?: number;
  /** `account.max_phase` — furthest phase reached. `null`/absent means no lock badges.
   *  Optional and populated by nobody in `@bombfarm/domain` — a consumer mirrors it from
   *  `AccountImportData.maxPhase` after import. */
  maxPhase?: number | null;
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
  /**
   * `stat_points_available` from the save — banked stat points the player had not yet spent AT
   * IMPORT TIME, NOT reflected anywhere in `pts`. Read on import for the budget-mismatch check
   * (`point-inference.ts`) and persisted here as the record of what the save reported.
   * Defaults to 0 for pre-existing records (back-compat).
   *
   * A snapshot, not a live count: it does not shrink as the planner spends `pts`, so it must
   * never be added to a point budget (`reoptBudget` derives the live figure from `level`).
   */
  statPointsAvailable?: number;
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
