import type { BirthStats, TreeSheetTotals } from '../birth-sheet';
import type { BestFarmPhaseOptions } from '../farm-optimize-objective';
import type { HeroFarmFacts, SquadFarmAccount } from '../farm-rate';
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
  /** `min(FORJA_MAX, max(upgrade, forgeFloor))` — what scoring uses. */
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
    /** Equipped on a hero absent from the roster. */
    foreignOwner: number;
  };
};

export type FarmContext = {
  houseIdx: number;
  houseLevel: number;
  phase: number | null;
  mitigationPct: number;
  /**
   * `casa.cycle_secs` when the save carried it. Absent falls back to the `HOUSES` table — the
   * scorer's historical behaviour. Threaded here rather than left to the farm board alone
   * because `farmContextForHero` produces the `restSeconds` this scorer's duty cycle divides by.
   */
  cycleSecs?: number | null;
  /**
   * The (house, level) `cycleSecs` above was captured at — see
   * `FarmContextForHeroInput.cycleSecsHouseIdx`/`cycleSecsLevel` (`farm-context.ts`). Omitted,
   * `cycleSecs` is trusted unconditionally regardless of `houseIdx`/`houseLevel` above.
   */
  cycleSecsHouseIdx?: number | null;
  cycleSecsLevel?: number | null;
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
 * one run: `heroId | loadout | pts | auras | farm`. Only the `HeroPlanContext` a `heroId`
 * resolves to is fixed for a whole `runTeamPlan`, which is exactly the scope a memo may span.
 * Never share one across two different inputs.
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

/**
 * What "better" means to the Team Plan's search.
 *
 * `'dps'` is the roster's duty-weighted sustained damage — the historical objective, and still
 * the default. `'farm'` is the squad's best achievable gold per hour. They are different
 * orderings over the same gear and points, and they disagree in SIGN and not merely in degree: a
 * damage-mode plan that lifts roster damage by tens of percent can lower the gold the account
 * earns. The measured figures live in this change's changeset, where each carries the capture it
 * came from and that capture's date.
 */
export type TeamPlanObjective = 'dps' | 'farm';

/**
 * Which kinds of change the plan is allowed to propose — a different axis from
 * {@link ScopeState}, which says WHICH HEROES the search may touch. This says WHAT it may do to
 * them, and the two compose: a `'points'` plan over three Optimize heroes re-spends those three
 * heroes' stat points and moves nobody's gear.
 *
 * `'points'` forbids the gear climb AND the forge floor — a plan that may not move gear may not
 * order forge work either, since a forge is gear work the player has to go and do. `'gear'`
 * forbids every stat-point pass. Under both, the forbidden half must be absent from the plan
 * rather than merely hidden by the caller: no move list, no forge list, no point resets.
 */
export type TeamPlanAllowedChanges = 'points' | 'gear' | 'both';

export type RosterEvaluation = {
  objective: number;
  regime: RosterRegime;
  sumDuty: number;
  slots: number;
  perHero: Record<string, HeroScore>;
  auras: Record<TeamBuffId, number>;
  /**
   * Farm mode only: the phase `objective` was measured at, and the per-hero farm facts it was
   * measured from. Absent in DPS mode, and `farmPhase` is `null` when no phase is feasible.
   * `screenRosterObjective` reads both — it rescores only the heroes a move touches and prices
   * the incumbent's phase alone, rather than sweeping the phase table per screened move.
   */
  farmPhase?: number | null;
  farmFacts?: readonly HeroFarmFacts[];
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
  houseIdx: number;
  houseLevel: number;
  phase: number | null;
  mitigationPct: number;
  /** HOUSE RECOVERY slots (`casa.slots`) — NOT the field concurrency cap; see {@link fieldSlots}. */
  slots: number;
  /**
   * FIELD concurrency cap — how many heroes may be deployed at once. Already resolved with its
   * fallback (`account.fieldSlots ?? account.slots`, `farm-rate.ts`'s `SquadFarmFacts` convention)
   * by the caller. This, not {@link slots}, is what `evaluateRoster`'s saturation math means by
   * "slots" — the roster objective divides duty against how many heroes can fight at once.
   */
  fieldSlots: number;
  /** `casa.cycle_secs` — see {@link FarmContext.cycleSecs}. Optional: absent keeps the table. */
  cycleSecs?: number | null;
  /** See {@link FarmContext.cycleSecsHouseIdx}/`cycleSecsLevel`. */
  cycleSecsHouseIdx?: number | null;
  cycleSecsLevel?: number | null;
  /**
   * The three account-level terms only the FARM objective reads, none of which the DPS objective
   * has ever needed. `teamCoinPct` (`skills.totals.team_coin × 100`, the tree's gold multiplier)
   * defaults to 0 and `xpMult` (`skills.totals.xp_mult`, verbatim) to 1, both matching the
   * estimator. A DPS-mode plan is unaffected by all three.
   *
   * `maxPhase` (`account.max_phase`) has no default in farm mode when the plan is left to find
   * its own phase — `runTeamPlan` refuses to sweep the 600-phase table and optimise the squad for
   * phases the account has never unlocked. {@link TeamPlanInput.targetPhase} removes that need
   * entirely: a named phase is not a sweep, so gold scoring works on a record carrying no
   * `max_phase` at all.
   */
  teamCoinPct?: number;
  xpMult?: number;
  maxPhase?: number | null;
};

/**
 * The build-independent half of one hero's farm basis, extracted once per run.
 *
 * `dmgMult` and the two loot ability levels are functions of the hero's abilities and the frozen
 * team auras alone — no gear, no points — so they survive every candidate the search tries. The
 * build-DEPENDENT half (the effective sheet, its per-point deltas, and the farm `Context`) comes
 * from the scorer per evaluation and is combined with this.
 */
export type FrozenHeroFarmTerms = {
  /** The very `HeroPlanContext` the run was built from — fixed for a whole `runTeamPlan`, which
   *  is also the exact lifetime of the objective holding it. */
  ctx: HeroPlanContext;
  dmgMult: number;
  /**
   * Present exactly for a squad hero the search may not re-gear. Nothing supplies a loadout for
   * such a hero per evaluation — the assignment only covers optimize scope — so the objective
   * carries the one it will farm with for the whole run.
   */
  fixedLoadout?: Loadout;
};

/**
 * Everything a farm-mode evaluation needs that does not move as the search reassigns gear or
 * points: the rotation-priced team auras, the phase-1/zero-mitigation farm context the farm
 * estimator prices every hero against, the account terms the squad reduction reads, and the
 * per-hero frozen terms above (in roster order).
 *
 * `heroes` is the SQUAD, not the search's scope. A hero the player left alone still fields, still
 * takes a House slot and still earns gold, and House allocation, `uptimeSum` and `sorteFraction`
 * are all nonlinear in who is present — so pricing the squad without it answers a question about
 * a roster the player is not running. What scope decides is which of these heroes the search may
 * MOVE gear onto, which is the same split `farm-hero-optimize.ts` already makes.
 *
 * Frozen deliberately, and for the same reason the respec optimizer freezes them: the auras are a
 * function of every hero's uptime, uptime moves with the build, and re-pricing them per candidate
 * would cost a pipeline pass per candidate. The residual is second-order — only Fôlego reaches
 * uptime at all, and a roster whose Fôlego total sits at its cap has no sensitivity left.
 */
export type TeamPlanFarmObjective = {
  auras: Record<TeamBuffId, number>;
  farm: FarmContext;
  account: SquadFarmAccount;
  /** Carries `pinnedPhase` when {@link TeamPlanInput.targetPhase} named one, which is what turns
   *  every evaluation's phase argmax into a single row read. */
  phaseOptions: BestFarmPhaseOptions;
  treeLuckFlatPct: number;
  heroes: readonly FrozenHeroFarmTerms[];
};

export type TeamPlanInput = {
  heroes: TeamPlanHeroInput[];
  inventory: InventoryItem[];
  account: TeamPlanAccountInput;
  scopeByHeroId: Record<string, ScopeState>;
  forgeFloor: number;
  /** Omitted ⇒ `'dps'`, the historical behaviour. See {@link TeamPlanObjective}. */
  objective?: TeamPlanObjective;
  /**
   * Omitted ⇒ `'both'`, the historical behaviour. Honoured under EITHER objective — the
   * restriction is on what the plan may ask the player to do, not on how it scores.
   * See {@link TeamPlanAllowedChanges}.
   */
  allowedChanges?: TeamPlanAllowedChanges;
  /**
   * The one phase to plan for, under EITHER objective. Absent/`null` keeps the historical
   * behaviour of each: farm sweeps for the best phase the squad can hold, damage scores at the
   * account's own phase and mitigation.
   *
   * Named, both objectives score there and nowhere else — farm reads one phase row instead of
   * the ~35 a screen-and-refine sweep reads, and damage swaps the account's mitigation for that
   * phase's. A phase past `account.maxPhase` is allowed on purpose: "what would I earn if I
   * could hold this" is a question worth answering, and {@link TeamPlan.scoredPhase} reports
   * back which phase the answer is about.
   */
  targetPhase?: number | null;
};

/**
 * The subset of `HeroSheet` shown in the per-hero stat breakdown — excludes the per-point rates.
 * `luck` rides along here too (`HeroSheet` itself has no `luck` field — it never reaches combat)
 * so combat rows always report it as `0`; only the sheet rows
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
  /** Combat-effective stats (`HeroScore.effective`) — team auras applied, uncapped (matches `teamPlanHeroDeltaNote`). */
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
    /** The allocation this run scored. A plan outlives the roster it was built from, so reading
     *  the hero's live points instead pairs {@link pts} with a start nothing here measured. */
    ptsBefore: Record<string, number>;
    pts: Record<string, number>;
    /**
     * Per-hero sustained DPS % change, MAY be negative — the roster can still gain. Not floored.
     * DPS in BOTH objective modes: the farm objective replaces only the scalar the search
     * compares, and leaves `perHero` describing the roster's damage state.
     */
    heroGainDpsPct: number;
    /** Marginal ROSTER objective gain at the moment this reset was accepted — sustained damage
     *  under the DPS objective, gold per hour under the farm one. Display-only. */
    rosterGainObjective: number;
    /** `heroLevel * 1000` gold. Display-only — never in the objective, never a filter or gate. */
    resetCostGold: number;
  }[];
  perHero: TeamPlanPerHeroRow[];
  /** Per-hero proposed loadouts — display only until the user confirms the altLoadout push. */
  proposedLoadouts: Record<string, Loadout>;
  regime: RosterRegime;
  sumDuty: number;
  slots: number;
  currentDps: number;
  planDps: number;
  /** The forge floor the plan actually adopted — 0 when forging was rejected. */
  forgeFloorApplied: number;
  /**
   * What this plan was allowed to change, resolved. Reported back because a plan outlives the
   * control that produced it: an empty forge list means "forging did not pay" under `'both'` and
   * "forging was never on the table" under `'points'`, and only the plan itself can say which.
   */
  allowedChanges: TeamPlanAllowedChanges;
  /**
   * The phase every figure above is about, and where that phase came from.
   *
   * `'chosen'` is `TeamPlanInput.targetPhase` verbatim. `'searched'` is the farm sweep's own
   * argmax — the phase the plan picked for itself, and the only source a reader has to be told
   * was automatic. `'account'` is the damage objective's default, the account's current phase.
   *
   * `null` only when there is no phase to name at all: a farm sweep that found nothing feasible
   * anywhere, or a damage plan on a record carrying no current phase.
   */
  scoredPhase: number | null;
  scoredPhaseSource: 'chosen' | 'searched' | 'account';
  /**
   * The squad cannot clear {@link scoredPhase}, so the gold figures are zero rather than small.
   * Only ever true for a chosen phase in farm mode — a sweep never settles on a phase it cannot
   * hold, and the damage objective has no feasibility notion.
   */
  scoredPhaseInfeasible: boolean;
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
  /**
   * The resolved farm objective, or absent for `'dps'`.
   *
   * ONE field rather than a `'dps' | 'farm'` tag beside a bridge: the bridge is derived once from
   * the whole `TeamPlanInput` and carries every frozen term a farm evaluation needs, so a
   * separate tag could only ever contradict it. `TeamPlanObjective` stays the caller-facing knob
   * on {@link TeamPlanInput}; `runTeamPlan` turns `'farm'` into this and nothing else selects the
   * mode below that point.
   */
  farmObjective?: TeamPlanFarmObjective;
};
