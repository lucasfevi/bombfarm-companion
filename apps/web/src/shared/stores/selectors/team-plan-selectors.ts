import type { TeamPlanControls, TeamPlanInputs } from '@bombfarm/team-plan/core';
import type { PlannerStore } from '@/shared/stores/planner-store';
import {
  selectLiveTeamPlanInputSignature,
  selectTeamPlanTargetPhase,
} from '@/shared/stores/slices/team-plan-slice';

export { selectTeamPlanTargetPhase };

export function selectTeamPlanInputs(state: PlannerStore): TeamPlanInputs {
  return {
    heroes: state.heroes,
    inventory: state.inventory,
    treeDanoTotal: state.treeDanoTotal,
    treeEnergy: state.treeEnergy,
    treeSpeed: state.treeSpeed,
    treeCritChance: state.treeCritChance,
    treeCritDmg: state.treeCritDmg,
    treeLuckFlatPct: state.treeLuckFlatPct,
    treeTeamCoinPct: state.treeTeamCoinPct,
    treeXpMult: state.treeXpMult,
    houseIdx: state.houseIdx,
    houseLevel: state.houseLevel,
    phase: state.phase,
    mitigationPct: state.mitigationPct,
    slots: state.slots,
    fieldSlots: state.fieldSlots,
    houseCycleSecs: state.houseCycleSecs,
    houseCycleSecsHouseIdx: state.houseCycleSecsHouseIdx,
    houseCycleSecsLevel: state.houseCycleSecsLevel,
    maxPhase: state.maxPhase,
    farmChosenPhase: state.phasesViewPhaseChosen ? state.phasesViewPhase : null,
  };
}

export function selectTeamPlanControls(state: PlannerStore): TeamPlanControls {
  return {
    scopeByHeroId: state.scopeByHeroId,
    forgeFloor: state.forgeFloor,
    objective: state.objective,
    allowedChanges: state.allowedChanges,
    ignoreFieldCrowding: state.ignoreFieldCrowding,
    targetPhase: state.targetPhase,
    targetPhaseChosen: state.targetPhaseChosen,
  };
}

export function selectTeamPlanIsStale(state: PlannerStore): boolean {
  if (state.planInputSignature == null) return false;
  return state.planInputSignature !== selectLiveTeamPlanInputSignature(state);
}

export function selectInventoryItems(state: PlannerStore) {
  return state.inventory.items;
}

export function selectScopeByHeroId(state: PlannerStore) {
  return state.scopeByHeroId;
}

export function selectForgeFloor(state: PlannerStore) {
  return state.forgeFloor;
}

export function selectTeamPlanObjective(state: PlannerStore) {
  return state.objective;
}

export function selectTeamPlanAllowedChanges(state: PlannerStore) {
  return state.allowedChanges;
}

export function selectTeamPlanIgnoreFieldCrowding(state: PlannerStore) {
  return state.ignoreFieldCrowding;
}

/**
 * A gold plan left to find its own phase sweeps the phases the account has unlocked, and
 * `runTeamPlan` refuses to guess that ceiling: with no `max_phase` on the record there is nothing
 * to bound the sweep with. Naming a phase removes the sweep and with it the requirement, so this
 * is only ever true while the phase control sits on None.
 */
export function selectTeamPlanFarmUnavailable(state: PlannerStore): boolean {
  return state.maxPhase == null && selectTeamPlanTargetPhase(state) == null;
}
