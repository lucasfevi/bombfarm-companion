import type { TeamPlanInputs } from './team-plan-inputs';
import type { TeamPlanControls } from './team-plan-controls';

/**
 * The phase the team plan actually scores at.
 *
 * Until the player picks one, this tracks what they were already looking at: the host's own
 * farm-phase choice when it made one ({@link TeamPlanInputs.farmChosenPhase}), else the phase
 * the save says the account is on. `null` means neither exists, or the player picked None.
 */
export function resolveTeamPlanTargetPhase(
  inputs: Pick<TeamPlanInputs, 'farmChosenPhase' | 'phase'>,
  controls: Pick<TeamPlanControls, 'targetPhase' | 'targetPhaseChosen'>,
): number | null {
  if (controls.targetPhaseChosen) return controls.targetPhase;
  if (inputs.farmChosenPhase != null) return inputs.farmChosenPhase;
  return inputs.phase;
}
