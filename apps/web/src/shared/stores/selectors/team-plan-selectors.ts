import {
  computeTeamPlanInputSignature,
  countOptimizeScopeHeroes,
  isFarmObjectiveUnavailable,
  isTeamPlanStale,
  planTargetPhase,
  resolveTeamPlanTargetPhase,
  type TeamPlanControls,
  type TeamPlanInputs,
} from '@bombfarm/team-plan/core';
import { NO_AURAS_AT_CAP } from '@bombfarm/domain/team-buffs';
import type { PlannerStore } from '@/shared/stores/planner-store';

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
    // A save carries no PVP state, so this app never offers the duel objective.
    pvpRoomPhase: null,
  };
}

export function selectTeamPlanControls(state: PlannerStore): TeamPlanControls {
  return {
    scopeByHeroId: state.scopeByHeroId,
    forgeFloor: state.forgeFloor,
    objective: state.objective,
    allowedChanges: state.allowedChanges,
    ignoreFieldCrowding: state.ignoreFieldCrowding,
    // This app offers no control for it: the search prices every aura as the roster sustains it.
    aurasAtCap: NO_AURAS_AT_CAP,
    targetPhase: state.targetPhase,
    targetPhaseChosen: state.targetPhaseChosen,
    gatePhase: state.gatePhase,
  };
}

/**
 * Which phase the Team plan actually scores at.
 *
 * Until the player picks one, this tracks what they were already looking at: the Farm tab's phase
 * when that was a genuine choice, else the phase the save says the account is on. `null` means
 * neither exists, or the player picked None.
 */
export function selectTeamPlanTargetPhase(state: PlannerStore): number | null {
  return resolveTeamPlanTargetPhase(selectTeamPlanInputs(state), selectTeamPlanControls(state));
}

/** The phase the plan is scored at under the objective as set — the gate for a gate clear, the
 *  phase control's answer for gold. What a stored plan's phase is compared against. */
export function selectTeamPlanScoredPhase(state: PlannerStore): number | null {
  return planTargetPhase(selectTeamPlanInputs(state), selectTeamPlanControls(state));
}

export function selectTeamPlanIsStale(state: PlannerStore): boolean {
  return isTeamPlanStale(
    state.planInputSignature,
    computeTeamPlanInputSignature(selectTeamPlanInputs(state), selectTeamPlanControls(state)),
  );
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
  return isFarmObjectiveUnavailable(state.maxPhase, selectTeamPlanTargetPhase(state));
}

export function selectOptimizeScopeHeroCount(state: PlannerStore): number {
  return countOptimizeScopeHeroes(state.heroes, state.scopeByHeroId);
}

/** The exact conditions under which the Optimizer page's Optimize button is enabled. */
export function selectTeamPlanInputsUsable(state: PlannerStore): boolean {
  return (
    state.heroes.length > 0 &&
    state.inventory.items.length > 0 &&
    selectOptimizeScopeHeroCount(state) > 0 &&
    !(state.objective === 'farm' && selectTeamPlanFarmUnavailable(state))
  );
}
