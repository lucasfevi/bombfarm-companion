import type { PlannerStore } from '@/shared/stores/planner-store';
import type { AccountShared } from '@/shared/lib/storage';
import { computeTeamBuffsFromDeployed, type TeamBuffId } from '@bombfarm/domain/team-buffs';

export const selectTreeDanoTotal = (state: PlannerStore) => state.treeDanoTotal;
export const selectTreeCritChance = (state: PlannerStore) => state.treeCritChance;
export const selectTreeCritDmg = (state: PlannerStore) => state.treeCritDmg;
export const selectTreeSpeed = (state: PlannerStore) => state.treeSpeed;
export const selectTreeEnergy = (state: PlannerStore) => state.treeEnergy;
export const selectTreeTeamCoinPct = (state: PlannerStore) => state.treeTeamCoinPct;
export const selectTreeLuckFlatPct = (state: PlannerStore) => state.treeLuckFlatPct;
export const selectTreeXpMult = (state: PlannerStore) => state.treeXpMult;
/** The user's explicit override, or `null` when the panel has never been touched (issue #132)
 *  — read this directly only to decide whether an override is active; combat math should read
 *  {@link selectEffectiveTeamBuffs} instead. */
export const selectTeamBuffsOverride = (state: PlannerStore) => state.teamBuffsOverride;
export const selectHouseIdx = (state: PlannerStore) => state.houseIdx;
export const selectHouseLevel = (state: PlannerStore) => state.houseLevel;
export const selectFarmPhase = (state: PlannerStore) => state.phase;
export const selectMitigationPct = (state: PlannerStore) => state.mitigationPct;
export const selectRankMode = (state: PlannerStore) => state.rankMode;
export const selectSlots = (state: PlannerStore) => state.slots;
export const selectFieldSlots = (state: PlannerStore) => state.fieldSlots;
export const selectHouseCycleSecs = (state: PlannerStore) => state.houseCycleSecs;
export const selectHouseCycleSecsHouseIdx = (state: PlannerStore) => state.houseCycleSecsHouseIdx;
export const selectHouseCycleSecsLevel = (state: PlannerStore) => state.houseCycleSecsLevel;
export const selectTargetProp = (state: PlannerStore) => state.targetProp;
export const selectMaxPhase = (state: PlannerStore) => state.maxPhase;

/**
 * The roster-wide team-buffs total every combat computation should actually use (issue #132):
 * the explicit override when one is set, else DERIVED from the deployed roster
 * (`computeTeamBuffsFromDeployed`) — never a stored field that silently starts at zero. A hero
 * carrying a team aura otherwise got no benefit from it until a user found the auto-fill button;
 * deriving by default closes that gap without taking away the override as a deliberate "what if"
 * planning affordance.
 *
 * Module-level single-entry cache (AD-012 shape, matching `selectAdvisorPipeline`/
 * `selectFarmRankingRows`) — returns the SAME reference while neither `state.heroes` nor
 * `state.teamBuffsOverride` changed, so every dep tuple that used to read `state.teamBuffs`
 * directly can depend on this selector's result instead of listing `heroes`/`teamBuffsOverride`
 * separately.
 */
let effectiveTeamBuffsCache: {
  heroes: PlannerStore['heroes'];
  override: PlannerStore['teamBuffsOverride'];
  result: Record<TeamBuffId, number>;
} | null = null;

export function resetEffectiveTeamBuffsCache(): void {
  effectiveTeamBuffsCache = null;
}

export function selectEffectiveTeamBuffs(state: PlannerStore): Record<TeamBuffId, number> {
  if (
    effectiveTeamBuffsCache &&
    Object.is(effectiveTeamBuffsCache.heroes, state.heroes) &&
    Object.is(effectiveTeamBuffsCache.override, state.teamBuffsOverride)
  ) {
    return effectiveTeamBuffsCache.result;
  }
  const result = state.teamBuffsOverride ?? computeTeamBuffsFromDeployed(state.heroes);
  effectiveTeamBuffsCache = { heroes: state.heroes, override: state.teamBuffsOverride, result };
  return result;
}

/** Nested AccountShared for persistence writes — inverse of hydrateAccount. */
let accountSharedCache: AccountShared | null = null;
let accountSharedTuple: ReturnType<typeof selectAccountTuple> | null = null;

/** Clears the referential caches — call from `resetPlannerStoreForTests`. */
export function clearAccountSharedSelectorCache(): void {
  accountSharedCache = null;
  accountSharedTuple = null;
  resetEffectiveTeamBuffsCache();
}

/**
 * Nested AccountShared for persistence + consumers.
 * Returns a **stable reference** while `selectAccountTuple` is field-wise unchanged
 * so `useShallow(selectAccountShared)` does not infinite-loop (new tree/context
 * objects every call would fail shallow compare every render).
 */
export function selectAccountShared(state: PlannerStore): AccountShared {
  const tuple = selectAccountTuple(state);
  if (
    accountSharedCache &&
    accountSharedTuple &&
    accountSharedTuple.length === tuple.length &&
    accountSharedTuple.every((value, index) => Object.is(value, tuple[index]))
  ) {
    return accountSharedCache;
  }
  accountSharedTuple = tuple;
  accountSharedCache = {
    tree: {
      danoTotal: state.treeDanoTotal,
      critChance: state.treeCritChance,
      critDmg: state.treeCritDmg,
      speed: state.treeSpeed,
      energy: state.treeEnergy,
      teamCoinPct: state.treeTeamCoinPct,
      luckFlatPct: state.treeLuckFlatPct,
      xpMult: state.treeXpMult,
    },
    // `teamBuffs` is deprecated (see AccountShared's own doc comment) — written only so an old
    // app build reading this file sees a plausible value, never read back for the override
    // decision by this build. `teamBuffsOverride` is the authoritative field.
    teamBuffs: state.teamBuffsOverride ?? {},
    teamBuffsOverride: state.teamBuffsOverride,
    context: {
      houseIdx: state.houseIdx,
      houseLevel: state.houseLevel,
      phase: state.phase,
      mitigationPct: state.mitigationPct,
      rankMode: state.rankMode,
      targetProp: state.targetProp,
    },
    slots: state.slots,
    fieldSlots: state.fieldSlots,
    houseCycleSecs: state.houseCycleSecs,
    houseCycleSecsHouseIdx: state.houseCycleSecsHouseIdx,
    houseCycleSecsLevel: state.houseCycleSecsLevel,
    forgeFloor: state.forgeFloor,
    maxPhase: state.maxPhase,
  };
  return accountSharedCache;
}

/** Account tree + farm tuple for shallow account autosave subscription. */
export function selectAccountTuple(state: PlannerStore) {
  return [
    state.treeDanoTotal,
    state.treeCritChance,
    state.treeCritDmg,
    state.treeSpeed,
    state.treeEnergy,
    state.treeTeamCoinPct,
    state.treeLuckFlatPct,
    state.treeXpMult,
    state.teamBuffsOverride,
    state.houseIdx,
    state.houseLevel,
    state.phase,
    state.mitigationPct,
    state.rankMode,
    state.targetProp,
    state.slots,
    state.fieldSlots,
    state.houseCycleSecs,
    state.houseCycleSecsHouseIdx,
    state.houseCycleSecsLevel,
    state.forgeFloor,
    state.maxPhase,
  ] as const;
}

export type { TeamBuffId };
