import { PVP_SQUAD_SLOTS, PVP_WINDOW_SECS, gateWindowSecs, resolveGatePhase } from '../combat-window';
import type { TeamPlanInput } from './types';

export type ResolvedCombatWindow = {
  /** The phase the window is fought at — `null` only for a duel on a record with no phase at all. */
  readonly phase: number | null;
  readonly windowSecs: number;
  /** How many heroes the window's field seats at once; `null` keeps the account's own field. */
  readonly fieldSlots: number | null;
};

/**
 * The window a plan fights over and the phase it is fought at, or `null` for a rotation
 * objective. A gate clear resolves its phase through the gate table — a chosen phase that is
 * not a gate, or none, becomes the account's next gate — because the timer is the act's, and
 * an act needs a gate to be read from. A duel is fought in a room of its own, which seats nine.
 */
export function resolveCombatWindow(
  input: Pick<TeamPlanInput, 'objective' | 'targetPhase' | 'account'>,
): ResolvedCombatWindow | null {
  const chosen = input.targetPhase != null && Number.isFinite(input.targetPhase) ? Math.round(input.targetPhase) : null;
  if (input.objective === 'gateClear') {
    const phase = resolveGatePhase(chosen, input.account.phase ?? 1);
    return { phase, windowSecs: gateWindowSecs(phase), fieldSlots: null };
  }
  if (input.objective === 'pvp') {
    return { phase: chosen ?? input.account.phase, windowSecs: PVP_WINDOW_SECS, fieldSlots: PVP_SQUAD_SLOTS };
  }
  return null;
}

/** The field a plan's roster is evaluated on: the duel room's seats, else the account's field. */
export function planFieldSlots(input: Pick<TeamPlanInput, 'objective' | 'targetPhase' | 'account'>): number {
  return resolveCombatWindow(input)?.fieldSlots ?? input.account.fieldSlots;
}
