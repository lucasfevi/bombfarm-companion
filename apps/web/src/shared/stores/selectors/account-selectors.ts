import type { PlannerStore } from '@/shared/stores/planner-store';
import type { AccountShared } from '@/shared/lib/storage';
import type { AccountShared as CombatAccount } from '@bombfarm/domain/shims/storage';
import { computeTeamBuffsAroundHero, type TeamBuffId } from '@bombfarm/domain/team-buffs';

export const selectTreeDanoTotal = (state: PlannerStore) => state.treeDanoTotal;
export const selectTreeCritChance = (state: PlannerStore) => state.treeCritChance;
export const selectTreeCritDmg = (state: PlannerStore) => state.treeCritDmg;
export const selectTreeSpeed = (state: PlannerStore) => state.treeSpeed;
export const selectTreeEnergy = (state: PlannerStore) => state.treeEnergy;
export const selectTreeTeamCoinPct = (state: PlannerStore) => state.treeTeamCoinPct;
export const selectTreeLuckFlatPct = (state: PlannerStore) => state.treeLuckFlatPct;
export const selectTreeXpMult = (state: PlannerStore) => state.treeXpMult;
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
export const selectPlayerName = (state: PlannerStore) => state.playerName;
export const selectAccountId = (state: PlannerStore) => state.accountId;
export const selectMissingRequiredFields = (state: PlannerStore) => state.missingRequiredFields;
export const selectTreeSquadDmgPct = (state: PlannerStore) => state.treeSquadDmgPct;
export const selectTreeGeoMult = (state: PlannerStore) => state.treeGeoMult;
export const selectTreeFieldSlotsBonus = (state: PlannerStore) => state.treeFieldSlotsBonus;
export const selectTreeBagTabsBonus = (state: PlannerStore) => state.treeBagTabsBonus;

/**
 * The team-aura total every per-hero figure on the planner prices the ACTIVE hero against: its
 * own aura always, plus each other fielded carrier at full presence for every aura whose Combat
 * tab switch is on (`computeTeamBuffsAroundHero`). Read off the hero's PERSISTED record, so an
 * edit to its own rank reaches the live preview through `substituteHeroAbilities` (the advisor's
 * `previewTeamBuffs`), exactly as it did against the old roster total.
 *
 * Module-level single-entry cache (matching `selectAdvisorPipeline`/`selectFarmRankingRows`) —
 * returns the SAME reference while none of `state.heroes`, `state.activeHeroId` and
 * `state.teamAuraSwitches` changed, so a dep tuple can list this result in place of the three.
 */
let activeHeroTeamBuffsCache: {
  heroes: PlannerStore['heroes'];
  activeHeroId: PlannerStore['activeHeroId'];
  switches: PlannerStore['teamAuraSwitches'];
  result: Record<TeamBuffId, number>;
} | null = null;

export function resetActiveHeroTeamBuffsCache(): void {
  activeHeroTeamBuffsCache = null;
}

export function selectActiveHeroTeamBuffs(state: PlannerStore): Record<TeamBuffId, number> {
  if (
    activeHeroTeamBuffsCache &&
    Object.is(activeHeroTeamBuffsCache.heroes, state.heroes) &&
    Object.is(activeHeroTeamBuffsCache.activeHeroId, state.activeHeroId) &&
    Object.is(activeHeroTeamBuffsCache.switches, state.teamAuraSwitches)
  ) {
    return activeHeroTeamBuffsCache.result;
  }
  const active = state.heroes.find((hero) => hero.id === state.activeHeroId) ?? {
    id: state.activeHeroId ?? '',
    abilities: {},
  };
  const result = computeTeamBuffsAroundHero(active, state.heroes, state.teamAuraSwitches);
  activeHeroTeamBuffsCache = {
    heroes: state.heroes,
    activeHeroId: state.activeHeroId,
    switches: state.teamAuraSwitches,
    result,
  };
  return result;
}

/** Nested AccountShared for persistence writes — inverse of hydrateAccount. */
let accountSharedCache: AccountShared | null = null;
let accountSharedTuple: ReturnType<typeof selectAccountTuple> | null = null;

/** Clears the referential caches — call from `resetPlannerStoreForTests`. */
export function clearAccountSharedSelectorCache(): void {
  accountSharedCache = null;
  accountSharedTuple = null;
  resetActiveHeroTeamBuffsCache();
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
      squadDmgPct: state.treeSquadDmgPct,
      geoMult: state.treeGeoMult,
      fieldSlotsBonus: state.treeFieldSlotsBonus,
      bagTabsBonus: state.treeBagTabsBonus,
    },
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
    playerName: state.playerName,
    accountId: state.accountId,
    // Omitted, not written as `null`, so a pre-rule account round-trips byte-identically
    // (`storage-roundtrip.test.ts`, the round-trip tripwire).
    ...(state.missingRequiredFields != null
      ? { missingRequiredFields: state.missingRequiredFields }
      : {}),
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
    state.treeSquadDmgPct,
    state.treeGeoMult,
    state.treeFieldSlotsBonus,
    state.treeBagTabsBonus,
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
    state.playerName,
    state.accountId,
    state.missingRequiredFields,
  ] as const;
}

let activeHeroAccountCache: CombatAccount | null = null;

/**
 * The account a per-hero figure for the ACTIVE hero computes against, as opposed to the one to
 * persist: {@link selectAccountShared} holds no aura total (storage never did anything but carry a
 * stale one), so the per-hero total is overlaid here for the readers that price one hero. The
 * roster-wide readers have their own overlay, `selectRosterAccount`, priced over the rotation.
 */
export function selectActiveHeroAccount(state: PlannerStore): CombatAccount {
  const shared = selectAccountShared(state);
  const teamBuffs = selectActiveHeroTeamBuffs(state);
  if (
    activeHeroAccountCache &&
    activeHeroAccountCache.teamBuffs === teamBuffs &&
    Object.is(activeHeroAccountCache.context, shared.context)
  ) {
    return activeHeroAccountCache;
  }
  activeHeroAccountCache = { ...shared, teamBuffs };
  return activeHeroAccountCache;
}

export function resetActiveHeroAccountCache(): void {
  activeHeroAccountCache = null;
}

export type { TeamBuffId };
