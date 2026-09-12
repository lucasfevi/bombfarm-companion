import { wikiPhaseLine } from '@bombfarm/domain/phase-wiki';
import type { PhaseSelection } from '@bombfarm/hero/core';
import type { PlannerStore } from '@/shared/stores/planner-store';

export const selectPhasesViewPhase = (state: PlannerStore): number => state.phasesViewPhase;
export const selectTeamAuraSwitches = (state: PlannerStore) => state.teamAuraSwitches;
export const selectPhasesViewPhaseChosen = (state: PlannerStore): boolean =>
  state.phasesViewPhaseChosen;

/**
 * The phase the app answers for when the planner has not asked about another one.
 *
 * `state.phase` is the farm phase the imported save reported, and nothing in the app moves it
 * afterwards. `state.phasesViewPhase` is the phase the player picked in the phases explorer.
 * Reading a different one on each screen is what made the same hero print two sets of combat
 * numbers, so every surface reads through this instead.
 *
 * A real pick always wins. With no pick the account's own farm phase stands: it is what a fresh
 * import already computed at, and taking the explorer's unchosen phase-1 default instead would
 * move a freshly imported account's numbers onto a phase nobody named.
 */
export function selectCurrentPhase(state: PlannerStore): number {
  const requested = state.phasesViewPhaseChosen ? state.phasesViewPhase : state.phase;
  if (requested == null || !Number.isFinite(requested)) return 1;
  return wikiPhaseLine(requested)?.phase ?? 1;
}

/**
 * The one phase every per-hero combat figure in the planner is computed at: the Combat tab's own
 * pick while one is in force, otherwise {@link selectCurrentPhase}. The phases explorer keeps
 * reading its own selection, so a pick made on the planner never moves the explorer.
 */
export function selectCombatPhase(state: PlannerStore): number {
  const override = state.plannerPhaseOverride;
  if (override != null && Number.isFinite(override)) {
    return wikiPhaseLine(override)?.phase ?? selectCurrentPhase(state);
  }
  return selectCurrentPhase(state);
}

/** Where {@link selectCombatPhase}'s answer came from — the sentence the combat panel prints. */
export function selectCombatPhaseSelection(state: PlannerStore): PhaseSelection {
  const phase = selectCombatPhase(state);
  return phase === selectCurrentPhase(state)
    ? { kind: 'farmScreen', phase }
    : { kind: 'override', phase };
}

/**
 * The mitigation belonging to {@link selectCombatPhase}. A picked phase — on the planner or in
 * the explorer — carries the wiki line's own figure, the identical derivation the phases explorer
 * feeds its per-hero panel, so the two surfaces agree to the last digit rather than to the two
 * decimals the account stores. With no pick anywhere the account's own stored figure stands,
 * exactly as it did before there was a pick.
 */
export function selectCombatMitigationPct(state: PlannerStore): number {
  const picked = state.plannerPhaseOverride != null || state.phasesViewPhaseChosen;
  if (!picked) return state.mitigationPct;
  const line = wikiPhaseLine(selectCombatPhase(state));
  return line ? line.mitig * 100 : state.mitigationPct;
}
