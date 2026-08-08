import type { BirthStats, TreeSheetTotals } from '../birth-sheet';
import type { Loadout, PointAlloc } from '../gear/types';
import type { InventoryItem } from '../inventory';
import type {
  AbilityMods,
  Context,
  EffectiveDeltas,
  HeroSheet,
  RarityKey,
} from '../model';
import type { TeamBuffId } from '../team-buffs';

export type ScopeState = 'optimize' | 'donate' | 'leaveAlone';

export type PoolEntry = {
  /** `defId|rarityIdx|level|effectiveUpgrade` — identical tuples are interchangeable. */
  key: string;
  defId: string;
  rarityIdx: number;
  level: number;
  /** The item's own stored forge level (lowest among the grouped ids). */
  upgrade: number;
  /** `min(FORJA_MAX, max(upgrade, forgeFloor))` — what scoring uses (AD-RGO-06). */
  effectiveUpgrade: number;
  slot: string;
  count: number;
  /** Contributing `InventoryItem.id`s, sorted — drives the move list and forge list. */
  itemIds: string[];
};

export type GearPool = {
  entries: PoolEntry[];
  excluded: {
    marketBlocked: number;
    unresolvedDef: number;
    leaveAlone: number;
    /** Equipped on a hero absent from the roster (RGO-30). */
    foreignOwner: number;
  };
};

export type FarmContext = {
  houseIdx: number;
  houseLevel: number;
  phase: number | null;
  mitigationPct: number;
  treeGlassCannon: boolean;
  treeTempoDobrado: boolean;
};

export type HeroPlanContext = {
  heroId: string;
  name: string;
  level: number;
  stars: number;
  rarity: RarityKey;
  birth: BirthStats;
  sheetOther: import('../gear/types').SheetOtherPct;
  mods: AbilityMods;
  treeSheet: TreeSheetTotals;
  scope: ScopeState;
  abilities: Record<string, number>;
  pts: PointAlloc;
};

export type HeroScore = {
  sustained: number;
  active: number;
  duty: number;
  fieldSeconds: number;
  effective: HeroSheet;
  effectiveDelta: EffectiveDeltas;
  context: Context;
};

export type RosterRegime = 'underSaturated' | 'saturated';

export type RosterEvaluation = {
  objective: number;
  regime: RosterRegime;
  sumDuty: number;
  slots: number;
  perHero: Record<string, HeroScore>;
  auras: Record<TeamBuffId, number>;
};

export type GearPlanHeroInput = {
  heroId: string;
  name: string;
  level: number;
  stars: number;
  rarity: RarityKey;
  birth?: BirthStats;
  abilities: Record<string, number>;
  pts: PointAlloc;
  loadout: Loadout;
  battleAllowed?: boolean;
};

export type GearPlanAccountInput = {
  treeSheet: TreeSheetTotals;
  treeGlassCannon: boolean;
  treeTempoDobrado: boolean;
  houseIdx: number;
  houseLevel: number;
  phase: number | null;
  mitigationPct: number;
  slots: number;
};

export type GearPlanInput = {
  heroes: GearPlanHeroInput[];
  inventory: InventoryItem[];
  account: GearPlanAccountInput;
  scopeByHeroId: Record<string, ScopeState>;
  forgeFloor: number;
};

/** The subset of `HeroSheet` shown in the per-hero stat breakdown — excludes the per-point rates. */
export type GearPlanHeroStats = {
  attack: number;
  energy: number;
  speed: number;
  critChance: number;
  critDmg: number;
  penetration: number;
  cdr: number;
};

export type GearPlanPerHeroRow = {
  heroId: string;
  heroName: string;
  level: number;
  before: number;
  after: number;
  delta: number;
  statsBefore: GearPlanHeroStats;
  statsAfter: GearPlanHeroStats;
};

export type WaterfallStep = {
  id: 'today' | 'gear' | 'respec';
  objective: number;
  /** Delta vs the previous step. Always >= 0 at the roster level. Can be 0. */
  delta: number;
};

export type MoveAction = {
  phase: 'unequip' | 'equip';
  itemId: string;
  defId: string;
  slot: string;
  fromHeroId: string | null;
  toHeroId: string | null;
};

export type ForgeAction = { itemId: string; defId: string; from: number; to: number };

export type GearPlan = {
  steps: WaterfallStep[];
  forgeList: ForgeAction[];
  moveList: MoveAction[];
  pointResets: {
    heroId: string;
    pts: Record<string, number>;
    /** Per-hero sustained % change, MAY be negative — the roster can still gain. Not floored. */
    gainPct: number;
    /** Marginal ROSTER objective gain at the moment this reset was accepted. Display-only. */
    rosterGainDps: number;
    /** `heroLevel * 1000` gold. Display-only — never in the objective, never a filter or gate. */
    resetCostGold: number;
  }[];
  perHero: GearPlanPerHeroRow[];
  /** Per-hero proposed loadouts — the payload of the confirmed altLoadout push (RGO-18). */
  proposedLoadouts: Record<string, Loadout>;
  regime: RosterRegime;
  sumDuty: number;
  slots: number;
  currentDps: number;
  planDps: number;
  /** The forge floor the plan actually adopted — 0 when forging was rejected. */
  forgeFloorApplied: number;
  /** Internal split of the single `gear` step. EITHER may be negative; disclosure-only. */
  gearBreakdown: { forgeDelta: number; moveDelta: number };
  /** True when the gear step sits below today. The plan is only ahead once the resets land. */
  requiresFullPlan: boolean;
  /** How far below today the gear step sits, as a POSITIVE number. 0 when requiresFullPlan is false. */
  gearDipDps: number;
  disclosures: {
    unmodelledAbilities: { abilityId: string; heroNames: string[] }[];
    loadoutDriftHeroNames: string[];
    foreignOwnedItemCount: number;
    marketBlockedItemCount: number;
  };
  run: {
    rounds: number;
    evaluations: number;
    budgetExhausted: boolean;
    elapsedMs: number;
    seedUsed: string;
  };
};

export type GearPlanBlockedResult = {
  blocked: true;
  heroNames: string[];
};

export type GearPlanOkResult = {
  blocked: false;
  plan: GearPlan;
};

export type GearPlanResult = GearPlanBlockedResult | GearPlanOkResult;

export type BuildPoolInput = {
  inventory: InventoryItem[];
  scopeByHeroId: Record<string, ScopeState>;
  forgeFloor: number;
  rosterHeroIds: ReadonlySet<string>;
};

export type EvaluateRosterInput = {
  contexts: HeroPlanContext[];
  loadoutsByHeroId: Record<string, Loadout>;
  ptsByHeroId: Record<string, PointAlloc>;
  slots: number;
  farm: FarmContext;
  forgeFloor: number;
};
