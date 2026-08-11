import type { BirthStats, TreeSheetTotals } from '../birth-sheet';
import type { Loadout, PointAlloc, SheetStats } from '../gear/types';
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
  treeAbisso?: boolean;
  /** `skills.totals.abisso_base` — Abisso's damage-multiplier exponent base (0 when unowned). */
  treeAbissoBase?: number;
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
  /**
   * `derive()`'s sheet-layer result — the geared+points sheet BEFORE combat multipliers/team
   * auras/Presságio Mortal-style additions (`effective` above is the combat view). This is
   * what the in-game hero panel actually shows, so it is the uncapped input to
   * `gameSheetView` for the Team Plan hero panel's "Hero sheet" grid (`sheet-view.ts`,
   * `hero-stat-breakdown.tsx`) — never combat-multiplied, and never capped in the domain
   * layer itself (display-time capping lives at the UI call site, same rule as
   * `composeSheetFromBirth`/`peelSheetStages`).
   */
  adjusted: SheetStats;
  /**
   * `derive()`'s single-target normal (non-crit) hit — `predictHitDamage(effective.attack,
   * mitigationPct/100, effective.penetration, dmgMult)`. Carried alongside `adjusted` above at
   * no extra evaluation cost (`derive()` already returns it). The Team Plan hero panel's Hit
   * damage grid (`hero-stat-breakdown.tsx`) derives Critical from this at display time —
   * `hit × (1 + effective.critDmg / 100)`, same formula as `advisor-pipeline.ts`'s `predCrit`
   * — rather than storing a second field here.
   */
  hit: number;
};

/**
 * Cache of per-hero scores, keyed by everything `scoreHeroLoadout` reads that can vary within
 * one run: `heroId | loadout | pts | auras`. The rest of its inputs — the `HeroPlanContext` a
 * `heroId` resolves to, and the `FarmContext` — are fixed for a whole `runTeamPlan`, which is
 * exactly the scope a memo may span. Never share one across two different inputs.
 *
 * FIFO-bounded, same reasoning as the solver's evaluation cache: a cache must never grow with
 * the evaluation budget. Eviction can only cost time, never change a result — the key
 * determines the value.
 */
export type ScoreMemo = {
  entries: Map<string, HeroScore>;
  maxEntries: number;
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

export type TeamPlanHeroInput = {
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

export type TeamPlanAccountInput = {
  treeSheet: TreeSheetTotals;
  treeGlassCannon: boolean;
  treeTempoDobrado: boolean;
  treeAbisso?: boolean;
  /** `skills.totals.abisso_base` — Abisso's damage-multiplier exponent base (0 when unowned). */
  treeAbissoBase?: number;
  houseIdx: number;
  houseLevel: number;
  phase: number | null;
  mitigationPct: number;
  slots: number;
};

export type TeamPlanInput = {
  heroes: TeamPlanHeroInput[];
  inventory: InventoryItem[];
  account: TeamPlanAccountInput;
  scopeByHeroId: Record<string, ScopeState>;
  forgeFloor: number;
};

/**
 * The subset of `HeroSheet` shown in the per-hero stat breakdown — excludes the per-point rates.
 * `luck` rides along here too (`HeroSheet` itself has no `luck` field — it never reaches combat,
 * BSP-42/AD-BSP-20/AD-BSP-21) so combat rows always report it as `0`; only the sheet rows
 * (`HeroScore.adjusted`, which IS a `SheetStats`) carry a real value. Display-only — this type
 * feeds the Team Plan hero panel, never the optimizer/scoring/point search.
 */
export type TeamPlanHeroStats = {
  attack: number;
  energy: number;
  speed: number;
  critChance: number;
  critDmg: number;
  penetration: number;
  cdr: number;
  luck: number;
};

export type TeamPlanPerHeroRow = {
  heroId: string;
  heroName: string;
  level: number;
  before: number;
  after: number;
  delta: number;
  /** Combat-effective stats (`HeroScore.effective`) — team auras applied, uncapped (BSPW4-09-adjacent: matches `teamPlanHeroDeltaNote`). */
  combatStatsBefore: TeamPlanHeroStats;
  combatStatsAfter: TeamPlanHeroStats;
  /** Sheet stats (`HeroScore.adjusted`) — no combat multipliers/auras, uncapped here; the UI applies `gameSheetView` (`sheet-view.ts`) before display. */
  sheetStatsBefore: TeamPlanHeroStats;
  sheetStatsAfter: TeamPlanHeroStats;
  /** `HeroScore.hit` — single-target normal (non-crit) hit damage, combat-effective. */
  hitBefore: number;
  hitAfter: number;
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

export type TeamPlan = {
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
  perHero: TeamPlanPerHeroRow[];
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
    unresolvedDefItemCount: number;
  };
  run: {
    rounds: number;
    evaluations: number;
    budgetExhausted: boolean;
    elapsedMs: number;
    seedUsed: string;
  };
};

export type TeamPlanBlockedResult = {
  blocked: true;
  heroNames: string[];
};

export type TeamPlanOkResult = {
  blocked: false;
  plan: TeamPlan;
};

export type TeamPlanResult = TeamPlanBlockedResult | TeamPlanOkResult;

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
  /**
   * Optional cross-call score memo. Omitted, `evaluateRoster` makes a private one that dies with
   * the call — correct, but it can only ever hit within a single roster evaluation. Pass one from
   * the search to reuse the ~14 heroes a neighbouring assignment leaves untouched.
   */
  scoreMemo?: ScoreMemo;
};
