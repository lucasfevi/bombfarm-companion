import { wikiPhaseLine } from '@bombfarm/domain/phase-wiki';
import type { PlannerStore } from '@/shared/stores/planner-store';

export const selectPhasesViewPhase = (state: PlannerStore): number => state.phasesViewPhase;
export const selectPhasesViewPhaseChosen = (state: PlannerStore): boolean =>
  state.phasesViewPhaseChosen;

/**
 * The one phase every per-hero combat figure in this app is computed at.
 *
 * `state.phase` is the farm phase the imported save reported, and nothing in the app moves it
 * afterwards. `state.phasesViewPhase` is the phase the player picked in the phases explorer.
 * Reading a different one on each screen is what made the same hero print two sets of combat
 * numbers, so every surface reads this instead.
 *
 * A real pick always wins. With no pick the account's own farm phase stands: it is what a fresh
 * import already computed at, and taking the explorer's unchosen phase-1 default instead would
 * move a freshly imported account's numbers onto a phase nobody named.
 */
export function selectCombatPhase(state: PlannerStore): number {
  const requested = state.phasesViewPhaseChosen ? state.phasesViewPhase : state.phase;
  if (requested == null || !Number.isFinite(requested)) return 1;
  return wikiPhaseLine(requested)?.phase ?? 1;
}

/**
 * The mitigation belonging to {@link selectCombatPhase}. A picked phase carries the wiki line's
 * own figure — the identical derivation the phases explorer feeds its per-hero panel, so the two
 * surfaces agree to the last digit rather than to the two decimals the account stores. With no
 * pick the account's own stored figure stands, exactly as it did before there was a pick.
 */
export function selectCombatMitigationPct(state: PlannerStore): number {
  if (!state.phasesViewPhaseChosen) return state.mitigationPct;
  const line = wikiPhaseLine(state.phasesViewPhase);
  return line ? line.mitig * 100 : state.mitigationPct;
}
