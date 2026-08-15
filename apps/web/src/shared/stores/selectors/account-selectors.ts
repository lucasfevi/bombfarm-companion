import type { PlannerStore } from '@/shared/stores/planner-store';
import type { AccountShared } from '@/shared/lib/storage';
import type { TeamBuffId } from '@bombfarm/domain/team-buffs';

export const selectTreeDanoTotal = (state: PlannerStore) => state.treeDanoTotal;
export const selectTreeCritChance = (state: PlannerStore) => state.treeCritChance;
export const selectTreeCritDmg = (state: PlannerStore) => state.treeCritDmg;
export const selectTreeSpeed = (state: PlannerStore) => state.treeSpeed;
export const selectTreeEnergy = (state: PlannerStore) => state.treeEnergy;
export const selectTreeTeamCoinPct = (state: PlannerStore) => state.treeTeamCoinPct;
export const selectTreeLuckFlatPct = (state: PlannerStore) => state.treeLuckFlatPct;
export const selectTeamBuffs = (state: PlannerStore) => state.teamBuffs;
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

/** Nested AccountShared for persistence writes — inverse of hydrateAccount. */
let accountSharedCache: AccountShared | null = null;
let accountSharedTuple: ReturnType<typeof selectAccountTuple> | null = null;

/** Clears the referential cache — call from `resetPlannerStoreForTests`. */
export function clearAccountSharedSelectorCache(): void {
  accountSharedCache = null;
  accountSharedTuple = null;
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
    },
    teamBuffs: state.teamBuffs,
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
    state.teamBuffs,
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
